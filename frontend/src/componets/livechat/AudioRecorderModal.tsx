import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMic, FiSquare, FiX, FiCheck, FiPlay, FiPause, FiTrash2 } from 'react-icons/fi';
import { Button, Card } from '../../components/ui';
import { getAccessToken } from '../../utils/api';

type Props = {
  apiBase: string;
  open: boolean;
  onClose: () => void;
  onSelect: (media: any) => void;
};

export default function AudioRecorderModal({ apiBase, open, onClose, onSelect }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setVolume(0);
    }
    return () => {
      clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup Audio Context for volume visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateVolume = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      const candidates = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];
      const pick = (t: string) => (window as any).MediaRecorder?.isTypeSupported?.(t);
      const mimeType = pick(candidates[0]) ? candidates[0] : pick(candidates[1]) ? candidates[1] : candidates[2];

      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      mediaRecorderRef.current = mr;
      mr.start(1000); // Captura dados a cada 1 segundo para garantir a gravação
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setError(null);
    } catch (err) {
      console.error("Failed to start recording", err);
      setError("Permita acesso ao microfone para gravar.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const formData = new FormData();
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      formData.append('file', audioBlob, `recording_${Date.now()}.${ext}`);

      const baseUrl = (apiBase || "").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/livechat/media-library/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: "include"
      });

      if (!res.ok) throw new Error("Falha no upload");

      const data = await res.json();
      onSelect(data.media);
      onClose();
    } catch (err) {
      console.error("Upload error", err);
      setError("Falha ao salvar áudio na biblioteca.");
    } finally {
      setUploading(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-200">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold dark:text-white">Gravar Áudio</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <FiX size={20} />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            {isRecording ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div 
                    className="absolute inset-0 bg-red-500/20 rounded-full transition-transform duration-75"
                    style={{ transform: `scale(${1 + (volume / 100)})` }}
                  />
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center z-10 shadow-lg shadow-red-500/40">
                    <FiMic size={32} className="text-white" />
                  </div>
                </div>
                <div className="w-full max-w-[200px] h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all duration-75"
                    style={{ width: `${Math.min(volume * 2, 100)}%` }}
                  />
                </div>
                <span className="text-2xl font-mono font-bold text-red-500">{formatTime(recordingTime)}</span>
                <Button variant="danger" onClick={stopRecording} className="rounded-full px-8">
                  <FiSquare className="mr-2" /> Parar Gravação
                </Button>
              </div>
            ) : audioUrl ? (
              <div className="w-full space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl flex items-center gap-4">
                  <button 
                    onClick={togglePlayback}
                    className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    {isPlaying ? <FiPause size={20} /> : <FiPlay size={20} className="ml-1" />}
                  </button>
                  <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-0" />
                  </div>
                  <audio 
                    ref={audioRef} 
                    src={audioUrl} 
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="hidden" 
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { setAudioUrl(null); setAudioBlob(null); }} className="flex-1">
                    <FiTrash2 className="mr-2" /> Descartar
                  </Button>
                  <Button variant="primary" onClick={handleUpload} disabled={uploading} className="flex-1">
                    {uploading ? "Salvando..." : <><FiCheck className="mr-2" /> Usar Áudio</>}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <button 
                  onClick={startRecording}
                  className="w-24 h-24 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                >
                  <FiMic size={40} />
                </button>
                <span className="text-gray-500 dark:text-gray-400 text-sm">Clique para começar a gravar</span>
              </div>
            )}

            {error && (
              <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 text-center">
                {error}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>,
    document.body
  );
}

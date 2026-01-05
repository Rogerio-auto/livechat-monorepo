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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    if (audioUrl && audioRef.current) {
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
    }
  }, [audioUrl]);

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
      console.log("Iniciando captura de áudio...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Setup Audio Context for volume visualization
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioContextClass();
      
      // Forçar o resume do context imediatamente após a criação (necessário em alguns navegadores)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3; // Torna a wave mais fluida
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!analyserRef.current || !mediaRecorderRef.current) return;

        // Se ainda não começou a gravar, tentamos novamente no próximo frame
        if (mediaRecorderRef.current.state !== 'recording') {
          animationFrameRef.current = requestAnimationFrame(updateVolume);
          return;
        }
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > max) max = dataArray[i];
        }
        
        // Aumentar a sensibilidade para garantir movimento
        const vol = Math.min((max / 128) * 100, 100); 
        setVolume(vol);
        
        if (vol > 5) {
          // console.log("Volume detectado:", vol);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      const candidates = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
      const pick = (t: string) => (window as any).MediaRecorder?.isTypeSupported?.(t);
      const mimeType = candidates.find(t => pick(t)) || "audio/webm";
      
      console.log("MimeType selecionado:", mimeType);

      const mr = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 128000 
      });
      audioChunksRef.current = [];
      
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          console.log("Dados de áudio recebidos:", e.data.size, "bytes");
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = () => {
        console.log("Gravação finalizada. Total de chunks:", audioChunksRef.current.length);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log("Blob final:", blob.size, "bytes", blob.type);
        
        if (blob.size < 100) {
          console.error("Aviso: O blob gerado é muito pequeno, pode estar vazio.");
        }

        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        audioContextRef.current = null;
        analyserRef.current = null;
      };

      mediaRecorderRef.current = mr;
      mr.start(200); 
      setIsRecording(true);
      
      setTimeout(() => {
        updateVolume();
      }, 100);

      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setError(null);
    } catch (err) {
      console.error("Erro crítico na gravação:", err);
      setError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const formData = new FormData();
      let ext = 'webm';
      if (audioBlob.type.includes('ogg')) ext = 'ogg';
      else if (audioBlob.type.includes('mp4')) ext = 'mp4';
      
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
      setIsPlaying(false);
    } else {
      console.log("Iniciando playback do áudio...");
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Erro no playback:", err);
          setError("Não foi possível reproduzir o áudio.");
        });
    }
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
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-100" 
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                      <span>{formatTime(Math.floor(currentTime))}</span>
                      <span>{formatTime(Math.floor(duration))}</span>
                    </div>
                  </div>
                  <audio 
                    ref={audioRef} 
                    src={audioUrl} 
                    onEnded={() => { setIsPlaying(false); setCurrentTime(duration); }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    className="hidden" 
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => { 
                    setAudioUrl(null); 
                    setAudioBlob(null); 
                    setCurrentTime(0);
                    setDuration(0);
                    setIsPlaying(false);
                  }} className="flex-1">
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

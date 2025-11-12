import { useState, useRef, useCallback, useEffect } from "react";
import { FaTimes, FaCamera, FaImage, FaMapMarkerAlt } from "react-icons/fa";
import { useGeolocation, type GeolocationData } from "../../hooks/useGeolocation";
import { useImageUpload } from "../../hooks/useImageUpload";
import { ImageWithMetadata } from "./ImageWithMetadata";

interface CardImageCaptureProps {
  cardId: string;
  onClose: () => void;
  onPhotoUploaded: () => void;
}

type CaptureMode = "select" | "camera" | "preview";

export function CardImageCapture({ cardId, onClose, onPhotoUploaded }: CardImageCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>("select");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [geoData, setGeoData] = useState<GeolocationData | null>(null);
  const [processedImageData, setProcessedImageData] = useState<string | null>(null);
  const [indexNumber] = useState(() => Math.floor(Math.random() * 9000) + 1000); // 1000-9999
  const [skipGPS, setSkipGPS] = useState(false); // Flag para pular GPS

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getCurrentPosition, loading: geoLoading } = useGeolocation();
  const { uploadPhoto, uploading, error: uploadError } = useImageUpload(cardId);

  // Limpa stream da câmera ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Câmera traseira em dispositivos móveis
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setMode("camera");
      }
    } catch (err) {
      console.error("[CardImageCapture] Camera error:", err);
      alert("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setImageBlob(blob);
          stopCamera();
          captureLocation(); // Sempre captura GPS na câmera
          setMode("preview");
        }
      },
      "image/jpeg",
      0.9
    );
  }, [stopCamera]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione uma imagem válida.");
      return;
    }

    setImageBlob(file);
    setMode("preview");
    // Não captura GPS automaticamente - deixa opcional
  }, []);

  const captureLocation = useCallback(async () => {
    const position = await getCurrentPosition();
    if (position) {
      setGeoData(position);
      setSkipGPS(false);
    }
  }, [getCurrentPosition]);

  const handleSkipGPS = useCallback(() => {
    setSkipGPS(true);
    setGeoData(null);
    // Força processamento da imagem sem GPS
    if (imageBlob) {
      const reader = new FileReader();
      reader.onload = () => {
        setProcessedImageData(reader.result as string);
      };
      reader.readAsDataURL(imageBlob);
    }
  }, [imageBlob]);

  const handleUpload = useCallback(async () => {
    if (!processedImageData) {
      alert("Aguarde o processamento da imagem.");
      return;
    }

    // Permite upload sem GPS se o usuário pulou
    const metadata = geoData
      ? {
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          altitude: geoData.altitude,
          accuracy: geoData.accuracy,
          address: geoData.address,
          city: geoData.city,
          state: geoData.state,
          postalCode: geoData.postalCode,
          country: geoData.country,
        }
      : {};

    const result = await uploadPhoto(processedImageData, metadata);

    if (result) {
      onPhotoUploaded();
      onClose();
    }
  }, [processedImageData, geoData, uploadPhoto, onPhotoUploaded, onClose]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
            <FaCamera className="text-blue-600" />
            {mode === "select" && "Adicionar Foto"}
            {mode === "camera" && "Capturar Foto"}
            {mode === "preview" && "Confirmar Foto"}
          </h3>
          <button
            onClick={handleCancel}
            className="text-zinc-500 hover:text-zinc-800 transition-colors"
            title="Fechar"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Modo: Seleção */}
          {mode === "select" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 mb-6">
                Escolha como deseja adicionar a foto ao card:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <FaCamera className="text-4xl text-blue-600" />
                  <span className="font-semibold text-zinc-800">Capturar com Câmera</span>
                  <span className="text-xs text-zinc-500">Com localização GPS</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-zinc-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
                >
                  <FaImage className="text-4xl text-emerald-600" />
                  <span className="font-semibold text-zinc-800">Selecionar Arquivo</span>
                  <span className="text-xs text-zinc-500">Da galeria ou arquivos</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Modo: Câmera */}
          {mode === "camera" && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto"
                />
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    stopCamera();
                    setMode("select");
                  }}
                  className="px-6 py-3 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={capturePhoto}
                  className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2"
                >
                  <FaCamera />
                  Capturar Foto
                </button>
              </div>
            </div>
          )}

          {/* Modo: Preview */}
          {mode === "preview" && imageBlob && (
            <div className="space-y-4">
              {/* Opção de capturar GPS (só aparece se ainda não capturou) */}
              {!geoData && !geoLoading && !skipGPS && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1">
                      <FaMapMarkerAlt className="text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-semibold text-blue-900 mb-1">Adicionar localização GPS?</div>
                        <div className="text-blue-700">
                          Capture as coordenadas e endereço no momento da foto
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSkipGPS}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        Pular
                      </button>
                      <button
                        onClick={captureLocation}
                        className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        Capturar GPS
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {geoLoading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-4 py-3 rounded-lg">
                  <FaMapMarkerAlt className="animate-pulse" />
                  <span>Obtendo localização GPS...</span>
                </div>
              )}

              {skipGPS && !geoData && (
                <div className="text-xs text-zinc-500 bg-zinc-50 px-4 py-3 rounded-lg flex items-center gap-2">
                  <span>📍</span>
                  <span>Foto sem localização GPS</span>
                </div>
              )}

              {geoData && (
                <div className="text-xs text-zinc-600 bg-zinc-50 px-4 py-3 rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-emerald-600" />
                    <span className="font-semibold">Localização capturada:</span>
                  </div>
                  <div className="ml-6">
                    {geoData.address && <div>{geoData.address}</div>}
                    {geoData.city && (
                      <div>
                        {geoData.city}
                        {geoData.state && ` - ${geoData.state}`}
                      </div>
                    )}
                    <div className="text-zinc-500 mt-1">
                      {geoData.latitude.toFixed(6)}, {geoData.longitude.toFixed(6)}
                    </div>
                  </div>
                </div>
              )}

              <ImageWithMetadata
                imageBlob={imageBlob}
                geoData={geoData}
                indexNumber={indexNumber.toString()}
                onProcessed={setProcessedImageData}
              />

              {uploadError && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
                  Erro ao enviar: {uploadError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setImageBlob(null);
                    setGeoData(null);
                    setProcessedImageData(null);
                    setSkipGPS(false);
                    setMode("select");
                  }}
                  className="px-6 py-3 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium transition-colors"
                  disabled={uploading}
                >
                  Refazer
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !processedImageData}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-medium transition-colors"
                >
                  {uploading ? "Enviando..." : "Salvar Foto"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { GeolocationData } from "../../hooks/useGeolocation";

interface ImageWithMetadataProps {
  imageBlob: Blob;
  geoData: GeolocationData | null;
  indexNumber?: string;
  onProcessed: (finalImageData: string) => void;
}

export function ImageWithMetadata({ imageBlob, geoData, indexNumber, onProcessed }: ImageWithMetadataProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processImage = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Carrega a imagem
      const img = new Image();
      const imageUrl = URL.createObjectURL(imageBlob);

      img.onload = () => {
        // Define tamanho do canvas
        canvas.width = img.width;
        canvas.height = img.height;

        // Desenha a imagem original
        ctx.drawImage(img, 0, 0);

        // Adiciona overlay com metadados
        if (geoData) {
          drawMetadataOverlay(ctx, canvas.width, canvas.height, geoData, indexNumber);
        }

        // Converte para base64
        const finalImageData = canvas.toDataURL("image/jpeg", 0.9);
        onProcessed(finalImageData);
        setProcessing(false);

        // Libera memória
        URL.revokeObjectURL(imageUrl);
      };

      img.onerror = () => {
        console.error("[ImageWithMetadata] Failed to load image");
        setProcessing(false);
        URL.revokeObjectURL(imageUrl);
      };

      img.src = imageUrl;
    };

    processImage();
  }, [imageBlob, geoData, indexNumber, onProcessed]);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg" />
      {processing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
          <div className="text-white text-sm">Processando imagem...</div>
        </div>
      )}
    </div>
  );
}

function drawMetadataOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  geoData: GeolocationData,
  indexNumber?: string
) {
  // Configurações do overlay
  const padding = 20;
  const lineHeight = 24;
  const fontSize = 18;
  const boxWidth = Math.min(width - padding * 2, 500);
  
  // Formata data
  const date = new Date(geoData.timestamp);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Monta linhas de texto
  const lines: string[] = [
    `${dateStr}, ${timeStr}`,
    `${geoData.latitude.toFixed(6)}, ${geoData.longitude.toFixed(6)}`,
  ];

  if (geoData.altitude !== null) {
    lines.push(`±${geoData.altitude.toFixed(2)}m`);
  }

  if (geoData.address) {
    // Extrai parte principal do endereço (ex: "BR364" da string completa)
    const addressParts = geoData.address.split(",");
    const mainAddress = addressParts[0]?.trim() || "";
    if (mainAddress) {
      lines.push(mainAddress);
    }
  }

  if (geoData.city || geoData.state) {
    const location = [geoData.city, geoData.state].filter(Boolean).join(" ");
    if (location) {
      lines.push(location);
    }
  }

  if (geoData.postalCode) {
    lines.push(geoData.postalCode);
  }

  if (geoData.country) {
    lines.push(geoData.country);
  }

  if (indexNumber) {
    lines.push(`Número do índice: ${indexNumber}`);
  }

  // Calcula altura do box
  const boxHeight = lines.length * lineHeight + padding * 2;

  // Posição do box (canto inferior esquerdo)
  const boxX = padding;
  const boxY = height - boxHeight - padding;

  // Desenha fundo semi-transparente
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Desenha borda
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Configura texto
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = "top";

  // Desenha cada linha
  lines.forEach((line, index) => {
    const textX = boxX + padding;
    const textY = boxY + padding + index * lineHeight;
    ctx.fillText(line, textX, textY);
  });
}

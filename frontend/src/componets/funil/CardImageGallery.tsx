import { useState, useCallback } from "react";
import { FaTimes, FaTrash, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import type { UploadedPhoto } from "../../hooks/useImageUpload";

interface CardImageGalleryProps {
  photos: UploadedPhoto[];
  onDelete: (photoId: string) => Promise<void>;
}

export function CardImageGallery({ photos, onDelete }: CardImageGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<UploadedPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(
    async (photoId: string) => {
      if (!confirm("Tem certeza que deseja excluir esta foto?")) return;

      setDeleting(true);
      try {
        await onDelete(photoId);
        setSelectedPhoto(null);
      } catch (error) {
        console.error("[CardImageGallery] Delete error:", error);
        alert("Erro ao excluir foto");
      } finally {
        setDeleting(false);
      }
    },
    [onDelete]
  );

  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Nenhuma foto anexada ainda
      </div>
    );
  }

  return (
    <>
      {/* Grid de miniaturas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setSelectedPhoto(photo)}
            className="relative aspect-square rounded-lg overflow-hidden border-2 border-zinc-200 hover:border-blue-500 transition-all group"
          >
            <img
              src={photo.storage_url}
              alt="Foto do card"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                Ver
              </div>
            </div>
            {photo.metadata?.latitude && (
              <div className="absolute top-1 right-1 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                <FaMapMarkerAlt size={10} />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Modal de visualização */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-white rounded-xl shadow-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-white">
              <h3 className="text-lg font-semibold text-zinc-800">Detalhes da Foto</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(selectedPhoto.id)}
                  disabled={deleting}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Excluir foto"
                >
                  <FaTrash />
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
                  title="Fechar"
                >
                  <FaTimes size={20} />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="flex-1 overflow-auto bg-zinc-900 flex items-center justify-center p-4">
              <img
                src={selectedPhoto.storage_url}
                alt="Foto ampliada"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Metadata */}
            {selectedPhoto.metadata && Object.keys(selectedPhoto.metadata).length > 0 && (
              <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                <h4 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                  <FaMapMarkerAlt className="text-emerald-600" />
                  Informações de Localização
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {selectedPhoto.metadata.capturedAt && (
                    <div className="flex items-start gap-2">
                      <FaClock className="text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-zinc-500">Data/Hora</div>
                        <div className="text-zinc-800 font-medium">
                          {new Date(selectedPhoto.metadata.capturedAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.metadata.latitude && selectedPhoto.metadata.longitude && (
                    <div className="flex items-start gap-2">
                      <FaMapMarkerAlt className="text-zinc-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-zinc-500">Coordenadas</div>
                        <div className="text-zinc-800 font-medium font-mono text-xs">
                          {selectedPhoto.metadata.latitude.toFixed(6)},{" "}
                          {selectedPhoto.metadata.longitude.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.metadata.altitude && (
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 mt-0.5">📏</span>
                      <div>
                        <div className="text-zinc-500">Altitude</div>
                        <div className="text-zinc-800 font-medium">
                          ±{selectedPhoto.metadata.altitude.toFixed(2)}m
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.metadata.accuracy && (
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 mt-0.5">🎯</span>
                      <div>
                        <div className="text-zinc-500">Precisão</div>
                        <div className="text-zinc-800 font-medium">
                          ±{selectedPhoto.metadata.accuracy.toFixed(1)}m
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.metadata.address && (
                    <div className="flex items-start gap-2 col-span-full">
                      <span className="text-zinc-400 mt-0.5">📍</span>
                      <div className="flex-1">
                        <div className="text-zinc-500">Endereço</div>
                        <div className="text-zinc-800 font-medium">
                          {selectedPhoto.metadata.address}
                        </div>
                      </div>
                    </div>
                  )}

                  {(selectedPhoto.metadata.city || selectedPhoto.metadata.state) && (
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 mt-0.5">🏙️</span>
                      <div>
                        <div className="text-zinc-500">Cidade/Estado</div>
                        <div className="text-zinc-800 font-medium">
                          {[selectedPhoto.metadata.city, selectedPhoto.metadata.state]
                            .filter(Boolean)
                            .join(" - ")}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedPhoto.metadata.postalCode && (
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-400 mt-0.5">📮</span>
                      <div>
                        <div className="text-zinc-500">CEP</div>
                        <div className="text-zinc-800 font-medium">
                          {selectedPhoto.metadata.postalCode}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Link para Google Maps */}
                {selectedPhoto.metadata.latitude && selectedPhoto.metadata.longitude && (
                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <a
                      href={`https://www.google.com/maps?q=${selectedPhoto.metadata.latitude},${selectedPhoto.metadata.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                    >
                      <FaMapMarkerAlt />
                      Ver no Google Maps
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


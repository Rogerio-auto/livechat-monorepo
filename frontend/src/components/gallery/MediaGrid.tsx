import { FiImage, FiLoader } from "react-icons/fi";
import { useState } from "react";
import MediaCard from "./MediaCard";

interface MediaGridProps {
  media: any[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MediaGrid({ media, loading, onRefresh }: MediaGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader className="animate-spin h-8 w-8 text-gray-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando mídias...</span>
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="text-center py-12">
        <FiImage className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Nenhuma mídia encontrada
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Faça upload de imagens, vídeos ou documentos para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {media.map((item) => (
        <MediaCard key={item.id} media={item} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

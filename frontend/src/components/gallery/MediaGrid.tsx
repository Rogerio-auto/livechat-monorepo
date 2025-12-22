import { FiImage } from "react-icons/fi";
import MediaCard from "./MediaCard";

interface MediaGridProps {
  media: any[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MediaGrid({ media, loading, onRefresh }: MediaGridProps) {
  const showSkeleton = loading && media.length === 0;

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)]"
          />
        ))}
      </div>
    );
  }

  if (!loading && media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-8 py-16 text-center text-(--color-text-muted)">
        <FiImage className="h-12 w-12 text-(--color-primary)" />
        <div>
          <h3 className="text-base font-semibold text-(--color-text)">Nenhuma mídia encontrada</h3>
          <p className="mt-1 text-sm">
            Faça upload de imagens, vídeos ou documentos para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {media.map((item) => (
        <MediaCard key={item.id} media={item} onRefresh={onRefresh} />
      ))}
    </div>
  );
}


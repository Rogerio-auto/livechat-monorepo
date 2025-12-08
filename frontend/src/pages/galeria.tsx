import { useState, useEffect, useMemo, useCallback } from "react";
import { FiUpload, FiRefreshCcw, FiLayers, FiImage, FiDatabase, FiClock } from "react-icons/fi";
import MediaUploader from "../components/gallery/MediaUploader";
import MediaGrid from "../components/gallery/MediaGrid";
import MediaFilters from "../components/gallery/MediaFilters";

type GalleryFilters = {
  media_type: string;
  category: string;
  search: string;
  is_active: string;
};

type PaginationState = {
  total: number;
  limit: number;
  offset: number;
};

type MediaSummary = {
  counts: {
    image: number;
    video: number;
    document: number;
    audio: number;
  };
  totalSize: number;
  active: number;
  inactive: number;
  latestUpload: Date | null;
};

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

const formatFileSize = (bytes: number): string => {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fixed = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${fixed.replace(".", ",")} ${units[unitIndex]}`;
};

export default function GaleriaPage() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GalleryFilters>({
    media_type: "",
    category: "",
    search: "",
    is_active: "true",
  });
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    limit: 50,
    offset: 0,
  });
  const [showUploader, setShowUploader] = useState(false);

  const limit = pagination.limit;
  const offset = pagination.offset;

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.media_type) params.append("media_type", filters.media_type);
      if (filters.category) params.append("category", filters.category);
      if (filters.search) params.append("search", filters.search);
      if (filters.is_active !== "") params.append("is_active", filters.is_active);
      params.append("limit", String(limit));
      params.append("offset", String(offset));

      const response = await fetch(`${API}/api/media?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Erro ao buscar mídias");
      }

      const data = await response.json();
      setMedia(Array.isArray(data.media) ? data.media : []);
      const total = Number(data.pagination?.total) || 0;
      setPagination((prev) => ({
        ...prev,
        total,
      }));
    } catch (error) {
      console.error("Erro ao buscar mídias:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, limit, offset]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const handleRefreshClick = useCallback(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const handleFilterChange = (newFilters: GalleryFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleUploadSuccess = () => {
    setShowUploader(false);
    handleRefreshClick();
  };

  const handlePageChange = (direction: "prev" | "next") => {
    setPagination((prev) => {
      const nextOffset =
        direction === "prev"
          ? Math.max(0, prev.offset - prev.limit)
          : prev.offset + prev.limit;
      if (nextOffset === prev.offset) {
        return prev;
      }
      return {
        ...prev,
        offset: nextOffset,
      };
    });
  };

  const handlePageSizeChange = (newLimit: number) => {
    setPagination((prev) => ({
      ...prev,
      limit: newLimit,
      offset: 0,
    }));
  };

  const currentRangeStart = pagination.total === 0 ? 0 : offset + 1;
  const currentRangeEnd = pagination.total === 0 ? 0 : Math.min(offset + limit, pagination.total);
  const totalPages =
    pagination.total === 0 ? 1 : Math.max(1, Math.ceil(pagination.total / limit));
  const currentPage =
    pagination.total === 0 ? 1 : Math.min(totalPages, Math.floor(offset / limit) + 1);
  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < pagination.total;

  const summary = useMemo<MediaSummary>(() => {
    const counts: MediaSummary["counts"] = {
      image: 0,
      video: 0,
      document: 0,
      audio: 0,
    };
    let totalSize = 0;
    let active = 0;
    let inactive = 0;
    let latestUpload: Date | null = null;

    media.forEach((item) => {
      const typeKey = String(item.media_type || "").toLowerCase();
      if (typeKey in counts) {
        counts[typeKey as keyof typeof counts] += 1;
      }
      if (typeof item.file_size === "number" && Number.isFinite(item.file_size)) {
        totalSize += item.file_size;
      }
      if (item.is_active === false) {
        inactive += 1;
      } else {
        active += 1;
      }
      if (item.created_at) {
        const createdAt = new Date(item.created_at);
        if (!Number.isNaN(createdAt.getTime())) {
          if (!latestUpload || createdAt > latestUpload) {
            latestUpload = createdAt;
          }
        }
      }
    });

    return {
      counts,
      totalSize,
      active,
      inactive,
      latestUpload,
    };
  }, [media]);

  const summaryCards = useMemo(
    () => {
      const typeParts = [
        summary.counts.image
          ? `${summary.counts.image.toLocaleString("pt-BR")} imagens`
          : null,
        summary.counts.video
          ? `${summary.counts.video.toLocaleString("pt-BR")} vídeos`
          : null,
        summary.counts.document
          ? `${summary.counts.document.toLocaleString("pt-BR")} documentos`
          : null,
        summary.counts.audio
          ? `${summary.counts.audio.toLocaleString("pt-BR")} áudios`
          : null,
      ].filter(Boolean) as string[];

      const typeDetail =
        typeParts.length > 0 ? typeParts.join(" • ") : "Aguardando primeiros arquivos";

      const storageValue = summary.totalSize > 0 ? formatFileSize(summary.totalSize) : "-";

      const averageSizeDetail =
        summary.totalSize > 0 && media.length > 0
          ? `Média de ${formatFileSize(Math.round(summary.totalSize / media.length))} por arquivo`
          : "Mantenha uploads otimizados";

      const latestUpload = summary.latestUpload;

      const lastUploadValue = latestUpload
        ? latestUpload.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-";

      const lastUploadDetail = latestUpload
        ? latestUpload.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Sem uploads recentes";

      return [
        {
          key: "library",
          title: "Biblioteca total",
          value: media.length.toLocaleString("pt-BR"),
          detail: typeDetail,
          accent: "bg-[rgba(47,180,99,0.18)]",
          icon: <FiLayers className="h-4 w-4 text-(--color-primary)" />,
        },
        {
          key: "active",
          title: "Itens ativos",
          value: summary.active.toLocaleString("pt-BR"),
          detail:
            summary.inactive > 0
              ? `${summary.inactive.toLocaleString("pt-BR")} inativos`
              : "Todos publicados",
          accent: "bg-[rgba(59,130,246,0.18)]",
          icon: <FiImage className="h-4 w-4 text-[#3b82f6]" />,
        },
        {
          key: "storage",
          title: "Armazenamento",
          value: storageValue,
          detail: averageSizeDetail,
          accent: "bg-[rgba(15,36,24,0.2)]",
          icon: <FiDatabase className="h-4 w-4 text-(--color-text)" />,
        },
        {
          key: "lastUpload",
          title: "Último upload",
          value: lastUploadValue,
          detail: lastUploadDetail,
          accent: "bg-[rgba(255,193,7,0.2)]",
          icon: <FiClock className="h-4 w-4 text-[#f59e0b]" />,
        },
      ];
    },
    [summary, media.length]
  );

  return (
    <>
      <div className="livechat-theme min-h-screen w-full pb-12 transition-colors duration-500">
        <div className="mx-auto w-full max-w-(--page-max-width) px-3 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="livechat-card rounded-3xl p-6 shadow-xl md:p-8">
            <div className="space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 text-xs font-semibold text-(--color-primary)">
                    Portal multimídia
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-(--color-text)">Galeria de Mídias</h1>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      Centralize criativos, materiais de marketing e arquivos de apoio para toda equipe.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-text-muted)">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1 font-semibold text-(--color-text)">
                      Total: {media.length.toLocaleString("pt-BR")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1 font-semibold text-(--color-text)">
                      Ativos: {summary.active.toLocaleString("pt-BR")}
                    </span>
                    {summary.inactive > 0 && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1 font-semibold text-(--color-text)">
                        Inativos: {summary.inactive.toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <button
                    type="button"
                    onClick={handleRefreshClick}
                    className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-4 py-2 text-sm font-semibold text-(--color-text) transition-all hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                  >
                    <FiRefreshCcw className="h-4 w-4" />
                    Atualizar lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUploader(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1f8b49]"
                  >
                    <FiUpload className="h-4 w-4" />
                    Novo upload
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <div
                    key={card.key}
                    className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-xl transition-all duration-200"
                  >
                    <div
                      className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full ${card.accent} blur-3xl`}
                    />
                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                          {card.title}
                        </p>
                        <div className="mt-3 text-2xl font-bold text-(--color-text)">
                          {card.value}
                        </div>
                        <p className="mt-1 text-xs text-(--color-text-muted)">{card.detail}</p>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] text-(--color-text)">
                        {card.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <MediaFilters filters={filters} onFilterChange={handleFilterChange} />

              <div className="rounded-3xl livechat-panel p-5 shadow-xl">
                <MediaGrid media={media} loading={loading} onRefresh={handleRefreshClick} />
              </div>

              {loading && media.length > 0 && (
                <div className="text-xs text-(--color-text-muted)">Atualizando biblioteca...</div>
              )}

              {pagination.total > 0 && (
                <div className="flex flex-col gap-4 rounded-2xl bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-(--color-text-muted)">
                    Mostrando {currentRangeStart.toLocaleString("pt-BR")}-
                    {currentRangeEnd.toLocaleString("pt-BR")} de {pagination.total.toLocaleString("pt-BR")}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <select
                      className="config-input rounded-xl border border-transparent bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-sm focus:border-[rgba(47,180,99,0.35)] focus:outline-none"
                      value={limit}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    >
                      {[24, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}/página
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                        disabled={!canGoPrev}
                        onClick={() => handlePageChange("prev")}
                      >
                        Anterior
                      </button>
                      <span className="text-sm font-semibold text-(--color-text)">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-sm font-semibold text-(--color-text) transition disabled:opacity-50 hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                        disabled={!canGoNext}
                        onClick={() => handlePageChange("next")}
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUploader && (
        <MediaUploader onClose={() => setShowUploader(false)} onSuccess={handleUploadSuccess} />
      )}
    </>
  );
}

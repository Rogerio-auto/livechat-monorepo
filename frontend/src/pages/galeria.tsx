import { useState, useEffect } from "react";
import { FiUpload, FiImage, FiVideo, FiFileText, FiMusic } from "react-icons/fi";
import Sidebar from "../componets/Sidbars/sidebar";
import MediaUploader from "../components/gallery/MediaUploader";
import MediaGrid from "../components/gallery/MediaGrid";
import MediaFilters from "../components/gallery/MediaFilters";

export default function GaleriaPage() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    media_type: "",
    category: "",
    search: "",
    is_active: "true",
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });
  const [showUploader, setShowUploader] = useState(false);

  // Buscar mídias do backend
  const fetchMedia = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.media_type) params.append("media_type", filters.media_type);
      if (filters.category) params.append("category", filters.category);
      if (filters.search) params.append("search", filters.search);
      params.append("is_active", filters.is_active);
      params.append("limit", pagination.limit.toString());
      params.append("offset", pagination.offset.toString());

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/media?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Erro ao buscar mídias");
      }

      const data = await response.json();
      setMedia(data.media || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination.total,
      }));
    } catch (error) {
      console.error("Erro ao buscar mídias:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [filters, pagination.offset]);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleUploadSuccess = () => {
    setShowUploader(false);
    fetchMedia();
  };

  return (
    <>
      <Sidebar />
      <div
        className="ml-16 min-h-screen p-6"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        <div
          className="mt-8 rounded-2xl border p-6 shadow-lg theme-surface"
          style={{
            borderColor: "var(--color-border)",
            boxShadow: "0 32px 48px -32px var(--color-card-shadow)",
          }}
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold theme-heading">Galeria de Mídias</h2>
              <p className="theme-text-muted text-sm">Gerencie imagens, vídeos e documentos vinculados aos seus produtos</p>
            </div>
            <button
              onClick={() => setShowUploader(true)}
              className="theme-primary px-4 py-2 text-sm rounded-xl transition shadow-sm"
            >
              + Upload
            </button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center">
                  <FiImage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase theme-text-muted">Imagens</p>
                  <p className="text-2xl font-semibold theme-heading">
                    {media.filter((m) => m.media_type === "image").length}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-600/20 flex items-center justify-center">
                  <FiVideo className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase theme-text-muted">Vídeos</p>
                  <p className="text-2xl font-semibold theme-heading">
                    {media.filter((m) => m.media_type === "video").length}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center">
                  <FiFileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase theme-text-muted">Documentos</p>
                  <p className="text-2xl font-semibold theme-heading">
                    {media.filter((m) => m.media_type === "document").length}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl border p-4 theme-surface-muted"
              style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-600/20 flex items-center justify-center">
                  <FiMusic className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase theme-text-muted">Áudios</p>
                  <p className="text-2xl font-semibold theme-heading">
                    {media.filter((m) => m.media_type === "audio").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <MediaFilters filters={filters} onFilterChange={handleFilterChange} />

          {/* Grid */}
          <div className="mt-6">
            <MediaGrid
              media={media}
              loading={loading}
              onRefresh={fetchMedia}
            />
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
                disabled={pagination.offset === 0}
                className="theme-secondary px-4 py-2 text-sm rounded-xl transition disabled:opacity-50"
              >
                Anterior
              </button>

              <span className="text-sm theme-text-muted">
                Mostrando {pagination.offset + 1} -{" "}
                {Math.min(pagination.offset + pagination.limit, pagination.total)} de{" "}
                {pagination.total}
              </span>

              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="theme-secondary px-4 py-2 text-sm rounded-xl transition disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploader && (
          <MediaUploader
            onClose={() => setShowUploader(false)}
            onSuccess={handleUploadSuccess}
          />
        )}
      </div>
    </>
  );
}

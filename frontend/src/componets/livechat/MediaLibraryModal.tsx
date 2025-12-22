import React, { useEffect, useState, useCallback } from "react";
import { FiUpload, FiX, FiImage, FiVideo, FiMusic, FiFile, FiTrash2, FiCheck, FiSearch, FiFolder } from "react-icons/fi";
import { Button, Card, CardHeader, Input } from "../../components/ui";

type MediaItem = {
  id: string;
  storage_path: string;
  public_url: string;
  filename: string;
  content_type: string;
  file_size: number;
  media_type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  title?: string | null;
  tags?: string[] | null;
  created_at: string;
};

type Props = {
  apiBase: string;
  open: boolean;
  onClose: () => void;
  onSelect?: (media: MediaItem) => void; // Callback quando seleciona uma mídia
  allowUpload?: boolean; // Se permite upload
  mediaType?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; // Filtro de tipo
  selectionMode?: boolean; // Se está em modo de seleção
};

export default function MediaLibraryModal({
  apiBase,
  open,
  onClose,
  onSelect,
  allowUpload = true,
  mediaType,
  selectionMode = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [localTypeFilter, setLocalTypeFilter] = useState<"IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | undefined>(mediaType);

  // Carregar mídias
  const loadMedia = useCallback(async () => {
    if (!open) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort: "newest",
      });
      
      if (localTypeFilter) params.set("type", localTypeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`${apiBase}/livechat/media-library?${params}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (res.status === 401) {
        setError("Sessão expirada. Por favor, faça login novamente.");
        return;
      }
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error("[MediaLibrary] HTTP error:", res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }
      
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err: any) {
      console.error("[MediaLibrary] Load error:", err);
      setError(err.message || "Falha ao carregar mídias");
    } finally {
      setLoading(false);
    }
  }, [apiBase, open, page, localTypeFilter, search]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Upload de arquivo
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
  const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${apiBase}/livechat/media-library/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      
  // Recarregar lista
      await loadMedia();
      
      // Se em modo seleção, auto-seleciona o upload
      if (selectionMode && data.media && onSelect) {
        onSelect(data.media);
        onClose();
      }
    } catch (err: any) {
      console.error("[MediaLibrary] Upload error:", err);
      setError(err.message || "Falha ao fazer upload");
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  // Deletar mídia
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta mídia?")) return;

    try {
      const res = await fetch(`${apiBase}/livechat/media-library/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Remove da lista
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      console.error("[MediaLibrary] Delete error:", err);
      alert("Falha ao deletar mídia");
    }
  };

  // Selecionar mídia
  const handleSelect = (media: MediaItem) => {
    if (selectionMode && onSelect) {
      onSelect(media);
      onClose();
    } else {
      setSelectedId(media.id === selectedId ? null : media.id);
    }
  };

  // Renderizar thumbnail/preview
  const renderPreview = (media: MediaItem) => {
    if (media.media_type === "IMAGE") {
      return (
        <img
          src={media.public_url}
          alt={media.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }
    
    // Ícones para outros tipos
    const icons = {
      VIDEO: <FiVideo className="w-12 h-12" style={{ color: "var(--color-text-muted)" }} />,
      AUDIO: <FiMusic className="w-12 h-12" style={{ color: "var(--color-text-muted)" }} />,
      DOCUMENT: <FiFile className="w-12 h-12" style={{ color: "var(--color-text-muted)" }} />,
    };
    
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        {icons[media.media_type]}
      </div>
    );
  };

  // Formatar tamanho de arquivo
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-[980px] max-w-[96vw] h-[720px] max-h-[92vh] rounded-xl shadow-md border overflow-hidden"
        style={{ borderColor: "var(--color-border)" }}
      >
  <Card gradient className="h-full w-full rounded-xl shadow-none p-0">
          {/* Header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between bg-linear-to-br from-white to-gray-50 dark:from-[#141414] dark:to-[#0f0f0f]"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
                <FiImage className="w-5 h-5" />
              </div>
              <div>
                <h3
                  className="text-xl font-semibold"
                  style={{ color: "var(--color-heading)" }}
                >
                  Biblioteca de Mídias
                </h3>
                <p
                  className="text-[12px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Gerencie imagens, vídeos, áudios e documentos
                </p>
              </div>
            </div>
            <Button aria-label="Fechar" variant="ghost" size="sm" onClick={onClose}>
              <FiX className="w-5 h-5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div
            className="px-6 py-4 border-b flex items-center gap-3 bg-white/60 dark:bg-[#111]/60 backdrop-blur"
            style={{ borderColor: "var(--color-border)" }}
          >
            {/* Upload */}
            {allowUpload && (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                  accept={
                    localTypeFilter === "IMAGE" ? "image/*" :
                    localTypeFilter === "VIDEO" ? "video/*" :
                    localTypeFilter === "AUDIO" ? "audio/*" :
                    localTypeFilter === "DOCUMENT" ? ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" :
                    undefined
                  }
                />
                <Button variant="gradient" size="md" disabled={uploading}>
                  <span className="inline-flex items-center gap-2">
                    <FiUpload className="w-4 h-4" />
                    {uploading ? "Enviando..." : "Upload"}
                  </span>
                </Button>
              </label>
            )}

            {/* Quick type filters */}
            <div className="flex items-center gap-2">
              {(["IMAGE","VIDEO","AUDIO","DOCUMENT"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setLocalTypeFilter(localTypeFilter === t ? undefined : t); setPage(1); }}
                  className="px-3 py-1.5 text-xs rounded-full border transition-colors hover:opacity-90"
                  style={
                    localTypeFilter === t
                      ? {
                          backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                          color: "var(--color-primary)",
                          borderColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                        }
                      : {
                          backgroundColor: "var(--color-bg)",
                          color: "var(--color-text-muted)",
                          borderColor: "var(--color-border)",
                        }
                  }
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="ml-auto w-[360px]">
              <div className="relative">
                <span
                  className="absolute left-3 top-2.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <FiSearch className="w-4 h-4" />
                </span>
                <Input
                  placeholder="Buscar por nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (setPage(1), loadMedia())}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Grid de mídias */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Carregando...
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center mb-3 border"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <FiFolder
                    className="w-8 h-8"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                </div>
                <p
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {search ? "Nenhuma mídia encontrada" : "Biblioteca vazia"}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {allowUpload && "Faça upload de imagens, vídeos, áudios ou documentos"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {items.map((media) => (
                  <Card 
                    key={media.id} 
                    gradient={false} 
                    hover 
                    className="relative aspect-square p-0 overflow-hidden border-2 cursor-pointer group"
                    style={
                      selectedId === media.id
                        ? {
                            borderColor: "var(--color-primary)",
                            boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent)",
                          }
                        : { borderColor: "var(--color-border)" }
                    }
                    onClick={() => handleSelect(media)}
                  >
                    {/* Preview */}
                    <div className="absolute inset-0 pointer-events-none">
                      {renderPreview(media)}
                    </div>

                    {/* Overlay com info */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] text-white/90 bg-white/10 backdrop-blur px-2 py-0.5 rounded-full border border-white/20">
                          {media.media_type}
                        </span>
                        <Button
                          aria-label="Deletar"
                          onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                          variant="danger"
                          size="sm"
                          className="px-2 py-1 rounded-lg pointer-events-auto"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-white font-medium truncate">
                          {media.title || media.filename}
                        </p>
                        <p className="text-[10px] text-white/80">
                          {formatSize(media.file_size)}
                        </p>
                      </div>
                    </div>

                    {/* Checkmark quando selecionado */}
                    {selectedId === media.id && (
                      <div
                        className="absolute top-2 right-2 w-7 h-7 rounded-xl shadow-md flex items-center justify-center pointer-events-none"
                        style={{ backgroundColor: "var(--color-primary)" }}
                      >
                        <FiCheck className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div
              className="px-6 py-4 border-t flex items-center justify-between bg-white/60 dark:bg-[#111]/60"
              style={{ borderColor: "var(--color-border)" }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}

          {/* Footer info */}
          <div
            className="px-6 py-4 border-t flex items-center justify-between bg-white/60 dark:bg-[#111]/60"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {items.length} mídias
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {selectedId ? "1 mídia selecionada" : "Nenhuma selecionada"}
              </span>
            </div>
            <span
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Dica: clique duas vezes para inserir no chat
            </span>
          </div>

          {/* Footer ações */}
          <div
            className="px-6 py-4 border-t flex justify-end gap-2 bg-white/60 dark:bg-[#111]/60"
            style={{ borderColor: "var(--color-border)" }}
          >
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            {selectionMode && selectedId && (
              <Button
                variant="primary"
                onClick={() => {
                  const selected = items.find((m) => m.id === selectedId);
                  if (selected && onSelect) {
                    onSelect(selected);
                    onClose();
                  }
                }}
              >
                Inserir selecionada
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}


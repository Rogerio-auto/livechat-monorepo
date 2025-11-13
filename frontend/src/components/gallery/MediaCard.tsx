import { FiImage, FiVideo, FiFileText, FiMusic, FiMoreVertical, FiTrash2, FiEdit, FiLink, FiExternalLink, FiCalendar, FiX, FiLoader } from "react-icons/fi";
import { useState } from "react";

interface MediaCardProps {
  media: any;
  onRefresh: () => void;
}

export default function MediaCard({ media, onRefresh }: MediaCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: media.title || "",
    description: media.description || "",
    alt_text: media.alt_text || "",
    category: media.category || "",
    tags: Array.isArray(media.tags) ? media.tags.join(", ") : "",
  });

  const getMediaIcon = () => {
    switch (media.media_type) {
      case "image":
        return <FiImage className="h-5 w-5" />;
      case "video":
        return <FiVideo className="h-5 w-5" />;
      case "document":
        return <FiFileText className="h-5 w-5" />;
      case "audio":
        return <FiMusic className="h-5 w-5" />;
      default:
        return <FiFileText className="h-5 w-5" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja deletar esta mídia?")) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/media/${media.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao deletar");
      }

      onRefresh();
    } catch (error: any) {
      console.error("Erro ao deletar:", error);
      alert(error.message || "Erro ao deletar mídia");
    } finally {
      setDeleting(false);
      setShowMenu(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/media/${media.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            title: editFormData.title,
            description: editFormData.description,
            alt_text: editFormData.alt_text,
            category: editFormData.category,
            tags: editFormData.tags
              .split(",")
              .map((tag: string) => tag.trim())
              .filter(Boolean),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao atualizar");
      }

      setShowEditModal(false);
      onRefresh();
    } catch (error: any) {
      console.error("Erro ao atualizar:", error);
      alert(error.message || "Erro ao atualizar mídia");
    } finally {
      setEditing(false);
    }
  };

  const linkedCount = media.catalog_item_media?.length || 0;

  return (
    <div 
      className="relative rounded-xl border overflow-hidden hover:shadow-lg transition-all duration-200 theme-surface"
      style={{ borderColor: "var(--color-border)" }}
    >
      {/* Thumbnail */}
      <div className="aspect-square theme-surface-muted flex items-center justify-center overflow-hidden">
        {media.media_type === "image" ? (
          <img
            src={media.public_url}
            alt={media.alt_text || media.title || media.original_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="theme-text-muted">
            {getMediaIcon()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="text-sm font-medium theme-heading truncate">
          {media.title || media.original_name}
        </h3>

        {/* Tags */}
        {media.tags && media.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {media.tags.slice(0, 2).map((tag: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: "var(--color-primary-alpha)",
                  color: "var(--color-primary)",
                }}
              >
                {tag}
              </span>
            ))}
            {media.tags.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium theme-surface-muted theme-text-muted">
                +{media.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Meta Info */}
        <div className="mt-3 flex items-center justify-between text-xs theme-text-muted">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {getMediaIcon()}
              {media.media_type}
            </span>
            <span>•</span>
            <span>{formatFileSize(media.file_size)}</span>
          </div>

          {linkedCount > 0 && (
            <span className="inline-flex items-center gap-1" style={{ color: "var(--color-primary)" }}>
              <FiLink className="h-3 w-3" />
              {linkedCount}
            </span>
          )}
        </div>

        {/* Date */}
        <div className="mt-2 flex items-center gap-1 text-xs theme-text-muted">
          <FiCalendar className="h-3 w-3" />
          {formatDate(media.created_at)}
        </div>

        {/* Category Badge */}
        {media.category && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium theme-surface-muted theme-text-muted">
              {media.category}
            </span>
          </div>
        )}
      </div>

      {/* Actions Menu */}
      <div className="absolute top-2 right-2">
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-full theme-surface shadow-sm border transition hover:shadow-md"
            style={{ borderColor: "var(--color-border)" }}
          >
            <FiMoreVertical className="h-4 w-4 theme-text-muted" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div 
                className="absolute right-0 mt-1 w-48 rounded-lg shadow-lg theme-surface ring-1 ring-black ring-opacity-5 z-20"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm theme-text transition"
                    style={{ 
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FiEdit className="h-4 w-4 mr-3" />
                    Editar
                  </button>
                  <a
                    href={media.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-4 py-2 text-sm theme-text hover:bg-opacity-10 transition"
                    style={{ 
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FiExternalLink className="h-4 w-4 mr-3" />
                    Abrir em nova aba
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(media.public_url);
                      alert("URL copiada!");
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm theme-text transition"
                    style={{ 
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--color-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FiLink className="h-4 w-4 mr-3" />
                    Copiar URL
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 transition disabled:opacity-50"
                    style={{ 
                      backgroundColor: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!deleting) e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FiTrash2 className="h-4 w-4 mr-3" />
                    {deleting ? "Deletando..." : "Deletar"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div
            className="theme-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 theme-surface flex items-center justify-between p-6 border-b" style={{ borderColor: "var(--color-border)" }}>
              <h2 className="theme-heading text-2xl font-semibold">Editar Mídia</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--color-surface-muted)",
                  color: "var(--color-text)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--color-surface-muted)";
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-6">
              {/* Preview */}
              <div className="aspect-video theme-surface-muted flex items-center justify-center overflow-hidden rounded-xl">
                {media.media_type === "image" ? (
                  <img
                    src={media.public_url}
                    alt={media.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    {getMediaIcon()}
                    <p className="theme-text-muted text-sm">{media.original_name}</p>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block theme-text-muted text-sm font-medium mb-2">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    className="theme-input w-full px-4 py-2 rounded-lg"
                    value={editFormData.title}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block theme-text-muted text-sm font-medium mb-2">
                    Descrição
                  </label>
                  <textarea
                    className="theme-input w-full px-4 py-2 rounded-lg"
                    rows={3}
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block theme-text-muted text-sm font-medium mb-2">
                    Texto Alternativo (Alt)
                  </label>
                  <input
                    type="text"
                    className="theme-input w-full px-4 py-2 rounded-lg"
                    value={editFormData.alt_text}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, alt_text: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block theme-text-muted text-sm font-medium mb-2">
                    Categoria
                  </label>
                  <select
                    className="theme-input w-full px-4 py-2 rounded-lg"
                    value={editFormData.category}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, category: e.target.value }))
                    }
                  >
                    <option value="">Selecione...</option>
                    <option value="product">Produto</option>
                    <option value="service">Serviço</option>
                    <option value="subscription">Assinatura</option>
                    <option value="promotion">Promoção</option>
                    <option value="general">Geral</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block theme-text-muted text-sm font-medium mb-2">
                    Tags (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    className="theme-input w-full px-4 py-2 rounded-lg"
                    placeholder="exemplo, tag1, tag2"
                    value={editFormData.tags}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, tags: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="theme-secondary px-6 py-2 rounded-lg"
                  disabled={editing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="theme-primary px-6 py-2 rounded-lg flex items-center gap-2"
                  disabled={editing}
                >
                  {editing ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FiEdit size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

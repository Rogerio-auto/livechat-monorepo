// frontend/src/components/projects/ProjectAttachments.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { ProjectAttachment } from "../../types/projects";
import { Upload, File, Trash2, Download, ExternalLink, FileText, Image as ImageIcon, Film, Paperclip } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

type Props = {
  projectId: string;
};

export default function ProjectAttachments({ projectId }: Props) {
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAttachments();
  }, [projectId]);

  const loadAttachments = async () => {
    try {
      const data = await fetchJson<ProjectAttachment[]>(`${API}/projects/${projectId}/attachments`);
      setAttachments(data);
    } catch (err) {
      console.error("Erro ao carregar anexos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API}/projects/${projectId}/attachments/upload`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro no upload');
      }
      
      const newAttachment = await response.json();
      setAttachments([newAttachment, ...attachments]);
    } catch (err: any) {
      console.error("Erro ao enviar arquivo:", err);
      alert(err.message || "Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ""; // Reset input
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este arquivo?")) return;

    try {
      await fetchJson(`${API}/projects/attachments/${id}`, {
        method: "DELETE",
      });
      setAttachments(attachments.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Erro ao excluir arquivo:", err);
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File size={24} />;
    if (type.startsWith("image/")) return <ImageIcon size={24} />;
    if (type.startsWith("video/")) return <Film size={24} />;
    if (type.includes("pdf") || type.includes("word") || type.includes("text")) return <FileText size={24} />;
    return <File size={24} />;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="relative group">
        <input
          type="file"
          onChange={handleFileUpload}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="border-2 border-dashed border-(--color-border) rounded-xl p-8 text-center group-hover:border-(--color-primary) group-hover:bg-(--color-primary)/5 transition-all">
          <div className="w-12 h-12 bg-(--color-primary)/10 rounded-full flex items-center justify-center mx-auto mb-4 text-(--color-primary)">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Upload size={24} />
            )}
          </div>
          <h4 className="text-sm font-semibold text-(--color-text) mb-1">
            {uploading ? "Enviando arquivo..." : "Clique ou arraste para enviar"}
          </h4>
          <p className="text-xs text-(--color-text-muted)">
            PDF, Imagens, Vídeos ou Documentos (Máx. 10MB)
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {attachments.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-(--color-surface-muted) rounded-xl border-2 border-dashed border-(--color-border)">
            <Paperclip size={40} className="mx-auto text-(--color-text-muted) opacity-20 mb-3" />
            <p className="text-(--color-text-muted)">Nenhum arquivo anexado.</p>
          </div>
        ) : (
          attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-4 p-4 bg-(--color-surface-muted) rounded-xl border border-transparent hover:border-(--color-border) transition-all group"
            >
              <div className="w-12 h-12 bg-(--color-surface) rounded-lg flex items-center justify-center text-(--color-primary) shadow-sm">
                {getFileIcon(file.file_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-(--color-text) truncate">
                  {file.file_name}
                </h4>
                <p className="text-xs text-(--color-text-muted)">
                  {formatSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-(--color-text-muted) hover:text-(--color-primary) hover:bg-(--color-surface) rounded-lg transition-all"
                  title="Visualizar"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => handleDelete(file.id)}
                  className="p-2 text-(--color-text-muted) hover:text-red-500 hover:bg-(--color-surface) rounded-lg transition-all"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

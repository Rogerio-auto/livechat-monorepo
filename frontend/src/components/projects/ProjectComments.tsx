// frontend/src/components/projects/ProjectComments.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { ProjectComment } from "../../types/projects";
import { Send, Trash2, MessageSquare } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

type Props = {
  projectId: string;
};

export default function ProjectComments({ projectId }: Props) {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [projectId]);

  const loadComments = async () => {
    try {
      const data = await fetchJson<ProjectComment[]>(`${API}/projects/${projectId}/comments`);
      setComments(data);
    } catch (err) {
      console.error("Erro ao carregar comentários:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const comment = await fetchJson<ProjectComment>(`${API}/projects/${projectId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: newComment }),
      });
      setComments([comment, ...comments]);
      setNewComment("");
    } catch (err) {
      console.error("Erro ao enviar comentário:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Deseja excluir este comentário?")) return;

    try {
      await fetchJson(`${API}/projects/comments/${commentId}`, {
        method: "DELETE",
      });
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Erro ao excluir comentário:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[color:var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          className="w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-xl p-4 pr-12 text-sm text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none resize-none min-h-[100px]"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="absolute bottom-4 right-4 p-2 bg-[color:var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
        >
          <Send size={18} />
        </button>
      </form>

      {/* List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-12 text-[color:var(--color-text-muted)]">
            <MessageSquare className="mx-auto mb-2 opacity-20" size={48} />
            <p>Nenhum comentário ainda</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[color:var(--color-surface-muted)] rounded-xl p-4 border border-transparent hover:border-[color:var(--color-border)] transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[color:var(--color-primary)]/10 flex items-center justify-center text-[color:var(--color-primary)] font-bold text-xs">
                    {comment.user?.name?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[color:var(--color-text)]">
                      {comment.user?.name || "Usuário"}
                    </h4>
                    <span className="text-xs text-[color:var(--color-text-muted)]">
                      {new Date(comment.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="p-2 text-[color:var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-sm text-[color:var(--color-text)] whitespace-pre-wrap">
                {comment.comment_text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

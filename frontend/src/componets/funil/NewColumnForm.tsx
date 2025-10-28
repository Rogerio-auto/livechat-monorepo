import { useState } from "react";
import type { Column } from "../../pages/funil/types";

type Props = {
  apiBase: string;
  boardId: string;
  onCreated: (col: Column) => void;
  onCancel: () => void;
};

export function NewColumnForm({ apiBase, boardId, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/kanban/boards/${boardId}/columns`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Falha (HTTP ${res.status})`);
      }
      const created: Column = await res.json();
      onCreated(created);
      setName("");
    } catch (err: any) {
      alert(err?.message || "Erro ao criar coluna");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/5 shadow-sm w-200px">
      <h3 className="font-semibold text-zinc-800 mb-3">Nova coluna</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-600 mb-1">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
            placeholder="Ex.: Qualificação"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-600 mb-1">Cor</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-12 rounded border border-zinc-300"
              title="Cor da coluna"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none"
              placeholder="#6B7280"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg bg-zinc-100 hover:bg-zinc-200">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </form>
  );
}

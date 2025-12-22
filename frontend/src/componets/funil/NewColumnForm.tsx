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
    <form onSubmit={handleCreate} className="rounded-xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-md">
      <h3 className="font-black text-slate-900 dark:text-slate-100 mb-4 uppercase tracking-widest text-[10px]">Nova coluna</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
            placeholder="Ex.: Qualificação"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Cor</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
              title="Cor da coluna"
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
              placeholder="#6B7280"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button" 
            onClick={onCancel} 
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 shadow-lg shadow-emerald-200 dark:shadow-none transition-all"
          >
            {loading ? "Criando..." : "Criar Coluna"}
          </button>
        </div>
      </div>
    </form>
  );
}


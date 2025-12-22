import { useEffect, useMemo, useState } from "react";
import type { LeadListItem } from "../../pages/funil/types";

type Props = {
  apiBase: string;
  onSelect: (lead: LeadListItem) => void;
  onCreateNew: () => void;
};

export function LeadPicker({ apiBase, onSelect, onCreateNew }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/leads`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as any[];
        setItems(data as LeadListItem[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return items;
    return items.filter(
      (i) => (i.name || "").toLowerCase().includes(k) || (i.email || "").toLowerCase().includes(k),
    );
  }, [q, items]);

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar lead por nome ou email..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
          />
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 dark:shadow-none whitespace-nowrap"
        >
          Novo lead
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="px-3 py-6 text-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="text-xs text-slate-500 mt-2">Carregando leads...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500">
            Nenhum lead encontrado
          </div>
        ) : (
          filtered.slice(0, 50).map((l) => (
            <button 
              key={l.id} 
              onClick={() => onSelect(l)} 
              className="w-full text-left px-3 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors group"
            >
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{l.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{l.email || "sem e-mail"}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

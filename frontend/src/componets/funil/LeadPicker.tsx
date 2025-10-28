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
    <div className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-black/5 p-2">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar lead por nome ou email"
          className="flex-1 bg-transparent outline-none text-sm px-2 py-1"
        />
        <button
          type="button"
          onClick={onCreateNew}
          className="px-2 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Novo lead
        </button>
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-zinc-200/70">
        {loading ? (
          <div className="px-2 py-3 text-sm text-zinc-600">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="px-2 py-3 text-sm text-zinc-600">Nenhum lead encontrado</div>
        ) : (
          filtered.slice(0, 50).map((l) => (
            <button key={l.id} onClick={() => onSelect(l)} className="w-full text-left px-2 py-2 hover:bg-emerald-50">
              <div className="text-sm font-medium text-zinc-800">{l.name}</div>
              <div className="text-xs text-zinc-600">{l.email || "sem e-mail"}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

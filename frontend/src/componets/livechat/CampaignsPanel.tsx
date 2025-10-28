// src/pages/componets/livechat/CampaignsPanel.tsx
// src/componets/livechat/CampaignsPanel.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import CampaignEditorDrawer from "./CampaignEditorDrawer";
import type { Campaign } from "../../types/types";




type Template = { id: string; name: string; kind: string };

type PagePayload = {
  items: Campaign[];
  total: number;
  limit: number;
  offset: number;
};

export default function CampaignsPanel({ apiBase }: { apiBase: string }) {
  const limit = 20;
  const [items, setItems] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  // Cache local por página (offset -> payload)
  const pagesRef = useRef<Map<number, PagePayload>>(new Map());
  const loadedOffsetsRef = useRef<Set<number>>(new Set());
  const totalRef = useRef<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef<boolean>(false);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...(init || {}),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
  }

  const mergeItems = useCallback((page: PagePayload) => {
    pagesRef.current.set(page.offset, page);
    totalRef.current = page.total;

    const seen = new Set<string>();
    const merged: Campaign[] = [];
    const allPages = Array.from(pagesRef.current.values()).sort((a, b) => (a.offset - b.offset));
    for (const p of allPages) {
      for (const c of p.items) {
        if (c && !seen.has(c.id)) {
          seen.add(c.id);
          merged.push(c);
        }
      }
    }
    setItems(merged);
  }, []);

  const loadPage = useCallback(
    async (offset: number) => {
      if (loadedOffsetsRef.current.has(offset)) return; // cache local
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await fetchJson<PagePayload>(
          `${apiBase}/livechat/campaigns?limit=${limit}&offset=${offset}`
        );
        loadedOffsetsRef.current.add(offset);
        mergeItems(page);
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar campanhas");
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [apiBase, limit, mergeItems]
  );

  // inicial
  useEffect(() => {
    loadPage(0);
    // templates (pequeno - sem paginação)
    fetchJson<Template[]>(`${apiBase}/livechat/campaigns/templates`)
      .then((ts) => setTemplates(Array.isArray(ts) ? ts : []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // Sentinela p/ infinito
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) return;

      const loaded = Array.from(loadedOffsetsRef.current.values()).length;
      const nextOffset = loaded * limit;
      if (nextOffset < (totalRef.current || 0)) {
        loadPage(nextOffset);
      }
    }, { rootMargin: "400px" });

    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, limit]);

  async function createDraft() {
    setError(null);
    try {
      const body = {
        name: `Campanha ${new Date().toLocaleString()}`,
        type: "BROADCAST",
        inbox_id: null,
        rate_limit_per_minute: 30,
        auto_handoff: false,
      };
      const c = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      pagesRef.current.clear();
      loadedOffsetsRef.current.clear();
      totalRef.current = 0;
      setItems((prev) => [c, ...prev]);
      await loadPage(0);
      // já abre o editor da recém-criada
      setEditing(c);
      setEditorOpen(true);
    } catch (e: any) {
      setError(e?.message || "Falha ao criar campanha");
    }
  }

  const call = async (id: string, path: "preview"|"commit"|"dispatch") => {
    setError(null);
    try {
      const url = `${apiBase}/livechat/campaigns/${id}/${path}`;
      const method = path === "preview" ? "GET" : "POST";
      const data = await fetchJson<any>(url, { method });
      if (path !== "preview") {
        // commit/dispatch: refaz primeira página (servidor já invalida versão)
        pagesRef.current.clear();
        loadedOffsetsRef.current.clear();
        totalRef.current = 0;
        await loadPage(0);
      }
      alert(
        path === "preview" ? "Pré-visualização gerada."
        : path === "commit" ? `Audiência materializada. ${JSON.stringify(data)}`
        : `Disparo iniciado. ${JSON.stringify(data)}`
      );
    } catch (e: any) {
      setError(e?.message || `Falha em ${path}`);
    }
  };

  const openEditor = (c: Campaign) => {
    setEditing(c);
    setEditorOpen(true);
  };

  const onSaved = (updated: Campaign | null) => {
    setEditorOpen(false);
    if (!updated) return;
    // atualiza no cache local
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
  };

  return (
    <div className="flex-1 grid grid-rows-[auto,1fr] gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-heading)]">Campanhas</h2>
        <button
          onClick={createDraft}
          className="rounded border border-[color:var(--color-primary)]/45 bg-[color:var(--color-primary)]/15 px-3 py-1.5 text-xs font-medium text-[var(--color-highlight)]"
        >
          + Nova campanha
        </button>
      </div>

      <div className="overflow-auto divide-y divide-[color:var(--color-border)] rounded-xl border border-[color:var(--color-border)]">
        {error && <div className="p-4 text-xs text-red-400">Erro: {error}</div>}
        {items.length === 0 && !loading && !error && (
          <div className="p-4 text-sm text-[var(--color-text-muted)]">Nenhuma campanha ainda.</div>
        )}

        {items.map((c) => (
          <div key={c.id} className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">{c.type} · {c.status}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]"
                onClick={() => openEditor(c)}>
                Editar
              </button>
              <button className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]"
                onClick={() => call(c.id, "preview")}>
                Pré-visualizar
              </button>
              <button className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]"
                onClick={() => call(c.id, "commit")}>
                Commit audiência
              </button>
              <button className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]"
                onClick={() => call(c.id, "dispatch")}>
                Disparar agora
              </button>
            </div>
          </div>
        ))}

        <div ref={sentinelRef} className="h-10 w-full flex items-center justify-center">
          {loading && <span className="text-[11px] text-[var(--color-text-muted)] py-2">Carregando…</span>}
        </div>
      </div>

      {editorOpen && editing && (
        <CampaignEditorDrawer
          apiBase={apiBase}
          campaign={editing}
          templates={templates}
          onClose={() => setEditorOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";

export function LabelsManager({ apiBase }: { apiBase: string }) {
  const [tags, setTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Array<{ id: string; title: string; color: string; position: number }>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [createColumn, setCreateColumn] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error((payload as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const load = async () => {
    try {
      setLoading(true);
      const rows = await fetchJson<Array<{ id: string; name: string; color?: string | null }>>(
        `${apiBase}/livechat/tags`
      );
      setTags(rows || []);
    } catch (e) {
      alert((e as any)?.message || "Falha ao listar labels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
      try {
        const b = await fetchJson<{ id: string; name: string }>(`${apiBase}/kanban/my-board`);
        setBoardId(b.id);
        const cols = await fetchJson<Array<{ id: string; title: string; color: string; position: number }>>(
          `${apiBase}/kanban/boards/${b.id}/columns`
        );
        setColumns(cols || []);
      } catch (e) {
        console.warn("Falha ao carregar colunas do Kanban", e);
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      setLoading(true);
      await fetchJson(`${apiBase}/livechat/tags`, {
        method: "POST",
        body: JSON.stringify({ name: n, color, createColumn }),
      });
      setName("");
      await load();
      // refresh columns if a column was created
      if (boardId) {
        const cols = await fetchJson<Array<{ id: string; title: string; color: string; position: number }>>(
          `${apiBase}/kanban/boards/${boardId}/columns`
        );
        setColumns(cols || []);
      }
    } catch (e) {
      alert((e as any)?.message || "Falha ao criar label");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-heading)]">Labels</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Crie labels e, se preferir, já provisiona a coluna no Kanban.</p>
      </div>

      <div className="mb-6 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 p-4 shadow-[0_18px_40px_-35px_rgba(8,12,20,0.9)] transition-colors duration-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Nome</label>
            <input
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/60 px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Qualificado"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Cor</label>
            <div className="flex items-center gap-2">
              <input type="color" className="h-9 w-12 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" value={color} onChange={(e) => setColor(e.target.value)} />
              <input
                className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/60 px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="chk-col" type="checkbox" className="h-4 w-4 rounded border-[color:var(--color-border)] accent-[var(--color-primary)]" checked={createColumn} onChange={(e) => setCreateColumn(e.target.checked)} />
            <label htmlFor="chk-col" className="text-sm text-[var(--color-text)]">Criar coluna no Kanban</label>
          </div>
        </div>
        <div className="mt-3">
          <button
            disabled={loading}
            onClick={create}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-strong)] disabled:opacity-60"
          >
            Criar label
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Labels existentes</h3>
        {loading ? (
          <div className="text-sm text-[var(--color-text-muted)]">Carregando...</div>
        ) : tags.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">Nenhuma label ainda</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tags.map((t) => {
              const hasColumn = (columns || []).some((c) => (c.title || '').toLowerCase() === t.name.toLowerCase());
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 text-[var(--color-text)]">
                    <span className="inline-block h-3.5 w-3.5 rounded" style={{ backgroundColor: t.color || '#6B7280' }} />
                    <span className="text-sm text-[var(--color-heading)] truncate">{t.name}</span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${hasColumn ? 'bg-[color:color-mix(in srgb,var(--color-highlight) 18%,transparent)] text-[var(--color-highlight)]' : 'bg-[color:var(--color-bg)]/55 text-[var(--color-text-muted)]'}`}>
                    {hasColumn ? 'coluna' : 'sem coluna'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Colunas do Kanban</h3>
        {!boardId ? (
          <div className="text-sm text-[var(--color-text-muted)]">Carregando board...</div>
        ) : (columns || []).length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">Nenhuma coluna</div>
        ) : (
          <div className="space-y-2">
            {(columns || []).map((col) => (
              <EditableColumnRow key={col.id} apiBase={apiBase} column={col} onSaved={(u) => setColumns((prev) => prev.map((c) => (c.id === u.id ? u : c)))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditableColumnRow({ apiBase, column, onSaved }: { apiBase: string; column: { id: string; title: string; color: string; position: number }; onSaved: (c: { id: string; title: string; color: string; position: number }) => void }) {
  const [title, setTitle] = useState(column.title);
  const [color, setColor] = useState(column.color || '#6B7280');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${apiBase}/kanban/columns/${column.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, color })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      onSaved(updated as any);
    } catch (e) {
      alert((e as any)?.message || 'Falha ao salvar coluna');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/95 px-3 py-2">
      <input className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)]/60 px-2 py-1 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="color" className="h-8 w-12 rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" value={color} onChange={(e) => setColor(e.target.value)} />
      <button disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-[var(--color-primary)] text-sm font-medium text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-strong)] disabled:opacity-60">Salvar</button>
      <span className="text-[10px] text-[var(--color-text-muted)] ml-1">pos {column.position}</span>
    </div>
  );
}

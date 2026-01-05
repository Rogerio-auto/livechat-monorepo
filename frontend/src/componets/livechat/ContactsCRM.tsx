import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../../utils/api";

/* ================== Types ================== */
type Contact = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
  notes?: string | null;
};

type Inbox = { id: string; name: string };

/* ================== Helpers ================== */
function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function linkOrDash(v?: string | null) {
  return v && v.trim() ? v.trim() : "-";
}

function useDebounced<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ================== Component ================== */
export function ContactsCRM({ apiBase, socket }: { apiBase: string; socket?: Socket | null }) {
  const navigate = useNavigate();


  // List state
  const [items, setItems] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters / query
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const dq = useDebounced(q);
  const dcity = useDebounced(city);
  const duf = useDebounced(uf);

  // Selection / form
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [baseline, setBaseline] = useState<Partial<Contact> | null>(null);

  // Inboxes
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [inboxId, setInboxId] = useState("");

  // UI flags
  const [loadingList, setLoadingList] = useState(false);
  const [loadingOne, setLoadingOne] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const base = apiBase.replace(/\/$/, "");

  // New contact modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Contact>>({ name: "", phone: "", email: "", instagram: "", facebook: "", twitter: "", telegram: "", website: "", notes: "" });

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const token = getAccessToken();
    const headers = new Headers(init?.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("Content-Type", "application/json");

    const res = await fetch(url, { 
      credentials: "include", 
      ...init,
      headers,
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const p = await res.json(); msg = (p as any)?.error || msg; } catch { }
      throw new Error(msg);
    }
    return res.json();
  };

  const loadList = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));
      if (dq.trim()) params.set("q", dq.trim());
      if (dcity.trim()) params.set("city", dcity.trim());
      if (duf.trim()) params.set("uf", duf.trim());

      const resp = await fetchJson<{ items: Contact[]; total: number }>(
        `${base}/livechat/contacts?${params.toString()}`
      );
      setItems(resp.items || []);
      setTotal(resp.total || 0);
    } finally {
      setLoadingList(false);
    }
  };

  const loadOne = async (id: string) => {
    setLoadingOne(true);
    try {
      const contact = await fetchJson<Contact>(`${base}/livechat/contacts/${encodeURIComponent(id)}`);
      setForm(contact || {});
      setBaseline(contact || {});
    } finally {
      setLoadingOne(false);
    }
  };

  useEffect(() => {
    fetchJson<Inbox[]>(`${apiBase}/livechat/inboxes/my`).then(setInboxes).catch(() => setInboxes([]));
  }, [apiBase]);

  useEffect(() => { loadList().catch(() => { }); }, [page, dq, dcity, duf]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = () => { loadList().catch(() => { }); };
    const onUpdated = () => { loadList().catch(() => { }); };
    socket.on("crm:contact:created", onCreated);
    socket.on("crm:contact:updated", onUpdated);
    return () => {
      socket.off("crm:contact:created", onCreated);
      socket.off("crm:contact:updated", onUpdated);
    };
  }, [socket, page, dq, dcity, duf]);

  const expand = (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setForm({});
    setBaseline(null);
    loadOne(id).catch(() => { });
  };

  const dirty = useMemo(() => {
    if (!baseline) return false;
    try {
      return JSON.stringify(form ?? {}) !== JSON.stringify(baseline ?? {});
    } catch {
      return true;
    }
  }, [form, baseline]);

  const save = async () => {
    if (!expanded || !dirty) return;
    setSaving(true);
    try {
      await fetchJson(`${base}/livechat/contacts/${encodeURIComponent(expanded)}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      await loadList();
      setBaseline(form);
    } finally {
      setSaving(false);
    }
  };

  // 5) CRIAR — POST /livechat/contacts
  const createNew = async () => {
    try {
      const created = await fetchJson<{ id: string }>(`${base}/livechat/contacts`, {
        method: "POST",
        body: JSON.stringify(newForm),
      });
      setShowNewModal(false);
      setExpanded(created.id);
      await loadList();
      await loadOne(created.id);
      setNewForm({ name: "", phone: "", email: "", instagram: "", facebook: "", twitter: "", telegram: "", website: "", notes: "" });
    } catch { }
  };

  const startChat = async () => {
    if (!expanded) return;
    if (!inboxId) { alert("Selecione uma inbox"); return; }
    setStartingChat(true);
    try {
      const resp = await fetchJson<{ id: string }>(
        `${base}/livechat/contacts/${encodeURIComponent(expanded)}/start-chat`,
        { method: "POST", body: JSON.stringify({ inboxId }) }
      );
      if (resp?.id) navigate(`/livechat/${resp.id}`);
    } finally {
      setStartingChat(false);
    }
  };

  /* ================== Render ================== */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-xl border border-(--color-border) bg-(--color-surface)/95 overflow-hidden shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] transition-colors duration-300">
      {/* Header / Filters */}
      <div className="sticky top-0 z-10 border-b border-(--color-border) bg-(--color-surface)/90 backdrop-blur px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold text-(--color-heading)">Contatos</div>
          <div className="text-sm text-(--color-text-muted)">{total} no total</div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="rounded-lg border border-(--color-border) bg-(--color-bg)/60 px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
            placeholder="Buscar por nome, telefone, email..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          <input
            className="rounded-lg border border-(--color-border) bg-(--color-bg)/60 px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
            placeholder="Cidade"
            value={city}
            onChange={(e) => { setCity(e.target.value); setPage(1); }}
          />
          <input
            className="bg-(--color-surface)/95 border border-(--color-border) rounded-lg px-3 py-2 text-sm w-full sm:w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="UF"
            value={uf}
            onChange={(e) => { setUf(e.target.value.toUpperCase()); setPage(1); }}
            maxLength={2}
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => { setQ(""); setCity(""); setUf(""); setPage(1); }}
            className="rounded-lg border border-(--color-border) px-3 py-1.5 text-xs text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55"
          >
            Limpar filtros
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded-lg bg-(--color-primary) px-3 py-1.5 text-xs font-semibold text-(--color-on-primary) transition-colors duration-150 hover:bg-(--color-primary-strong)"
          >
            Adicionar contato
          </button>
        </div>
      </div>

      {/* List */}
      <div className="p-4">
        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-(--color-border) bg-(--color-bg)/55 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-(--color-text-muted)">
            <div className="text-lg font-medium">Nenhum contato encontrado</div>
            <div className="text-sm">Ajuste os filtros ou crie um novo contato.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((c) => (
              <div key={c.id} className="rounded-xl border border-(--color-border) bg-(--color-surface)/95 shadow-[0_18px_40px_-35px_rgba(8,12,20,0.9)] transition-colors duration-300">
                <button
                  className="w-full text-left flex items-center gap-3 p-4 transition-colors duration-150 hover:bg-(--color-bg)/55"
                  onClick={() => expand(c.id)}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[color:color-mix(in srgb,var(--color-highlight) 22%,transparent)] text-(--color-heading) text-sm font-bold">
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-(--color-heading) truncate">{c.name}</div>
                    <div className="text-xs text-(--color-text-muted) truncate">{linkOrDash(c.phone) || linkOrDash(c.email)}</div>
                  </div>
                  <span className="text-xs text-(--color-text-muted) rounded bg-(--color-bg)/55 px-2 py-0.5">
                    {expanded === c.id ? "Fechar" : "Abrir"}
                  </span>
                </button>

                {expanded === c.id && (
                  <div className="border-t border-(--color-border) bg-(--color-bg)/40 p-4">
                    {loadingOne ? (
                      <div className="h-40 rounded-lg bg-(--color-bg)/55 animate-pulse" />
                    ) : (
                      <div className="flex flex-col gap-4">
                        {/* Quick info grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {([
                            ["name", "Nome"],
                            ["phone", "Telefone"],
                            ["email", "E-mail"],
                            ["instagram", "Instagram"],
                            ["facebook", "Facebook"],
                            ["twitter", "Twitter"],
                            ["telegram", "Telegram"],
                            ["website", "Website"],
                          ] as const).map(([k, label]) => (
                            <div key={k}>
                              <label className="block text-xs text-(--color-text-muted) mb-1">{label}</label>
                              <input
                                className="w-full rounded-lg border border-(--color-border) bg-(--color-bg)/60 px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                                value={(form as any)[k] || ""}
                                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>

                        <div>
                          <label className="block text-xs text-(--color-text-muted) mb-1">Observações</label>
                          <textarea
                            className="w-full rounded-lg border border-(--color-border) bg-(--color-bg)/60 px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                            rows={3}
                            value={form.notes || ""}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                        </div>

                        {/* Actions row */}
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                          <div className="flex items-end gap-3 flex-wrap">
                            <div>
                              <label className="block text-xs text-(--color-text-muted) mb-1">Inbox</label>
                              <select
                                className="rounded-lg border border-(--color-border) bg-(--color-bg)/60 px-3 py-2 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                                value={inboxId}
                                onChange={(e) => setInboxId(e.target.value)}
                              >
                                <option value="">Selecione...</option>
                                {inboxes.map((i) => (
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="text-xs text-(--color-text-muted) self-center">
                              {dirty ? <span className="px-2 py-0.5 rounded bg-[color:color-mix(in srgb,var(--color-highlight) 20%,transparent)] text-(--color-highlight)">Alterações não salvas</span> : <span className="px-2 py-0.5 rounded bg-[color:color-mix(in srgb,var(--color-primary) 18%,transparent)] text-(--color-heading)">Tudo salvo</span>}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={save}
                              disabled={!dirty || saving}
                              className={cls(
                                "px-3 py-2 rounded-lg text-sm border",
                                dirty ? "bg-[color:color-mix(in srgb,var(--color-highlight) 18%,transparent)] border-[color:color-mix(in srgb,var(--color-highlight) 45%,transparent)] hover:bg-[color:color-mix(in srgb,var(--color-highlight) 26%,transparent)]" : "bg-(--color-bg)/55 border-(--color-border) text-(--color-text-muted) cursor-not-allowed"
                              )}
                            >
                              {saving ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              onClick={startChat}
                              disabled={!inboxId || startingChat}
                              className={cls(
                                "px-3 py-2 rounded-lg text-sm text-(--color-on-primary) transition-colors duration-150",
                                !inboxId || startingChat ? "bg-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]/60 cursor-not-allowed" : "bg-(--color-primary) hover:bg-(--color-primary-strong)"
                              )}
                            >
                              {startingChat ? "Abrindo..." : "Iniciar conversa"}
                            </button>
                          </div>
                        </div>

                        {/* Quick links */}
                        <div className="pt-2 border-t border-(--color-border) flex flex-wrap gap-2 text-xs text-(--color-text)">
                          {form.phone && (
                            <a className="px-2 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55" href={`tel:${form.phone}`}>Ligar</a>
                          )}
                          {form.phone && (
                            <a className="px-2 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55" target="_blank" rel="noreferrer" href={`https://wa.me/${String(form.phone).replace(/\D/g, "")}`}>WhatsApp</a>
                          )}
                          {form.email && (
                            <a className="px-2 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55" href={`mailto:${form.email}`}>E-mail</a>
                          )}
                          {form.website && (
                            <a className="px-2 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55" target="_blank" rel="noreferrer" href={String(form.website).startsWith("http") ? String(form.website) : `https://${form.website}`}>Site</a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between text-sm text-(--color-text-muted)">
          <div>
            Mostrando {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(total, page * pageSize)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              className="px-3 py-1 rounded border border-(--color-border) text-(--color-text) transition-colors duration-150 hover:bg-(--color-bg)/55 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* New Contact Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: "color-mix(in srgb, var(--color-overlay) 80%, transparent)" }}
        >
          <div
            className="w-[min(720px,95vw)] rounded-xl border p-4 shadow-[0_32px_70px_-45px_rgba(8,12,20,0.95)] transition-colors duration-300"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "color-mix(in srgb, var(--color-surface) 95%, transparent)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="font-semibold"
                style={{ color: "var(--color-text)" }}
              >
                Novo contato
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="px-2 py-1 rounded transition-colors duration-150 hover:opacity-85"
                style={{ color: "var(--color-text)" }}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ["name", "Nome"],
                ["phone", "Telefone"],
                ["email", "E-mail"],
                ["instagram", "Instagram"],
                ["facebook", "Facebook"],
                ["twitter", "Twitter"],
                ["telegram", "Telegram"],
                ["website", "Website"],
              ] as const).map(([k, label]) => (
                <div key={k}>
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {label}
                  </label>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
                      color: "var(--color-text)",
                    }}
                    value={(newForm as any)[k] || ""}
                    onChange={(e) => setNewForm((f) => ({ ...f, [k]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="md:col-span-2">
                <label
                  className="block text-xs mb-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Observações
                </label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in srgb,var(--color-primary) 45%,transparent)]"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "color-mix(in srgb, var(--color-bg) 60%, transparent)",
                    color: "var(--color-text)",
                  }}
                  rows={3}
                  value={newForm.notes || ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-2 rounded-lg text-sm transition-colors duration-150 hover:opacity-85"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
                  color: "var(--color-text)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={createNew}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 hover:opacity-90"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


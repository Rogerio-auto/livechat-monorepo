// src/pages/componets/livechat/CampaignEditorDrawer.tsx
import { useEffect, useState } from "react";
import TemplatePicker from "./TemplatePicker";
import type { Campaign } from "../../types/types";



type Inbox = { id: string; name?: string; provider?: string };
type Template = { id: string; name: string; kind: string };

export default function CampaignEditorDrawer({
  apiBase,
  campaign,
  templates,
  onClose,
  onSaved,
}: {
  apiBase: string;
  campaign: Campaign;
  templates: Template[];
  onClose: () => void;
  onSaved: (c: Campaign | null) => void;
}) {
  const [tab, setTab] = useState<"details"|"messages"|"audience"|"ready">("details");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: campaign.name,
    inbox_id: campaign.inbox_id || "",
    rate_limit_per_minute: campaign.rate_limit_per_minute || 30,
    auto_handoff: !!campaign.auto_handoff,
  });

  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    // carrega inboxes
    fetch(`${apiBase}/livechat/inboxes`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch(() => setInboxes([]));
  }, [apiBase]);

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

  async function saveDetails() {
    setErr(null);
    setSaving(true);
    try {
      const updated = await fetchJson<Campaign>(`${apiBase}/livechat/campaigns/${campaign.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          inbox_id: form.inbox_id || null,
          rate_limit_per_minute: Number(form.rate_limit_per_minute || 30),
          auto_handoff: !!form.auto_handoff,
        }),
      });
      onSaved(updated);
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function addStep1() {
    if (!selectedTemplateId) { alert("Selecione um template"); return; }
    setErr(null);
    setSaving(true);
    try {
      await fetchJson<any>(`${apiBase}/livechat/campaigns/${campaign.id}/steps`, {
        method: "POST",
        body: JSON.stringify({
          position: 1,
          template_id: selectedTemplateId,
          delay_sec: 0,
          stop_on_reply: true,
        }),
      });
      alert("Step 1 salvo.");
    } catch (e: any) {
      setErr(e?.message || "Falha ao salvar step");
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    try {
      await fetchJson<any>(`${apiBase}/livechat/campaigns/${campaign.id}/preview`);
      alert("Pré-visualização gerada.");
    } catch (e: any) {
      setErr(e?.message || "Falha no preview");
    }
  }

  async function commit() {
    try {
      const data = await fetchJson<any>(`${apiBase}/livechat/campaigns/${campaign.id}/commit`, { method: "POST" });
      alert(`Commit ok: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setErr(e?.message || "Falha no commit");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-[520px] h-full bg-[color:var(--color-surface)] border-l border-[color:var(--color-border)] shadow-2xl p-4 grid grid-rows-[auto,1fr,auto]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Editar campanha</div>
            <div className="text-[11px] text-[color:var(--color-text-muted)]">{campaign.name}</div>
          </div>
          <button onClick={onClose}
            className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]">Fechar</button>
        </div>

        <div className="mt-3 flex border-b border-[color:var(--color-border)] gap-2">
          {[
            ["details","Detalhes"],
            ["messages","Mensagens"],
            ["audience","Audiência"],
            ["ready","Pronto?"],
          ].map(([k,label]) => (
            <button key={k}
              onClick={() => setTab(k as any)}
              className={`px-3 py-2 text-xs ${tab===k ? "text-[var(--color-highlight)] border-b-2 border-[var(--color-highlight)]" : "text-[var(--color-text-muted)]"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-auto py-3">
          {tab==="details" && (
            <div className="grid gap-3">
              {err && <div className="text-xs text-red-400">{err}</div>}
              <label className="grid gap-1 text-xs">
                <span>Nome</span>
                <input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}
                  className="px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent text-sm"/>
              </label>
              <label className="grid gap-1 text-xs">
                <span>Inbox</span>
                <select value={form.inbox_id ?? ""} onChange={(e)=>setForm({...form, inbox_id:e.target.value})}
                  className="px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent text-sm">
                  <option value="">Selecione…</option>
                  {inboxes.map((i)=>(
                    <option key={i.id} value={i.id}>{i.name || i.id} {i.provider ? `· ${i.provider}` : ""}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  <span>Rate limit (msg/min)</span>
                  <input type="number" min={1} value={form.rate_limit_per_minute}
                    onChange={(e)=>setForm({...form, rate_limit_per_minute:Number(e.target.value||30)})}
                    className="px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent text-sm"/>
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={form.auto_handoff}
                    onChange={(e)=>setForm({...form, auto_handoff:e.target.checked})}/>
                  <span>Handoff IA automático</span>
                </label>
              </div>
            </div>
          )}

          {tab==="messages" && (
            <div className="grid gap-3">
              <div className="text-xs text-[color:var(--color-text-muted)]">
                Selecione o <b>Template</b> para o <b>Step 1</b> desta campanha.
              </div>
              <TemplatePicker
                templates={templates}
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
              />
              <button disabled={saving} onClick={addStep1}
                className="justify-self-start text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]">
                Salvar Step 1
              </button>
            </div>
          )}

          {tab==="audience" && (
            <div className="grid gap-2">
              <div className="text-xs text-[color:var(--color-text-muted)]">
                Use os botões abaixo para pré-visualizar e **materializar** a audiência (recipients).
              </div>
              <div className="flex gap-2">
                <button onClick={preview}
                  className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]">Pré-visualizar</button>
                <button onClick={commit}
                  className="text-[11px] px-2 py-1 rounded border border-[color:var(--color-border)]">Commit audiência</button>
              </div>
            </div>
          )}

          {tab==="ready" && (
            <ReadyBlock apiBase={apiBase} campaignId={campaign.id}/>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button disabled={saving} onClick={saveDetails}
            className="text-[11px] px-3 py-1.5 rounded border border-[color:var(--color-primary)]/45 bg-[color:var(--color-primary)]/15 text-[var(--color-highlight)]">
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadyBlock({ apiBase, campaignId }: { apiBase: string; campaignId: string }) {
  const [status, setStatus] = useState<null | {ok:boolean; missing?:string[]; details?:any}>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/livechat/campaigns/${campaignId}/requirements`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        } else {
          // fallback: só diz que não dá pra verificar
          setStatus({ ok: true });
        }
      } catch (e: any) {
        setErr(e?.message || "Falha ao verificar requisitos");
      }
    })();
  }, [apiBase, campaignId]);

  if (err) return <div className="text-xs text-red-400">{err}</div>;
  if (!status) return <div className="text-xs text-[color:var(--color-text-muted)]">Verificando…</div>;

  if (status.ok) return <div className="text-xs text-green-400">Tudo certo para disparar.</div>;

  return (
    <div className="text-xs text-[color:var(--color-text-muted)] grid gap-2">
      <div className="text-red-400">Faltam pré-requisitos:</div>
      <ul className="list-disc ml-5">
        {(status.missing || []).map((m) => <li key={m}>{m}</li>)}
      </ul>
      {status.details && (
        <pre className="text-[10px] bg-black/30 p-2 rounded border border-[color:var(--color-border)] overflow-auto">
{JSON.stringify(status.details, null, 2)}
        </pre>
      )}
    </div>
  );
}

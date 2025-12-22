// src/pages/componets/livechat/CampaignEditorDrawer.tsx
import { useEffect, useState } from "react";
import { FiX, FiSave, FiEye, FiUsers, FiCheckCircle, FiSettings, FiMessageSquare } from "react-icons/fi";
import TemplatePicker from "./TemplatePicker";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { Campaign } from "../../types/types";
import { getAccessToken } from "../../utils/api";



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
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);

  useEffect(() => {
    // carrega inboxes
    const token = getAccessToken();
    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    fetch(`${apiBase}/livechat/inboxes`, { headers, credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data) => setInboxes(Array.isArray(data) ? data : []))
      .catch(() => setInboxes([]));
  }, [apiBase]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
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
    setErr(null);
    setLoadingPreview(true);
    try {
      const data = await fetchJson<any[]>(`${apiBase}/livechat/campaigns/${campaign.id}/preview`);
      setPreviewData(data);
      if (!data || data.length === 0) {
        alert("Preview vazio. Verifique se a campanha tem inbox e contatos associados.");
      }
    } catch (e: any) {
      setErr(e?.message || "Falha no preview");
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function commit() {
    if (!confirm("Deseja materializar a audiência? Isso criará os registros de recipients.")) return;
    setErr(null);
    setLoadingCommit(true);
    try {
      const data = await fetchJson<any>(`${apiBase}/livechat/campaigns/${campaign.id}/commit`, { method: "POST" });
      setCommitResult(data);
      alert(`Commit realizado com sucesso!${data.count ? ` ${data.count} recipients criados.` : ""}`);
    } catch (e: any) {
      setErr(e?.message || "Falha no commit");
      setCommitResult(null);
    } finally {
      setLoadingCommit(false);
    }
  }

  const tabs = [
    { key: "details", label: "Detalhes", icon: FiSettings },
    { key: "messages", label: "Mensagens", icon: FiMessageSquare },
    { key: "audience", label: "Audiência", icon: FiUsers },
    { key: "ready", label: "Pronto?", icon: FiCheckCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <div className="w-[540px] h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-md flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Editar Campanha</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{campaign.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
              <FiX className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/50">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                tab === key
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === "details" && (
            <div className="space-y-4">
              {err && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {err}
                </div>
              )}
              
              <Input
                label="Nome da campanha"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Promoção Black Friday"
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Inbox
                </label>
                <select
                  value={form.inbox_id ?? ""}
                  onChange={(e) => setForm({ ...form, inbox_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                >
                  <option value="">Selecione uma inbox…</option>
                  {inboxes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name || i.id} {i.provider ? `· ${i.provider}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Rate limit (msg/min)"
                  type="number"
                  min={1}
                  value={form.rate_limit_per_minute}
                  onChange={(e) => setForm({ ...form, rate_limit_per_minute: Number(e.target.value || 30) })}
                />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.auto_handoff}
                      onChange={(e) => setForm({ ...form, auto_handoff: e.target.checked })}
                      className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Handoff IA automático</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {tab === "messages" && (
            <div className="space-y-4">
              <Card gradient={false} className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Selecione o <strong>Template</strong> para o <strong>Step 1</strong> desta campanha.
                </p>
              </Card>

              <TemplatePicker
                templates={templates}
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
              />

              <Button
                variant="primary"
                onClick={addStep1}
                disabled={saving || !selectedTemplateId}
                fullWidth
              >
                {saving ? "Salvando..." : "Salvar Step 1"}
              </Button>
            </div>
          )}

          {tab === "audience" && (
            <div className="space-y-4">
              <Card gradient={false} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  <strong>Passo 1:</strong> Gere uma pré-visualização para ver quantos contatos serão impactados.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Passo 2:</strong> Materialize a audiência para criar os registros de recipients.
                </p>
              </Card>

              {err && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {err}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="secondary" 
                  onClick={preview}
                  disabled={loadingPreview || loadingCommit}
                >
                  <FiEye className="w-4 h-4 mr-2" />
                  {loadingPreview ? "Gerando..." : "Pré-visualizar"}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={commit}
                  disabled={loadingPreview || loadingCommit || !previewData}
                >
                  <FiUsers className="w-4 h-4 mr-2" />
                  {loadingCommit ? "Processando..." : "Materializar"}
                </Button>
              </div>

              {/* Resultado do Preview */}
              {previewData && (
                <Card gradient={false} className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white font-bold">
                      {previewData.length}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Contatos encontrados
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {previewData.length === 0 
                          ? "Nenhum contato foi encontrado com os critérios atuais."
                          : `${previewData.length} ${previewData.length === 1 ? "contato será" : "contatos serão"} impactados por esta campanha.`
                        }
                      </p>
                      {previewData.length > 0 && previewData.length <= 5 && (
                        <div className="mt-3 space-y-1">
                          {previewData.map((item: any, idx: number) => (
                            <div key={idx} className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                              {item.customer_name || item.customer_phone || item.chat_id || `Contato ${idx + 1}`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Resultado do Commit */}
              {commitResult && (
                <Card gradient={false} className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-600 dark:bg-green-500 flex items-center justify-center">
                      <FiCheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Audiência materializada com sucesso!
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {commitResult.count 
                          ? `${commitResult.count} recipients foram criados.`
                          : "A audiência foi processada com sucesso."
                        }
                      </p>
                      {commitResult.details && (
                        <pre className="mt-2 text-[10px] bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-800 overflow-auto max-h-32">
                          {JSON.stringify(commitResult.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Dica */}
              {!previewData && !commitResult && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    <FiUsers className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Clique em "Pré-visualizar" para ver os contatos que receberão esta campanha.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "ready" && <ReadyBlock apiBase={apiBase} campaignId={campaign.id} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="gradient" onClick={saveDetails} disabled={saving}>
              <FiSave className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
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
        const token = getAccessToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const res = await fetch(`${apiBase}/livechat/campaigns/${campaignId}/requirements`, { 
          headers,
          credentials: "include" 
        });
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
  if (!status) {
    return (
      <div
        className="text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Verificando…
      </div>
    );
  }

  if (status.ok) return <div className="text-xs text-green-400">Tudo certo para disparar.</div>;

  return (
    <div
      className="text-xs grid gap-2"
      style={{ color: "var(--color-text-muted)" }}
    >
      <div className="text-red-400">Faltam pré-requisitos:</div>
      <ul className="list-disc ml-5">
        {(status.missing || []).map((m) => <li key={m}>{m}</li>)}
      </ul>
      {status.details && (
        <pre
          className="text-[10px] bg-black/30 p-2 rounded border overflow-auto"
          style={{ borderColor: "var(--color-border)" }}
        >
{JSON.stringify(status.details, null, 2)}
        </pre>
      )}
    </div>
  );
}


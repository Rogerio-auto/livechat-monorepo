import { useCallback, useEffect, useMemo, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import type { AgentTemplate, AgentTemplateQuestion } from "@livechat/shared";
import { TemplateToolsManager } from "./TemplateToolsManager";

const CARD = "rounded-xl shadow-sm p-6 bg-(--color-surface) text-(--color-text) border border-(--color-border)";
const INPUT = "w-full rounded-xl px-3 py-2 disabled:opacity-70 border border-(--color-border) bg-(--color-surface-muted) text-(--color-text)";
const TEXTAREA = "w-full min-h-[140px] rounded-xl px-3 py-2 disabled:opacity-70 border border-(--color-border) bg-(--color-surface-muted) text-(--color-text)";
const BTN = "px-3 py-2 rounded-lg disabled:opacity-60 bg-(--color-surface-muted) text-(--color-text) border border-(--color-border) hover:bg-(--color-surface)";
const BTN_PRIMARY = "px-3 py-2 rounded-lg disabled:opacity-60 bg-(--color-primary) text-(--color-on-primary) hover:bg-(--color-highlight)";
const LABEL = "block text-sm text-(--color-text-muted) mb-1";

type EditorState = {
  id?: string;
  key: string;
  name: string;
  category: string;
  description: string;
  prompt_template: string;
  default_model: string;
  default_model_params: string; // JSON string
};

function toEditor(tpl?: AgentTemplate): EditorState {
  return {
    id: tpl?.id,
    key: tpl?.key || "",
    name: tpl?.name || "",
    category: tpl?.category || "",
    description: tpl?.description || "",
    prompt_template: tpl?.prompt_template || "",
    default_model: tpl?.default_model || "",
    default_model_params: JSON.stringify(tpl?.default_model_params || {}, null, 2),
  };
}

export default function TemplatesAdminPanel() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editor, setEditor] = useState<EditorState>(toEditor());
  const [saving, setSaving] = useState(false);

  const [questions, setQuestions] = useState<AgentTemplateQuestion[]>([]);
  const [qForm, setQForm] = useState<Partial<AgentTemplateQuestion>>({ type: "text", required: false, order_index: 0 });
  const [qSaving, setQSavings] = useState(false);
  
  const [showToolsManager, setShowToolsManager] = useState(false);

  const companyTemplates = useMemo(
    () => templates.filter((t) => t.company_id !== null),
    [templates],
  );

  const globalTemplates = useMemo(
    () => templates.filter((t) => t.company_id === null),
    [templates],
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const list = await fetchJson<AgentTemplate[]>(`${API}/api/agent-templates`);
      setTemplates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar templates");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setError(null);
    try {
      const detail = await fetchJson<AgentTemplate & { questions: AgentTemplateQuestion[] }>(`${API}/api/agent-templates/${id}`);
      setEditor(toEditor(detail));
      setQuestions(detail.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar detalhe do template");
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const createTemplate = async () => {
    try {
      setSaving(true); setError(null);
      const payload = {
        key: editor.key.trim(),
        name: editor.name.trim(),
        category: editor.category.trim() || null,
        description: editor.description.trim() || null,
        prompt_template: editor.prompt_template,
        default_model: editor.default_model.trim() || null,
        default_model_params: JSON.parse(editor.default_model_params || "{}"),
        default_tools: [],
      };
      const created = await fetchJson<AgentTemplate>(`${API}/api/agent-templates`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTemplates((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar template");
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!editor.id) return;
    try {
      setSaving(true); setError(null);
      const patch: any = {
        key: editor.key.trim(),
        name: editor.name.trim(),
        category: editor.category.trim() || null,
        description: editor.description.trim() || null,
        prompt_template: editor.prompt_template,
        default_model: editor.default_model.trim() || null,
      };
      try { patch.default_model_params = JSON.parse(editor.default_model_params || "{}"); } catch {}
      const updated = await fetchJson<AgentTemplate>(`${API}/api/agent-templates/${editor.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar template");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!editor.id) return;
    if (!confirm("Deseja remover este template?")) return;
    try {
      setSaving(true); setError(null);
      await fetchJson(`${API}/api/agent-templates/${editor.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== editor.id));
      setSelectedId("");
      setEditor(toEditor());
      setQuestions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir template");
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async () => {
    if (!selectedId) return;
    try {
      setQSavings(true); setError(null);
      const payload = {
        key: (qForm.key || "").trim(),
        label: (qForm.label || "").trim(),
        type: (qForm.type as any) || "text",
        required: Boolean(qForm.required),
        help: (qForm.help as string) || null,
        options: Array.isArray(qForm.options) ? qForm.options : [],
        order_index: typeof qForm.order_index === "number" ? qForm.order_index : 0,
      };
      const created = await fetchJson<AgentTemplateQuestion>(`${API}/api/agent-templates/${selectedId}/questions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setQuestions((prev) => [...prev, created]);
      setQForm({ type: "text", required: false, order_index: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar pergunta");
    } finally {
      setQSavings(false);
    }
  };

  const removeQuestion = async (qid: string) => {
    if (!selectedId) return;
    try {
      await fetchJson(`${API}/api/agent-templates/${selectedId}/questions/${qid}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== qid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao remover pergunta");
    }
  };

  return (
    <section className={CARD}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-(--color-heading)">Templates de Agente (Admin)</h2>
          <p className="text-sm text-(--color-text-muted)">Crie e gerencie templates específicos da empresa. Templates globais são somente leitura.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={loadTemplates} disabled={loading}>
            {loading ? "Atualizando..." : "Recarregar"}
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            onClick={() => { setSelectedId(""); setEditor(toEditor()); setQuestions([]); }}
          >
            Novo template
          </button>
        </div>
      </div>

      {error && (
  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4">
            <h3 className="text-sm font-semibold text-(--color-heading) mb-2">Da empresa</h3>
            <ul className="space-y-1 text-sm">
              {companyTemplates.length === 0 && (
                <li className="text-(--color-text-muted)">Nenhum template da empresa</li>
              )}
              {companyTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-2 py-1 ${selectedId === t.id ? "bg-(--color-primary) text-(--color-on-primary)" : "hover:bg-(--color-highlight)"}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4">
            <h3 className="text-sm font-semibold text-(--color-heading) mb-2">Globais (somente leitura)</h3>
            <ul className="space-y-1 text-sm">
              {globalTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg px-2 py-1 ${selectedId === t.id ? "bg-(--color-surface)" : "hover:bg-(--color-surface-muted)"}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL}>Chave</label>
                <input className={INPUT} value={editor.key} onChange={(e)=>setEditor((p)=>({...p,key:e.target.value}))} placeholder="ex.: sales, support" />
              </div>
              <div>
                <label className={LABEL}>Nome</label>
                <input className={INPUT} value={editor.name} onChange={(e)=>setEditor((p)=>({...p,name:e.target.value}))} placeholder="ex.: Vendedor" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-3">
              <div>
                <label className={LABEL}>Categoria</label>
                <input className={INPUT} value={editor.category} onChange={(e)=>setEditor((p)=>({...p,category:e.target.value}))} placeholder="ex.: Comercial" />
              </div>
              <div>
                <label className={LABEL}>Modelo sugerido</label>
                <input className={INPUT} value={editor.default_model} onChange={(e)=>setEditor((p)=>({...p,default_model:e.target.value}))} placeholder="ex.: gpt-4o-mini" />
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Descrição</label>
              <textarea className={TEXTAREA} value={editor.description} onChange={(e)=>setEditor((p)=>({...p,description:e.target.value}))} />
            </div>
            <div className="mt-3">
              <label className={LABEL}>Prompt template</label>
              <textarea className={TEXTAREA} value={editor.prompt_template} onChange={(e)=>setEditor((p)=>({...p,prompt_template:e.target.value}))} placeholder="Use {{chaves}} para respostas do wizard" />
            </div>
            <div className="mt-3">
              <label className={LABEL}>Model params (JSON)</label>
              <textarea className={TEXTAREA} value={editor.default_model_params} onChange={(e)=>setEditor((p)=>({...p,default_model_params:e.target.value}))} />
            </div>
            <div className="mt-4 flex gap-2">
              {editor.id ? (
                <>
                  <button type="button" className={BTN_PRIMARY} onClick={saveTemplate} disabled={saving}>Salvar</button>
                  <button type="button" className={BTN} onClick={deleteTemplate} disabled={saving}>Excluir</button>
                  <button 
                    type="button" 
                    className="config-btn px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 flex items-center gap-2" 
                    onClick={() => setShowToolsManager(true)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Ferramentas
                  </button>
                </>
              ) : (
                <button type="button" className={BTN_PRIMARY} onClick={createTemplate} disabled={saving}>Criar</button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Perguntas</h3>
              <button
                type="button"
                className={BTN}
                onClick={addQuestion}
                disabled={!selectedId || qSaving}
              >
                Adicionar
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 mt-3">
              <div>
                <label className={LABEL}>Key</label>
                <input className={INPUT} value={(qForm.key as any) || ""} onChange={(e)=>setQForm((p)=>({...p,key:e.target.value}))} />
              </div>
              <div>
                <label className={LABEL}>Label</label>
                <input className={INPUT} value={(qForm.label as any) || ""} onChange={(e)=>setQForm((p)=>({...p,label:e.target.value}))} />
              </div>
              <div>
                <label className={LABEL}>Tipo</label>
                <select className={INPUT} value={(qForm.type as any) || "text"} onChange={(e)=>setQForm((p)=>({...p,type:e.target.value as any}))}>
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="select">select</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="multiselect">multiselect</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Obrigatória</label>
                <div>
                  <input type="checkbox" checked={Boolean(qForm.required)} onChange={(e)=>setQForm((p)=>({...p,required:e.target.checked}))} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={LABEL}>Help</label>
                <input className={INPUT} value={(qForm.help as any) || ""} onChange={(e)=>setQForm((p)=>({...p,help:e.target.value}))} />
              </div>
              <div className="md:col-span-2">
                <label className={LABEL}>Options (JSON array)</label>
                <input className={INPUT} value={Array.isArray(qForm.options)?JSON.stringify(qForm.options):""} onChange={(e)=>{
                  try { setQForm((p)=>({...p,options: JSON.parse(e.target.value || "[]")})); }
                  catch { setQForm((p)=>({...p,options: []})); }
                }} />
              </div>
              <div>
                <label className={LABEL}>Ordem</label>
                <input className={INPUT} type="number" value={String(qForm.order_index ?? 0)} onChange={(e)=>setQForm((p)=>({...p,order_index: Number(e.target.value||0)}))} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-(--color-heading) font-medium">{q.label} <span className="text-xs text-(--color-text-muted)">({q.key})</span></div>
                      <div className="text-xs text-(--color-text-muted)">{q.type} {q.required ? "• obrigatória" : ""}</div>
                    </div>
                    <button type="button" className={BTN} onClick={()=>removeQuestion(q.id)}>Remover</button>
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-sm text-(--color-text-muted)">Nenhuma pergunta ainda.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showToolsManager && editor.id && (
        <TemplateToolsManager 
          templateId={editor.id}
          templateName={editor.name}
          onClose={() => setShowToolsManager(false)}
        />
      )}
    </section>
  );
}


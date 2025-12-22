import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AgentTemplateSelector } from "../../componets/agents/AgentTemplateSelector";
import { AgentConfigPanel } from "../../componets/agents/AgentConfigPanel";
import { fetchJson, API } from "../../utils/api";
import type { AgentTemplate, AgentTemplateQuestion } from "../../types/types";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Save, Bot, Sparkles, Loader2 } from "lucide-react";

export default function AgentEditPage() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState<"selectTemplate" | "createForm" | "edit">("selectTemplate");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [questions, setQuestions] = useState<AgentTemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agentId) {
      setView("edit");
    } else {
      setView("selectTemplate");
    }
  }, [agentId]);

  async function handleSelectTemplate(template: AgentTemplate) {
    try {
      setLoading(true);
      const data = await fetchJson<AgentTemplateQuestion[]>(
        `${API}/api/agent-templates/${template.id}/questions`
      );
      setSelectedTemplate(template);
      setQuestions(data);
      setView("createForm");
    } catch (error) {
      console.error("Erro ao carregar perguntas:", error);
      alert("Erro ao carregar configurações do template");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAgent() {
    if (!selectedTemplate) return;
    try {
      setLoading(true);
      const payload = {
        template_id: selectedTemplate.id,
        answers,
      };

      const result = await fetchJson<any>(`${API}/api/agents/from-template`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert("Agente criado com sucesso!");
      navigate(`/configuracoes/ia/${result.id || ""}`);
    } catch (error) {
      console.error("Erro ao criar agente:", error);
      alert("Erro ao criar agente. Verifique os campos e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (view === "selectTemplate") {
    return (
      <div className="max-w-6xl mx-auto">
        <AgentTemplateSelector 
          onSelectTemplate={handleSelectTemplate} 
          onBack={() => navigate("/configuracoes/ia")} 
        />
      </div>
    );
  }

  if (view === "createForm" && selectedTemplate) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView("selectTemplate")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors group"
            >
              <ArrowLeft size={20} className="text-gray-500 dark:text-gray-400 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="text-blue-600 dark:text-blue-400" size={24} />
                Configurar Novo Agente
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Template: <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedTemplate.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("selectTemplate")}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreateAgent} 
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Criar Agente
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-hidden">
          <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-white">Informações do Agente</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Preencha os detalhes para personalizar seu assistente.</p>
          </div>
          
          <div className="py-8 space-y-8">
            {questions.sort((a, b) => a.order_index - b.order_index).map((q) => (
              <div key={q.id} className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {q.label}
                  {q.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {q.type === "text" || q.type === "string" ? (
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder={q.placeholder || ""}
                    value={answers[q.key] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  />
                ) : q.type === "textarea" ? (
                  <textarea
                    rows={4}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder={q.placeholder || ""}
                    value={answers[q.key] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  />
                ) : q.type === "select" ? (
                  <select
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:[color-scheme:dark]"
                    value={answers[q.key] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                  >
                    <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Selecione uma opção...</option>
                    {(q.options as any[])?.map((opt) => (
                      <option 
                        key={opt.value} 
                        value={opt.value}
                        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {q.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{q.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "edit" && agentId) {
    return (
      <AgentConfigPanel 
        agentId={agentId} 
        onBack={() => navigate("/configuracoes/ia")} 
        onSaved={() => {
          navigate("/configuracoes/ia");
        }} 
      />
    );
  }

  return null;
}

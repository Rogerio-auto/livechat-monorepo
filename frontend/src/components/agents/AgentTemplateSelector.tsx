// AgentTemplateSelector.tsx
// Seletor visual de templates para criar agente

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import type { AgentTemplate } from "@livechat/shared";
import { ArrowLeft, Sparkles, Check, Loader2, Bot, Zap } from "lucide-react";

type ToolCapability = {
  key: string;
  name: string;
  description: string;
  userFriendlyLabel: string;
};

type Props = {
  onSelectTemplate: (template: AgentTemplate) => void;
  onBack: () => void;
};

// Mapeamento de ferramentas para linguagem amigável
const TOOL_FRIENDLY_NAMES: Record<string, string> = {
  query_contact_data: "Consultar informações do cliente",
  update_contact_data: "Atualizar dados cadastrais",
  add_contact_tag: "Organizar com etiquetas",
  search_products: "Buscar produtos no catálogo",
  create_lead: "Registrar novos leads",
  schedule_appointment: "Agendar compromissos",
  send_email: "Enviar e-mails automáticos",
};

export function AgentTemplateSelector({ onSelectTemplate, onBack }: Props) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [templateTools, setTemplateTools] = useState<Record<string, ToolCapability[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await fetchJson<AgentTemplate[]>(`${API}/api/agent-templates`);
      const templatesArray = Array.isArray(data) ? data : [];
      setTemplates(templatesArray);

      // Mapear ferramentas que já vieram no template (otimizado)
      const toolsMap: Record<string, ToolCapability[]> = {};
      for (const template of templatesArray) {
        if (template.tools && Array.isArray(template.tools)) {
          toolsMap[template.id] = template.tools.map((t: any) => ({
            key: t.key,
            name: t.name,
            description: t.description,
            userFriendlyLabel: TOOL_FRIENDLY_NAMES[t.key] || t.name,
          }));
        } else {
          toolsMap[template.id] = [];
        }
      }
      setTemplateTools(toolsMap);
    } catch (err) {
      console.error("Erro ao carregar templates", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-gray-500 animate-pulse">Carregando templates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <button
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 flex items-center gap-2 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Voltar para Agentes
        </button>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Escolha o tipo de agente</h2>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Selecione o modelo que melhor se encaixa na sua necessidade de atendimento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col h-full"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors" />
              </div>
              <div className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Template
              </div>
            </div>

            <div className="flex-grow">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {template.name}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                {template.description}
              </p>

              {templateTools[template.id]?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Capacidades inclusas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {templateTools[template.id].map((tool, index) => (
                      <div
                        key={tool.key || `tool-${index}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        {tool.userFriendlyLabel}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Selecionar este modelo
                <Check className="w-4 h-4" />
              </span>
              <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                <ArrowLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 rotate-180 transition-all" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


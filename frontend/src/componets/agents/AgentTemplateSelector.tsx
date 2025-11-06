// AgentTemplateSelector.tsx
// Seletor visual de templates para criar agente

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import type { AgentTemplate } from "../../types/types";

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
      console.log("📋 Templates carregados:", templatesArray);
      setTemplates(templatesArray);

      // Carregar ferramentas para cada template
      const toolsMap: Record<string, ToolCapability[]> = {};
      for (const template of templatesArray) {
        try {
          const tools = await fetchJson<any[]>(`${API}/api/agent-templates/${template.id}/tools`);
          console.log(`🔧 Ferramentas do template ${template.name}:`, tools);
          toolsMap[template.id] = tools.map((t) => ({
            key: t.key,
            name: t.name,
            description: t.description,
            userFriendlyLabel: TOOL_FRIENDLY_NAMES[t.key] || t.name,
          }));
        } catch (err) {
          console.warn(`Erro ao carregar ferramentas do template ${template.id}`, err);
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Carregando opções...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">Escolha o tipo de agente</h2>
        <p className="text-gray-400">
          Selecione o modelo que melhor se encaixa na sua necessidade
        </p>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            tools={templateTools[template.id] || []}
            onSelect={() => onSelectTemplate(template)}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">Nenhum template disponível no momento.</p>
          <p className="text-sm text-gray-500 mt-2">Entre em contato com o suporte.</p>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  tools,
  onSelect,
}: {
  template: AgentTemplate;
  tools: ToolCapability[];
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group relative bg-linear-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-left hover:from-blue-900 hover:to-indigo-900 transition-all duration-300 border-2 border-gray-700 hover:border-blue-500 hover:shadow-xl hover:scale-105"
    >
      {/* Category Badge */}
      {template.category && (
        <div className="px-3 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded-full border border-blue-500/30 mb-4 inline-block">
          {template.category}
        </div>
      )}

      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition">
        {template.name}
      </h3>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4 line-clamp-3">{template.description}</p>

      {/* Capacidades do Agente */}
      {tools.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
            O que este agente pode fazer:
          </p>
          <ul className="space-y-1.5">
            {tools.map((tool, idx) => (
              <li key={`${tool.key}-${idx}`} className="flex items-start gap-2 text-sm text-gray-300">
                <svg
                  className="w-4 h-4 text-green-400 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{tool.userFriendlyLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Arrow */}
      <div className="flex items-center text-blue-400 font-medium text-sm group-hover:translate-x-1 transition-transform">
        Selecionar
        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

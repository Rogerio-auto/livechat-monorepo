// TemplateToolsManager.tsx
// Gerenciador visual de ferramentas para templates de agentes

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import type { Tool } from "../../types/types";

type TemplateTool = {
  id: string;
  template_id: string;
  tool_id: string;
  required: boolean;
  overrides: Record<string, unknown>;
  // Joined fields
  key?: string;
  name?: string;
  description?: string;
  category?: string;
  handler_type?: string;
};

type Props = {
  templateId: string;
  templateName: string;
  onClose: () => void;
};

export function TemplateToolsManager({ templateId, templateName, onClose }: Props) {
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [templateTools, setTemplateTools] = useState<TemplateTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [templateId]);

  async function loadData() {
    setLoading(true);
    try {
      const [tools, attached] = await Promise.all([
        fetchJson<Tool[]>(`${API}/api/tools`),
        fetchJson<TemplateTool[]>(`${API}/api/agent-templates/${templateId}/tools`),
      ]);
      setAvailableTools(tools.filter((t) => t.is_active));
      setTemplateTools(attached);
    } catch (err) {
      console.error("Erro ao carregar ferramentas", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleTool(tool: Tool) {
    const isAttached = templateTools.some((t) => t.tool_id === tool.id);

    try {
      if (isAttached) {
        await fetchJson(`${API}/api/agent-templates/${templateId}/tools/${tool.id}`, {
          method: "DELETE",
        });
        alert("Ferramenta removida do template!");
      } else {
        await fetchJson(`${API}/api/agent-templates/${templateId}/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool_id: tool.id,
            required: false,
            overrides: {},
          }),
        });
        alert("Ferramenta adicionada ao template!");
      }
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao modificar ferramenta");
    }
  }

  async function handleToggleRequired(toolId: string, currentRequired: boolean) {
    try {
      await fetchJson(`${API}/api/agent-templates/${templateId}/tools/${toolId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          required: !currentRequired,
          overrides: {},
        }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar ferramenta");
    }
  }

  const filteredTools = availableTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const attachedToolIds = new Set(templateTools.map((t) => t.tool_id));
  const attachedCount = templateTools.length;
  const requiredCount = templateTools.filter((t) => t.required).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">Gerenciar Ferramentas</h2>
              <p className="text-blue-100 text-sm">Template: {templateName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-4">
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">{attachedCount}</div>
              <div className="text-xs text-blue-100">Ferramentas ativas</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">{requiredCount}</div>
              <div className="text-xs text-blue-100">Obrigatórias</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <div className="text-2xl font-bold">{availableTools.length}</div>
              <div className="text-xs text-blue-100">Disponíveis</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 m-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm">
              <p className="font-semibold text-blue-900 mb-1">💡 Como usar:</p>
              <ul className="text-blue-800 space-y-1">
                <li>
                  • <strong>Clique no switch</strong> para adicionar/remover ferramentas do template
                </li>
                <li>
                  • <strong>Marque como obrigatória</strong> se o agente sempre precisar dela
                </li>
                <li>
                  • Ferramentas obrigatórias serão <strong>automaticamente habilitadas</strong> em
                  novos agentes
                </li>
                <li>
                  • Use a busca para <strong>filtrar por nome, descrição ou categoria</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar ferramentas por nome, descrição ou categoria..."
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Tools List */}
        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 400px)" }}>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Carregando ferramentas...</div>
          ) : filteredTools.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-gray-500">Nenhuma ferramenta encontrada</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTools.map((tool) => {
                const isAttached = attachedToolIds.has(tool.id);
                const templateTool = templateTools.find((t) => t.tool_id === tool.id);
                const isRequired = templateTool?.required || false;

                return (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    isAttached={isAttached}
                    isRequired={isRequired}
                    onToggle={() => handleToggleTool(tool)}
                    onToggleRequired={() => handleToggleRequired(tool.id, isRequired)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}

// Card individual de ferramenta
function ToolCard({
  tool,
  isAttached,
  isRequired,
  onToggle,
  onToggleRequired,
}: {
  tool: Tool;
  isAttached: boolean;
  isRequired: boolean;
  onToggle: () => void;
  onToggleRequired: () => void;
}) {
  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${
        isAttached
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Toggle Switch */}
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-1 ${
            isAttached ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isAttached ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">{tool.name}</h3>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${getHandlerTypeBadge(
                tool.handler_type
              )}`}
            >
              {tool.handler_type}
            </span>
            {tool.category && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {tool.category}
              </span>
            )}
            {!tool.company_id && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                GLOBAL
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{tool.description}</p>
          <div className="text-xs text-gray-500 font-mono">{tool.key}</div>

          {/* Required checkbox */}
          {isAttached && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={onToggleRequired}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-blue-600 transition">
                  <strong>Obrigatória</strong> - sempre habilitar em novos agentes
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Status Badge */}
        {isAttached && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              ATIVA
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function getHandlerTypeBadge(type: string) {
  switch (type) {
    case "INTERNAL_DB":
      return "bg-blue-100 text-blue-700";
    case "HTTP":
      return "bg-purple-100 text-purple-700";
    case "WORKFLOW":
      return "bg-green-100 text-green-700";
    case "SOCKET":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

// ToolsAdminPanel.tsx
// Admin panel para gerenciar ferramentas (tools_catalog)

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import type { Tool, ToolHandlerType } from "../../types/types";

export function ToolsAdminPanel() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTools();
  }, []);

  async function loadTools() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<Tool[]>(`${API}/api/tools`);
      setTools(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar ferramentas");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(tool: Partial<Tool>) {
    try {
      if (tool.id) {
        // Update
        await fetchJson(`${API}/api/tools/${tool.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tool),
        });
        alert("Ferramenta atualizada!");
      } else {
        // Create
        await fetchJson(`${API}/api/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tool),
        });
        alert("Ferramenta criada!");
      }
      setEditingTool(null);
      setIsCreating(false);
      loadTools();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar ferramenta");
    }
  }

  async function handleDelete(toolId: string) {
    if (!confirm("Tem certeza que deseja deletar esta ferramenta?")) return;
    try {
      await fetchJson(`${API}/api/tools/${toolId}`, { method: "DELETE" });
      alert("Ferramenta deletada!");
      loadTools();
    } catch (err: any) {
      alert(err.message || "Erro ao deletar ferramenta");
    }
  }

  async function handleDuplicate(tool: Tool) {
    if (!confirm(`Duplicar ferramenta "${tool.name}"?`)) return;
    try {
      const duplicated = await fetchJson<Tool>(`${API}/api/tools/${tool.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${tool.name} (cópia)` }),
      });
      alert(`Ferramenta duplicada: ${duplicated.name}`);
      loadTools();
    } catch (err: any) {
      alert(err.message || "Erro ao duplicar ferramenta");
    }
  }

  async function handleToggleActive(tool: Tool) {
    try {
      await fetchJson(`${API}/api/tools/${tool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !tool.is_active }),
      });
      alert(tool.is_active ? "Ferramenta desativada" : "Ferramenta ativada");
      loadTools();
    } catch (err: any) {
      alert(err.message || "Erro ao alterar status");
    }
  }

  const globalTools = tools.filter((t) => !t.company_id);
  const companyTools = tools.filter((t) => t.company_id);

  return (
    <div className="p-6 max-w-7xl mx-auto bg-(--color-bg) text-(--color-text)">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-(--color-heading)">Gerenciar Ferramentas</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-(--color-primary) text-(--color-on-primary) rounded-lg hover:bg-(--color-highlight)"
        >
          + Nova Ferramenta
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-(--color-text-muted)">Carregando...</div>
      ) : (
        <>
          {/* Ferramentas Globais (read-only) */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-(--color-heading)">
              <span className="px-2 py-1 bg-(--color-surface-muted) text-(--color-text-muted) text-xs rounded">GLOBAL</span>
              Ferramentas Padrão do Sistema
            </h2>
            <div className="grid gap-4">
              {globalTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isReadOnly
                  onToggleActive={handleToggleActive}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          </section>

          {/* Ferramentas da Empresa */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Ferramentas Customizadas</h2>
            <div className="grid gap-4">
              {companyTools.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  Nenhuma ferramenta customizada criada ainda.
                </div>
              ) : (
                companyTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onEdit={() => setEditingTool(tool)}
                    onDelete={() => handleDelete(tool.id)}
                    onToggleActive={handleToggleActive}
                    onDuplicate={handleDuplicate}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}

      {/* Modal de Edição/Criação */}
      {(editingTool || isCreating) && (
        <ToolEditorModal
          tool={editingTool || undefined}
          onSave={handleSave}
          onClose={() => {
            setEditingTool(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

// Card de Ferramenta
function ToolCard({
  tool,
  isReadOnly = false,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
}: {
  tool: Tool;
  isReadOnly?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleActive?: (tool: Tool) => void;
  onDuplicate?: (tool: Tool) => void;
}) {
  return (
  <div className="border rounded-lg p-4 bg-(--color-surface) text-(--color-text) shadow-sm hover:shadow-md border-(--color-border) transition">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg text-(--color-heading)">{tool.name}</h3>
            <span className={`px-2 py-1 text-xs rounded ${getHandlerTypeColor(tool.handler_type)}`}>
              {tool.handler_type}
            </span>
            {tool.category && (
              <span className="px-2 py-1 bg-(--color-surface-muted) text-(--color-text-muted) text-xs rounded">
                {tool.category}
              </span>
            )}
            {!tool.is_active && (
              <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded">INATIVA</span>
            )}
          </div>
          <p className="text-sm text-(--color-text-muted) mb-2">{tool.description}</p>
          <div className="text-xs text-(--color-text-muted)">
            <span className="font-mono">{tool.key}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(tool)}
              className={`px-3 py-1 text-sm rounded ${
                tool.is_active
                  ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                  : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              {tool.is_active ? "Desativar" : "Ativar"}
            </button>
          )}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(tool)}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              title="Duplicar ferramenta"
            >
              📋 Duplicar
            </button>
          )}
          {!isReadOnly && onEdit && (
            <button
              onClick={onEdit}
              className="px-3 py-1 text-sm bg-(--color-highlight) text-(--color-on-primary) rounded hover:bg-(--color-primary)"
            >
              Editar
            </button>
          )}
          {!isReadOnly && onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Deletar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getHandlerTypeColor(type: ToolHandlerType) {
  switch (type) {
    case "INTERNAL_DB":
  return "bg-(--color-highlight) text-(--color-on-primary)";
    case "HTTP":
  return "bg-(--color-highlight-strong) text-(--color-on-primary)";
    case "WORKFLOW":
  return "bg-green-100 text-green-700";
    case "SOCKET":
  return "bg-orange-100 text-orange-700";
    default:
  return "bg-(--color-surface-muted) text-(--color-text-muted)";
  }
}

// Modal de Edição
function ToolEditorModal({
  tool,
  onSave,
  onClose,
}: {
  tool?: Tool;
  onSave: (tool: Partial<Tool>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Tool>>(
    tool || {
      key: "",
      name: "",
      category: "CUSTOM",
      description: "",
      handler_type: "INTERNAL_DB",
      handler_config: {},
      schema: {
        type: "function",
        function: {
          name: "",
          description: "",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      is_active: true,
    }
  );

  const [schemaJson, setSchemaJson] = useState(JSON.stringify(formData.schema, null, 2));
  const [configJson, setConfigJson] = useState(JSON.stringify(formData.handler_config, null, 2));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const schema = JSON.parse(schemaJson);
      const handler_config = JSON.parse(configJson);
      onSave({ ...formData, schema, handler_config });
    } catch (err) {
      alert("JSON inválido em Schema ou Config");
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-(--color-surface) text-(--color-text) rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-(--color-border)">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-(--color-heading)">{tool ? "Editar" : "Nova"} Ferramenta</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Key *</label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                className="w-full border rounded px-3 py-2 border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded px-3 py-2 border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Categoria</label>
              <input
                type="text"
                value={formData.category || ""}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border rounded px-3 py-2 border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
                placeholder="CRM, Workflow, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Handler Type *</label>
              <select
                value={formData.handler_type}
                onChange={(e) =>
                  setFormData({ ...formData, handler_type: e.target.value as ToolHandlerType })
                }
                className="w-full border rounded px-3 py-2 border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
                required
              >
                <option value="INTERNAL_DB">INTERNAL_DB</option>
                <option value="HTTP">HTTP</option>
                <option value="WORKFLOW">WORKFLOW</option>
                <option value="SOCKET">SOCKET</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Descrição</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border rounded px-3 py-2 border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
              rows={2}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Schema (JSON) *</label>
            <textarea
              value={schemaJson}
              onChange={(e) => setSchemaJson(e.target.value)}
              className="w-full border rounded px-3 py-2 font-mono text-sm border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
              rows={10}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-1 text-(--color-text-muted)">Handler Config (JSON) *</label>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              className="w-full border rounded px-3 py-2 font-mono text-sm border-(--color-border) bg-(--color-surface-muted) text-(--color-text)"
              rows={10}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg border-(--color-border) bg-(--color-surface-muted) text-(--color-text) hover:bg-(--color-surface)"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-(--color-primary) text-(--color-on-primary) rounded-lg hover:bg-(--color-highlight)">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

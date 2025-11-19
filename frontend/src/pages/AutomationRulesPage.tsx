import { useState } from "react";
import { Plus, Settings, Play, Pause, Trash2, Eye, Filter, Sparkles, Zap, TrendingUp } from "lucide-react";
import { useAutomationRules } from "../hooks/useAutomationRules";
import { RuleModal } from "../components/automation/RuleModal";
import { RuleWizard } from "../components/automation/RuleWizard";
import { RuleLogsModal } from "../components/automation/RuleLogsModal";
import type { AutomationRule } from "../types/automationRules";
import { TRIGGER_LABELS } from "../types/automationRules";

export function AutomationRulesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [viewingLogsRule, setViewingLogsRule] = useState<AutomationRule | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const { rules, loading, error, deleteRule, toggleRule } = useAutomationRules(false);

  const filteredRules = rules.filter((rule) => {
    if (filterActive === "active") return rule.is_active;
    if (filterActive === "inactive") return !rule.is_active;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta regra?")) return;
    try {
      await deleteRule(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await toggleRule(id, !currentStatus);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-500" />
            Automações Inteligentes
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Economize tempo e nunca mais perca uma oportunidade
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-5 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
        >
          <Plus className="w-5 h-5" />
          Nova Automação
        </button>
      </div>

      {/* Value Proposition Banner */}
      {rules.length === 0 && !loading && (
        <div className="bg-linear-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 mb-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-6">
            <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-lg">
              <Zap className="w-12 h-12 text-purple-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Seu time de vendas está perdendo oportunidades?
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4 text-lg">
                Com automações, você <strong>nunca mais esquece</strong> de fazer follow-up, sempre responde leads rapidamente e fecha mais vendas!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">+40%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Mais conversões</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <Zap className="w-8 h-8 text-orange-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">30min</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tempo de resposta</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Leads esquecidos</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowWizard(true)}
                className="px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium flex items-center gap-2 shadow-lg"
              >
                <Sparkles className="w-5 h-5" />
                Criar Primeira Automação (2 minutos)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-500" />
        <button
          onClick={() => setFilterActive("all")}
          className={`px-3 py-1 rounded-lg text-sm ${
            filterActive === "all"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          Todas ({rules.length})
        </button>
        <button
          onClick={() => setFilterActive("active")}
          className={`px-3 py-1 rounded-lg text-sm ${
            filterActive === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          Ativas ({rules.filter((r) => r.is_active).length})
        </button>
        <button
          onClick={() => setFilterActive("inactive")}
          className={`px-3 py-1 rounded-lg text-sm ${
            filterActive === "inactive"
              ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          Inativas ({rules.filter((r) => !r.is_active).length})
        </button>
      </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-4">Carregando regras...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Rules List */}
      {!loading && !error && (
        <div className="space-y-4">
          {filteredRules.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                {filterActive === "all"
                  ? "Nenhuma regra criada ainda"
                  : filterActive === "active"
                  ? "Nenhuma regra ativa"
                  : "Nenhuma regra inativa"}
              </p>
              {filterActive === "all" && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                >
                  Criar sua primeira regra →
                </button>
              )}
            </div>
          ) : (
            filteredRules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border ${
                  rule.is_active
                    ? "border-green-200 dark:border-green-800"
                    : "border-gray-200 dark:border-gray-700"
                } p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {rule.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rule.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {rule.is_active ? "Ativa" : "Inativa"}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {TRIGGER_LABELS[rule.trigger_type]}
                      </span>
                    </div>

                    {rule.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {rule.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span>
                        Executada {rule.execution_count} {rule.execution_count === 1 ? "vez" : "vezes"}
                      </span>
                      {rule.last_executed_at && (
                        <span>
                          Última execução:{" "}
                          {new Date(rule.last_executed_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                      <span>
                        {rule.conditions.length} {rule.conditions.length === 1 ? "condição" : "condições"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setViewingLogsRule(rule)}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Ver logs"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                      title="Editar"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(rule.id, rule.is_active)}
                      className={`p-2 ${
                        rule.is_active
                          ? "text-green-600 hover:text-green-700 dark:text-green-400"
                          : "text-gray-600 hover:text-green-600 dark:text-gray-400"
                      }`}
                      title={rule.is_active ? "Desativar" : "Ativar"}
                    >
                      {rule.is_active ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      title="Deletar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <RuleWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
          }}
        />
      )}

      {showCreateModal && (
        <RuleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
          }}
        />
      )}

      {editingRule && (
        <RuleModal
          rule={editingRule}
          onClose={() => setEditingRule(null)}
          onSuccess={() => {
            setEditingRule(null);
          }}
        />
      )}

      {viewingLogsRule && (
        <RuleLogsModal
          rule={viewingLogsRule}
          onClose={() => setViewingLogsRule(null)}
        />
      )}
    </div>
  );
}

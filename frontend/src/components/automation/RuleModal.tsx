import { useState, useEffect } from "react";
import { X, Plus, Trash2, Info } from "lucide-react";
import { useAutomationRules } from "../../hooks/useAutomationRules";
import {
  AutomationRule,
  CreateAutomationRuleInput,
  TriggerType,
  Condition,
  ConditionOperator,
  TRIGGER_LABELS,
  TRIGGER_DESCRIPTIONS,
  OPERATOR_LABELS,
} from "@livechat/shared";

interface RuleModalProps {
  rule?: AutomationRule;
  onClose: () => void;
  onSuccess: () => void;
}

export function RuleModal({ rule, onClose, onSuccess }: RuleModalProps) {
  const { createRule, updateRule } = useAutomationRules();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(rule?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [triggerType, setTriggerType] = useState<TriggerType>(
    rule?.trigger_type || "LEAD_INACTIVE"
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(
    rule?.trigger_config || {}
  );
  const [conditions, setConditions] = useState<Condition[]>(rule?.conditions || []);
  const [taskTitle, setTaskTitle] = useState(rule?.task_template.title || "");
  const [taskDescription, setTaskDescription] = useState(
    rule?.task_template.description || ""
  );
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH">(
    rule?.task_template.priority || "MEDIUM"
  );
  const [dueDateOffset, setDueDateOffset] = useState(
    rule?.task_template.due_date_offset || "+1d"
  );
  const [checkExisting, setCheckExisting] = useState(
    rule?.check_existing_tasks ?? true
  );
  const [preventionWindow, setPreventionWindow] = useState(
    rule?.duplicate_prevention_window_hours || 24
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const input: CreateAutomationRuleInput = {
        name,
        description: description || undefined,
        is_active: isActive,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions,
        task_template: {
          title: taskTitle,
          description: taskDescription || undefined,
          priority: taskPriority,
          due_date_offset: dueDateOffset || undefined,
        },
        check_existing_tasks: checkExisting,
        duplicate_prevention_window_hours: preventionWindow,
      };

      if (rule) {
        await updateRule(rule.id, input);
      } else {
        await createRule(input);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {rule ? "Editar Regra" : "Nova Regra de Automação"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome da Regra *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Ex: Follow-up após 5 dias"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Descreva o objetivo desta regra..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                Ativar regra imediatamente
              </label>
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuração do Trigger
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Trigger *
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {TRIGGER_DESCRIPTIONS[triggerType]}
              </p>
            </div>

            {/* Trigger-specific config */}
            <div className="mt-4 space-y-3">
              {triggerType === "LEAD_INACTIVE" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dias sem interação
                  </label>
                  <input
                    type="number"
                    value={triggerConfig.days || 3}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, days: parseInt(e.target.value) })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}

              {triggerType === "EVENT_UPCOMING" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Horas antes do evento
                  </label>
                  <input
                    type="number"
                    value={triggerConfig.hours_before || 24}
                    onChange={(e) =>
                      setTriggerConfig({
                        ...triggerConfig,
                        hours_before: parseInt(e.target.value),
                      })
                    }
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Condições (AND)
              </h3>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Adicionar Condição
              </button>
            </div>

            {conditions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Nenhuma condição adicional (regra sempre executará quando trigger disparar)
              </p>
            ) : (
              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={condition.field}
                        onChange={(e) => updateCondition(index, { field: e.target.value })}
                        placeholder="Campo (ex: lead.status_client)"
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(index, { operator: e.target.value as ConditionOperator })
                        }
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {!["is_null", "not_null"].includes(condition.operator) && (
                        <input
                          type="text"
                          value={condition.value || ""}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                          placeholder="Valor"
                          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task Template */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Template da Tarefa
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ex: Follow-up: {{lead.name}}"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Use variáveis: {`{{lead.name}}, {{config.days}}, {{event.title}}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descrição detalhada com instruções..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vencimento
                  </label>
                  <input
                    type="text"
                    value={dueDateOffset}
                    onChange={(e) => setDueDateOffset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Ex: +1d, +2h"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Formato: +1d, +2h, +30m, +1w
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Duplicate Prevention */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Prevenção de Duplicatas
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="checkExisting"
                  checked={checkExisting}
                  onChange={(e) => setCheckExisting(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="checkExisting" className="text-sm text-gray-700 dark:text-gray-300">
                  Verificar tarefas existentes antes de criar
                </label>
              </div>

              {checkExisting && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Janela de prevenção (horas)
                  </label>
                  <input
                    type="number"
                    value={preventionWindow}
                    onChange={(e) => setPreventionWindow(parseInt(e.target.value))}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Não criar nova task se já existir uma nas últimas {preventionWindow} horas
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Salvando..." : rule ? "Atualizar" : "Criar Regra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

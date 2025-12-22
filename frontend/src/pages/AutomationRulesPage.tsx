import { useMemo, useState } from "react";
import {
  Plus,
  Settings,
  Play,
  Pause,
  Trash2,
  Eye,
  Filter,
  Sparkles,
  Zap,
  TrendingUp,
  RotateCcw,
} from "lucide-react";
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

  const {
    rules,
    loading,
    error,
    fetchRules,
    deleteRule,
    toggleRule,
  } = useAutomationRules(false);

  const activeCount = useMemo(
    () => rules.filter((rule) => rule.is_active).length,
    [rules]
  );
  const inactiveCount = useMemo(() => rules.length - activeCount, [rules, activeCount]);
  const totalExecutions = useMemo(
    () => rules.reduce((sum, rule) => sum + (rule.execution_count || 0), 0),
    [rules]
  );

  const filteredRules = useMemo(() => {
    if (filterActive === "active") return rules.filter((rule) => rule.is_active);
    if (filterActive === "inactive") return rules.filter((rule) => !rule.is_active);
    return rules;
  }, [filterActive, rules]);

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
    <>
      <div className="livechat-theme min-h-screen w-full pb-12 transition-colors duration-500">
        <div className="mx-auto w-full max-w-(--page-max-width) px-3 pb-10 pt-6 sm:px-6 lg:px-8">
          <div className="livechat-card rounded-xl p-6 shadow-md md:p-8">
            <div className="space-y-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 text-xs font-semibold text-(--color-primary)">
                    <Sparkles className="h-4 w-4" />
                    Automação inteligente
                  </div>
                  <h1 className="text-3xl font-bold text-(--color-text)">Automações</h1>
                  <p className="text-sm text-(--color-text-muted)">
                    Crie jornadas que respondem leads, encaminham tarefas e mantêm seu funil ativo 24/7.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-text-muted)">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1">
                      <Play className="h-3.5 w-3.5 text-[#2fb463]" /> {activeCount} ativas
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1">
                      <Pause className="h-3.5 w-3.5 text-[#f59e0b]" /> {inactiveCount} pausadas
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-3 py-1">
                      <Zap className="h-3.5 w-3.5 text-[#3b82f6]" /> {totalExecutions} execuções
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <button
                    type="button"
                    onClick={() => fetchRules()}
                    className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-4 py-2 text-sm font-semibold text-(--color-text) transition-all hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
                  >
                    <RotateCcw className="h-4 w-4" /> Atualizar lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgba(47,180,99,0.35)] px-4 py-2 text-sm font-semibold text-(--color-primary) transition-all hover:bg-[rgba(47,180,99,0.12)]"
                  >
                    <Settings className="h-4 w-4" /> Configurar manualmente
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWizard(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200  hover:bg-[#1f8b49]"
                  >
                    <Plus className="h-4 w-4" /> Nova automação
                  </button>
                </div>
              </div>

              {rules.length === 0 && !loading && (
                <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-[rgba(47,180,99,0.12)] via-[rgba(21,63,41,0.12)] to-[rgba(47,180,99,0.05)] p-8 text-(--color-text) shadow-md">
                  <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[rgba(47,180,99,0.22)] blur-3xl" />
                  <div className="pointer-events-none absolute -left-12 bottom-4 h-40 w-40 rounded-full bg-[rgba(116,230,158,0.2)] blur-3xl" />
                  <div className="relative flex flex-col gap-8 lg:flex-row">
                    <div className="max-w-xl space-y-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-[#2fb463] shadow">
                        <TrendingUp className="h-4 w-4" /> Cresça no piloto automático
                      </div>
                      <h2 className="text-2xl font-bold">Construa fluxos que trabalham por você</h2>
                      <p className="text-sm text-(--color-text-muted)">
                        Defina gatilhos, condições e ações para garantir que cada lead receba o tratamento ideal. Alinhe follow-ups, notificações e atualizações sem depender da memória da equipe.
                      </p>
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-xl bg-white/70 p-4 backdrop-blur-sm shadow-sm">
                          <p className="text-xs font-semibold text-[#2fb463]">Tempo de resposta</p>
                          <p className="mt-1 text-lg font-bold text-(--color-text)">30 minutos</p>
                          <p className="mt-1 text-xs text-(--color-text-muted)">Mantenha leads quentes com respostas automáticas.</p>
                        </div>
                        <div className="rounded-xl bg-white/70 p-4 backdrop-blur-sm shadow-sm">
                          <p className="text-xs font-semibold text-[#2fb463]">Conversões</p>
                          <p className="mt-1 text-lg font-bold text-(--color-text)">+40%</p>
                          <p className="mt-1 text-xs text-(--color-text-muted)">Acompanhe cada oportunidade até o fechamento.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowWizard(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200  hover:bg-[#1f8b49]"
                        >
                          <Sparkles className="h-4 w-4" /> Criar primeira automação
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateModal(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-4 py-2 text-sm font-semibold text-(--color-primary) backdrop-blur-sm transition-all hover:bg-white"
                        >
                          <Settings className="h-4 w-4" /> Modelos avançados
                        </button>
                      </div>
                    </div>
                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                        <p className="text-xs font-semibold text-(--color-primary)">Gatilhos inteligentes</p>
                        <p className="mt-2 text-sm text-(--color-text-muted)">
                          Dispare fluxos com base em status do funil, interações ou tempo sem contato.
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                        <p className="text-xs font-semibold text-(--color-primary)">Ações encadeadas</p>
                        <p className="mt-2 text-sm text-(--color-text-muted)">
                          Combine mensagens, tarefas, labels e integrações externas em poucos cliques.
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                        <p className="text-xs font-semibold text-(--color-primary)">Logs completos</p>
                        <p className="mt-2 text-sm text-(--color-text-muted)">
                          Monitore cada execução e ajuste rapidamente quando precisar.
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/80 p-4 backdrop-blur-sm shadow-sm">
                        <p className="text-xs font-semibold text-(--color-primary)">Sem código</p>
                        <p className="mt-2 text-sm text-(--color-text-muted)">
                          Construa fluxos poderosos com interface visual pronta para o time comercial.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rules.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-4 py-3 text-sm text-(--color-text) shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                    <Filter className="h-4 w-4" /> Filtrar por status
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterActive("all")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      filterActive === "all"
                        ? "bg-(--color-surface) text-(--color-primary) shadow-[0_14px_30px_-20px_rgba(47,180,99,0.75)]"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    Todas ({rules.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterActive("active")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      filterActive === "active"
                        ? "bg-[rgba(47,180,99,0.16)] text-(--color-primary) shadow-[0_14px_30px_-20px_rgba(47,180,99,0.65)]"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    Ativas ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterActive("inactive")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                      filterActive === "inactive"
                        ? "bg-[rgba(21,63,41,0.26)] text-(--color-text) shadow-[0_14px_30px_-20px_rgba(15,36,24,0.55)]"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    Pausadas ({inactiveCount})
                  </button>
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-40 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)]"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
                  <div className="font-semibold">Não foi possível carregar suas automações.</div>
                  <div className="mt-1">{error}</div>
                  <button
                    type="button"
                    onClick={() => fetchRules()}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[color-mix(in_srgb,var(--color-muted) 65%,transparent)] bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] px-8 py-16 text-center text-(--color-text-muted)">
                  <Settings className="h-12 w-12 text-(--color-text-muted)" />
                  <p className="mt-4 text-sm">
                    {filterActive === "active"
                      ? "Nenhuma automação ativa no momento."
                      : filterActive === "inactive"
                      ? "Nenhuma automação pausada encontrada."
                      : "Nenhuma automação configurada ainda."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowWizard(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200  hover:bg-[#1f8b49]"
                    >
                      <Sparkles className="h-4 w-4" /> Criar automação
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterActive("all")}
                      className="inline-flex items-center gap-2 rounded-xl border border-[rgba(47,180,99,0.35)] px-4 py-2 text-sm font-semibold text-(--color-primary) transition-all hover:bg-[rgba(47,180,99,0.12)]"
                    >
                      Limpar filtros
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredRules.map((rule) => (
                    <AutomationRuleCard
                      key={rule.id}
                      rule={rule}
                      onViewLogs={() => setViewingLogsRule(rule)}
                      onEdit={() => setEditingRule(rule)}
                      onToggle={() => handleToggle(rule.id, rule.is_active)}
                      onDelete={() => handleDelete(rule.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
}

type AutomationRuleCardProps = {
  rule: AutomationRule;
  onViewLogs: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

function AutomationRuleCard({ rule, onViewLogs, onEdit, onToggle, onDelete }: AutomationRuleCardProps) {
  const triggerLabel = TRIGGER_LABELS[rule.trigger_type] || "Gatilho personalizado";
  const isActive = rule.is_active;
  const executionCount = rule.execution_count || 0;
  const conditionsCount = rule.conditions?.length || 0;
  const duplicateWindow = rule.duplicate_prevention_window_hours;
  const duplicateLabel = duplicateWindow
    ? `Janela de ${duplicateWindow}h`
    : "Sem janela de duplicidade";
  const duplicateDescription = rule.check_existing_tasks
    ? "Não cria tarefas se já existir uma semelhante."
    : "Permite criar novas tarefas mesmo com similares.";

  return (
    <div
      className={`relative overflow-hidden rounded-xl livechat-panel p-6 shadow-md transition-all duration-200  hover:shadow-md ${
        isActive ? "ring-1 ring-[rgba(47,180,99,0.35)]" : "border border-[color-mix(in_srgb,var(--color-muted) 65%,transparent)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${
          isActive ? "bg-[rgba(47,180,99,0.18)]" : "bg-[rgba(15,36,24,0.16)]"
        } blur-3xl`}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(47,180,99,0.15)] text-(--color-primary)">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-semibold text-(--color-text)">{rule.name}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                isActive
                  ? "bg-[rgba(47,180,99,0.16)] text-(--color-primary)"
                  : "bg-[color-mix(in_srgb,var(--color-muted) 70%,transparent)] text-(--color-text-muted)"
              }`}
            >
              {isActive ? "Ativa" : "Pausada"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(59,130,246,0.18)] px-3 py-1 text-xs font-semibold text-[#3b82f6]">
              {triggerLabel}
            </span>
          </div>

          {rule.description && (
            <p className="text-sm text-(--color-text-muted)">{rule.description}</p>
          )}

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)] px-3 py-2">
              <p className="font-semibold text-(--color-text)">Execuções</p>
              <p className="mt-1 text-(--color-text-muted)">
                {executionCount === 0
                  ? "Nenhuma execução registrada"
                  : `Executada ${executionCount} ${executionCount === 1 ? "vez" : "vezes"}`}
              </p>
            </div>
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)] px-3 py-2">
              <p className="font-semibold text-(--color-text)">Última execução</p>
              <p className="mt-1 text-(--color-text-muted)">
                {rule.last_executed_at
                  ? new Date(rule.last_executed_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Ainda não executada"}
              </p>
            </div>
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)] px-3 py-2">
              <p className="font-semibold text-(--color-text)">Condições</p>
              <p className="mt-1 text-(--color-text-muted)">
                {conditionsCount} {conditionsCount === 1 ? "condição" : "condições"}
              </p>
            </div>
            <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)] px-3 py-2">
              <p className="font-semibold text-(--color-text)">Proteção</p>
              <p className="mt-1 text-(--color-text-muted)">{duplicateLabel}</p>
              <p className="mt-0.5 text-(--color-text-muted)">{duplicateDescription}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onViewLogs}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-(--color-text-muted) transition-all hover:text-(--color-text)"
              title="Ver logs"
            >
              <Eye className="h-4 w-4" /> Logs
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(47,180,99,0.35)] px-3 py-2 text-xs font-semibold text-(--color-primary) transition-all hover:bg-[rgba(47,180,99,0.12)]"
              title="Editar automação"
            >
              <Settings className="h-4 w-4" /> Editar
            </button>
            <button
              type="button"
              onClick={onToggle}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[rgba(47,180,99,0.12)] text-(--color-primary) hover:bg-[rgba(47,180,99,0.18)]"
                  : "border border-[color-mix(in_srgb,var(--color-muted) 65%,transparent)] text-(--color-text-muted) hover:text-(--color-text)"
              }`}
              title={isActive ? "Pausar" : "Ativar"}
            >
              {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {isActive ? "Pausar" : "Ativar"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-red-500 transition-all hover:bg-red-50"
              title="Remover automação"
            >
              <Trash2 className="h-4 w-4" /> Remover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


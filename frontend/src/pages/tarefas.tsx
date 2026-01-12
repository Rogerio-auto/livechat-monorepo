import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTasks, useTaskStats } from "../hooks/useTasks";
import { TaskCard } from "../components/tasks/TaskCard";
import { TaskKanbanView } from "../components/tasks/TaskKanbanView";
import {
  Task,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStatus,
  TaskPriority,
  TaskType,
} from "@livechat/shared";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

type LocationState = {
  openTaskModal?: boolean;
  prefilledTask?: Partial<CreateTaskInput>;
};

type SelectOption<T extends string> = {
  value: T | "all";
  label: string;
};

type AssigneeOption = {
  value: string;
  label: string;
};

type StatHighlight = {
  key: string;
  label: string;
  value: number;
  glowClass: string;
  icon: JSX.Element;
};

type PrioritySummaryItem = {
  key: string;
  label: string;
  value: number;
};

const STATUS_OPTIONS: SelectOption<TaskStatus>[] = [
  { value: "all", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "IN_PROGRESS", label: "Em progresso" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PRIORITY_OPTIONS: SelectOption<TaskPriority>[] = [
  { value: "all", label: "Todas as prioridades" },
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

const TYPE_OPTIONS: SelectOption<TaskType>[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "GENERAL", label: "Geral" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "CALL", label: "Ligação" },
  { value: "EMAIL", label: "E-mail" },
  { value: "MEETING", label: "Reunião" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "VISIT", label: "Visita" },
];

export function TarefasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as LocationState | null) || null;

  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string | "all">("all");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [dueTodayFilter, setDueTodayFilter] = useState(false);

  const {
    tasks,
    loading,
    error,
    setFilters,
    refetch: refetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
  } = useTasks();
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useTaskStats();

  useEffect(() => {
    let isMounted = true;

    const ensureAuth = async () => {
      try {
        await fetchJson(`${API}/auth/me`);
      } catch {
        if (isMounted) {
          navigate("/login");
        }
      }
    };

    ensureAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (locationState?.openTaskModal) {
      navigate("/tarefas/nova", { state: { prefilledTask: locationState.prefilledTask } });
    }
  }, [location.pathname, locationState, navigate]);

  const assigneeOptions: AssigneeOption[] = useMemo(() => {
    const unique = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.assigned_to) {
        unique.set(
          task.assigned_to,
          task.assigned_to_name || task.assigned_to_email || "Sem responsável"
        );
      }
    });
    return Array.from(unique.entries()).map(([value, label]) => ({ value, label }));
  }, [tasks]);

  const computedFilters = useMemo<TaskFilters>(() => {
    const result: TaskFilters = {};
    if (statusFilter !== "all") result.status = statusFilter;
    if (priorityFilter !== "all") result.priority = priorityFilter;
    if (typeFilter !== "all") result.type = typeFilter;
    if (assignedFilter !== "all") result.assigned_to = assignedFilter;
    if (overdueFilter) result.overdue = true;
    if (dueTodayFilter) result.due_today = true;
    if (searchQuery.trim()) result.search = searchQuery.trim();
    return result;
  }, [statusFilter, priorityFilter, typeFilter, assignedFilter, overdueFilter, dueTodayFilter, searchQuery]);

  useEffect(() => {
    setFilters(computedFilters);
  }, [computedFilters, setFilters]);

  const statHighlights = useMemo<StatHighlight[]>(() => {
    if (!stats) return [];
    return [
      {
        key: "total",
        label: "Total",
        value: stats.total,
        glowClass: "bg-[rgba(47,180,99,0.18)]",
        icon: (
          <svg className="h-5 w-5 text-[#1f8b49]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        ),
      },
      {
        key: "pending",
        label: "Pendentes",
        value: stats.pending,
        glowClass: "bg-[rgba(255,193,7,0.22)]",
        icon: (
          <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
          </svg>
        ),
      },
      {
        key: "in_progress",
        label: "Em progresso",
        value: stats.in_progress,
        glowClass: "bg-[rgba(59,130,246,0.22)]",
        icon: (
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      },
      {
        key: "completed",
        label: "Concluídas",
        value: stats.completed,
        glowClass: "bg-[rgba(47,180,99,0.22)]",
        icon: (
          <svg className="h-5 w-5 text-[#2fb463]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ),
      },
      {
        key: "overdue",
        label: "Atrasadas",
        value: stats.overdue,
        glowClass: "bg-[rgba(239,68,68,0.22)]",
        icon: (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        key: "due_today",
        label: "Para hoje",
        value: stats.due_today,
        glowClass: "bg-[rgba(59,130,246,0.26)]",
        icon: (
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ];
  }, [stats]);

  const prioritySummary = useMemo<PrioritySummaryItem[]>(() => {
    if (!stats) return [];
    return [
      { key: "low", label: "Baixa", value: stats.by_priority.low },
      { key: "medium", label: "Média", value: stats.by_priority.medium },
      { key: "high", label: "Alta", value: stats.by_priority.high },
      { key: "urgent", label: "Urgente", value: stats.by_priority.urgent },
    ];
  }, [stats]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTypeFilter("all");
    setAssignedFilter("all");
    setOverdueFilter(false);
    setDueTodayFilter(false);
  };

  const handleEditTask = (task: Task) => {
    navigate(`/tarefas/${task.id}/editar`);
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  const handleCompleteTask = async (taskId: string) => {
    await completeTask(taskId);
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    await updateTask(taskId, { status: newStatus });
  };

  const openNewTaskModal = () => {
    navigate("/tarefas/nova");
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="mx-auto w-full max-w-[1920px] px-3 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-(--color-text)">Tarefas</h1>
                  <p className="mt-1 text-sm text-(--color-text-muted)">
                    Centralize o fluxo de trabalho e acompanhe o progresso da equipe
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 p-1 text-sm text-(--color-text-muted)">
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                        viewMode === "list"
                          ? "bg-white dark:bg-slate-900 text-(--color-primary) shadow-sm"
                          : "text-(--color-text-muted) hover:text-(--color-text)"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Lista
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("kanban")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                        viewMode === "kanban"
                          ? "bg-white dark:bg-slate-900 text-(--color-primary) shadow-sm"
                          : "text-(--color-text-muted) hover:text-(--color-text)"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      Kanban
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={openNewTaskModal}
                    className="inline-flex items-center justify-center rounded-xl bg-[#2fb463] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all duration-200  hover:bg-[#1f8b49]"
                  >
                    + Nova Tarefa
                  </button>
                </div>
              </div>

              {statsLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-28 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)]"
                    />
                  ))}
                </div>
              ) : (
                stats && (
                  <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      {statHighlights.map((item) => (
                        <div key={item.key} className="relative overflow-hidden p-5">
                          <div className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full ${item.glowClass} blur-3xl`} />
                          <div className="relative">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
                                {item.label}
                              </span>
                              {item.icon}
                            </div>
                            <div className="text-2xl font-bold text-(--color-text)">{item.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {prioritySummary.length > 0 && (
                      <div className="p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="text-sm font-semibold text-(--color-text)">Prioridades</h2>
                          <span className="text-xs text-(--color-text-muted)">Distribuição atual</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {prioritySummary.map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-2 text-sm"
                            >
                              <span className="text-(--color-text)">{item.label}</span>
                              <span className="font-semibold text-(--color-primary)">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              )}

              {(statsError || error) && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <div className="font-semibold">Não foi possível carregar todas as informações.</div>
                  <div className="mt-1">{error || statsError}</div>
                  <button
                    type="button"
                    onClick={() => {
                      refetchTasks();
                      refetchStats();
                    }}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-red-600"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              <div className="space-y-4 py-6 border-b border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar por título, responsável ou cliente..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) placeholder-(--color-text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as TaskStatus | "all")}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | "all")}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as TaskType | "all")}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {assigneeOptions.length > 0 && (
                    <select
                      value={assignedFilter}
                      onChange={(event) => setAssignedFilter(event.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm text-(--color-text) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-[rgba(47,180,99,0.25)]"
                    >
                      <option value="all">Todos os responsáveis</option>
                      {assigneeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOverdueFilter((prev) => !prev)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      overdueFilter
                        ? "bg-red-500 text-white shadow"
                        : "bg-slate-100 dark:bg-slate-800 text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    <span>Atrasadas</span>
                    {overdueFilter && (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDueTodayFilter((prev) => !prev)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      dueTodayFilter
                        ? "bg-blue-500 text-white shadow"
                        : "bg-slate-100 dark:bg-slate-800 text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    <span>Vencendo hoje</span>
                    {dueTodayFilter && (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="ml-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-(--color-text-muted) transition-all hover:text-(--color-text)"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
                  Exibindo {loading ? "..." : tasks.length} tarefas
                </span>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => refetchTasks()}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-(--color-text-muted) transition-all hover:text-(--color-text)"
                  >
                    Atualizar lista
                  </button>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-40 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 78%,transparent)]"
                    />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-8 py-16 text-center text-(--color-text-muted)">
                  <svg className="h-12 w-12 text-(--color-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 4h6" />
                  </svg>
                  <p className="mt-4 text-sm">Nenhuma tarefa encontrada com os filtros atuais.</p>
                  <button
                    type="button"
                    onClick={openNewTaskModal}
                    className="mt-6 rounded-full bg-(--color-primary) px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_46px_-24px_rgba(47,180,99,0.65)] transition-all  hover:bg-[#1f8b49]"
                  >
                    Criar primeira tarefa
                  </button>
                </div>
              ) : viewMode === "kanban" ? (
                <TaskKanbanView
                  tasks={tasks}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  onCompleteTask={handleCompleteTask}
                  onUpdateTask={handleUpdateTaskStatus}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onComplete={handleCompleteTask}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
  );
}


import { useNavigate } from "react-router-dom";
import { useTasks, useTaskStats } from "../../hooks/useTasks";
import { format, isToday, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_COLORS = {
  LOW: "text-[var(--color-text-muted)] bg-[rgba(47,180,99,0.08)] dark:bg-[rgba(27,58,41,0.55)] dark:text-[var(--color-text-muted)]",
  MEDIUM: "text-[#1f8b49] bg-[rgba(47,180,99,0.16)] dark:bg-[rgba(27,58,41,0.6)] dark:text-[#74e69e]",
  HIGH: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  URGENT: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_LABELS = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export function TasksWidget() {
  const navigate = useNavigate();
  const { stats } = useTaskStats();
  
  // Buscar tarefas atrasadas e de hoje
  const { tasks: overdueTasks } = useTasks({ overdue: true });
  const { tasks: todayTasks } = useTasks({ due_today: true });

  const completionRate = stats
    ? stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0
    : 0;

  const handleTaskClick = (taskId: string) => {
    navigate(`/tarefas`);
  };

  return (
    <div className="livechat-card rounded-3xl p-5 shadow-xl transition-colors duration-300 flex flex-col max-h-[600px] overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(47,180,99,0.16)]">
            <svg className="h-5 w-5 text-[#1f8b49] dark:text-[#74e69e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text)]">Tarefas</h3>
            <p className="text-xs text-[var(--color-text-muted)]">Acompanhe suas atividades</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/tarefas")}
          className="text-sm font-medium text-[#2fb463] transition-colors hover:text-[#1f8b49] dark:text-[#74e69e]"
        >
          Ver todas →
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 flex-shrink-0">
          {/* Pendentes */}
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pending}</p>
          </div>

          {/* Atrasadas */}
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-medium text-red-800 dark:text-red-300">Atrasadas</span>
            </div>
            <p className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.overdue}</p>
          </div>

          {/* Em Progresso */}
          <div className="rounded-xl border border-[rgba(47,180,99,0.28)] dark:border-[rgba(116,230,158,0.18)] bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)] p-4">
            <div className="mb-1 flex items-center gap-2">
              <svg className="h-4 w-4 text-[#2fb463]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-medium text-[#1f8b49] dark:text-[#74e69e]">Em Andamento</span>
            </div>
            <p className="text-2xl font-bold text-[#1f8b49] dark:text-[#74e69e]">{stats.in_progress}</p>
          </div>

          {/* Concluídas */}
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-green-800 dark:text-green-300">Concluídas</span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.completed}</p>
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[rgba(47,180,99,0.3)] scrollbar-track-transparent hover:scrollbar-thumb-[rgba(47,180,99,0.5)]">
        {/* Completion Progress Bar */}
        {stats && stats.total > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Taxa de Conclusão</span>
              <span className="text-xs font-bold text-[var(--color-text)]">{completionRate}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2fb463] to-[#1f8b49] transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <div className="mb-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Tarefas Atrasadas ({overdueTasks.length})
          </h4>
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map((task) => (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task.id)}
                className="w-full rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-3 text-left transition-all hover:bg-red-100 dark:hover:bg-red-900/20 hover:shadow-md"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">{task.title}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
                {task.due_date && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Venceu em {format(parseISO(task.due_date), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today Tasks */}
      {todayTasks.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1f8b49] dark:text-[#74e69e]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Tarefas de Hoje ({todayTasks.length})
          </h4>
          <div className="space-y-2">
            {todayTasks.slice(0, 3).map((task) => (
              <button
                key={task.id}
                onClick={() => handleTaskClick(task.id)}
                className="w-full rounded-xl border border-[rgba(47,180,99,0.28)] dark:border-[rgba(116,230,158,0.18)] bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)] p-3 text-left transition-all hover:bg-[rgba(47,180,99,0.18)] dark:hover:bg-[rgba(27,58,41,0.72)] hover:shadow-md"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--color-text)] line-clamp-1">{task.title}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
                {task.due_date && (
                  <p className="text-xs text-[#1f8b49] dark:text-[#74e69e]">
                    Hoje às {format(parseISO(task.due_date), "HH:mm")}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {overdueTasks.length === 0 && todayTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="mb-3 h-12 w-12 text-[rgba(47,180,99,0.25)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-[var(--color-text)]">Tudo em dia!</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Nenhuma tarefa urgente no momento</p>
        </div>
      )}
      </div>
    </div>
  );
}

import type { Task } from "../../types/tasks";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onComplete: (taskId: string) => void;
}

const statusLabels: Record<Task["status"], string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Progresso",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const statusColors: Record<Task["status"], string> = {
  PENDING: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-green-500/10 text-green-600 dark:text-green-400",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const priorityLabels: Record<Task["priority"], string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const priorityColors: Record<Task["priority"], string> = {
  LOW: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  HIGH: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  URGENT: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const typeLabels: Record<Task["type"], string> = {
  GENERAL: "Geral",
  FOLLOW_UP: "Follow-up",
  CALL: "Ligação",
  EMAIL: "E-mail",
  MEETING: "Reunião",
  WHATSAPP: "WhatsApp",
  PROPOSAL: "Proposta",
  VISIT: "Visita",
};

const typeIcons: Record<Task["type"], string> = {
  GENERAL: "📋",
  FOLLOW_UP: "🔄",
  CALL: "📞",
  EMAIL: "📧",
  MEETING: "🤝",
  WHATSAPP: "💬",
  PROPOSAL: "📄",
  VISIT: "🚗",
};

export function TaskCard({ task, onEdit, onDelete, onComplete }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "COMPLETED";
  const isDueToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();

  const getInitial = (name?: string | null) => {
    return name?.charAt(0).toUpperCase() || "?";
  };

  const getInitialColor = (name?: string | null) => {
    const colors = [
      "bg-blue-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-red-500",
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatDueDate = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return date;
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 transition-all duration-200 hover:shadow-lg hover:border-blue-500/50">
      {/* Overdue or Due Today Indicator */}
      {isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-red-500 to-orange-500" />
      )}
      {isDueToday && !isOverdue && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-blue-500 to-purple-500" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl mt-0.5">{typeIcons[task.type]}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status !== "COMPLETED" && (
            <button
              type="button"
              onClick={() => onComplete(task.id)}
              title="Concluir"
              className="rounded-lg p-1.5 text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/10"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(task)}
            title="Editar"
            className="rounded-lg p-1.5 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Tem certeza que deseja excluir esta tarefa?")) {
                onDelete(task.id);
              }
            }}
            title="Excluir"
            className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[task.status]}`}>
          {statusLabels[task.status]}
        </span>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${priorityColors[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
          {typeLabels[task.type]}
        </span>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
        {/* Due Date */}
        {task.due_date && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={isOverdue ? "text-red-500 font-medium" : ""}>
              {formatDueDate(task.due_date)}
              {isOverdue && " (atrasada)"}
              {isDueToday && !isOverdue && " (hoje)"}
            </span>
          </div>
        )}

        {/* Assigned To */}
        {task.assigned_to_name && (
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${getInitialColor(task.assigned_to_name)} text-white text-xs font-semibold`}>
              {getInitial(task.assigned_to_name)}
            </div>
            <span>{task.assigned_to_name}</span>
          </div>
        )}

        {/* Related Entities */}
        {task.lead_name && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Lead: {task.lead_name}</span>
          </div>
        )}
        {task.customer_name && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Cliente: {task.customer_name}</span>
          </div>
        )}
        {task.kanban_column_name && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span>Etapa: {task.kanban_column_name}</span>
          </div>
        )}

        {/* Reminder */}
        {task.reminder_enabled && (
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>
              Lembrete {task.reminder_sent ? "enviado" : "agendado"}
              {task.reminder_time && ` para ${formatDueDate(task.reminder_time)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

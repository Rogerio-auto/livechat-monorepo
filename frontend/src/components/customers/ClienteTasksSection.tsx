import { useState } from "react";
import { useTasksByEntity } from "../../hooks/useTasks";
import { TaskModal } from "../tasks/TaskModal";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../../types/tasks";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FaPlus, FaTimes, FaCheckCircle, FaClock, FaExclamationTriangle } from "react-icons/fa";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

interface ClienteTasksSectionProps {
  leadId: string;
  customerId?: string;
  customerName: string;
}

const PRIORITY_COLORS = {
  LOW: "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
  HIGH: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  URGENT: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_LABELS = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const STATUS_COLORS = {
  PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400",
  COMPLETED: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400",
  CANCELLED: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400",
};

const STATUS_LABELS = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Progresso",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

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

export function ClienteTasksSection({ leadId, customerId, customerName }: ClienteTasksSectionProps) {
  // Se houver customer_id válido, busca por customer, senão busca por lead
  const hasValidCustomerId = customerId && customerId.trim() !== '';
  const entityType = hasValidCustomerId ? "customer" : "lead";
  const entityId = hasValidCustomerId ? customerId : leadId;
  const { tasks, loading, error, refetch } = useTasksByEntity(entityType, entityId);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleCreateTask = async (data: CreateTaskInput) => {
    try {
      const hasValidCustomerId = customerId && customerId.trim() !== '';
      const payload = {
        ...data,
        // Se houver customer_id válido, usa related_customer_id, senão usa related_lead_id
        ...(hasValidCustomerId ? { related_customer_id: customerId } : { related_lead_id: leadId }),
      };
      
      console.log('[ClienteTasksSection] 📝 Criando tarefa:', {
        leadId,
        customerId,
        hasValidCustomerId,
        willUse: hasValidCustomerId ? 'related_customer_id' : 'related_lead_id',
        payload
      });
      
      await fetchJson(`${API}/api/tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowTaskModal(false);
      if (refetch) refetch();
    } catch (error) {
      console.error("Falha ao criar tarefa:", error);
      throw error;
    }
  };

  const handleUpdateTask = async (data: UpdateTaskInput) => {
    if (!editingTask) return;
    try {
      await fetchJson(`${API}/api/tasks/${editingTask.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setShowTaskModal(false);
      setEditingTask(null);
      if (refetch) refetch();
    } catch (error) {
      console.error("Falha ao atualizar tarefa:", error);
      throw error;
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetchJson(`${API}/api/tasks/${taskId}/complete`, {
        method: "PATCH",
      });
      if (refetch) refetch();
    } catch (error) {
      console.error("Falha ao completar tarefa:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    try {
      await fetchJson(`${API}/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (refetch) refetch();
    } catch (error) {
      console.error("Falha ao excluir tarefa:", error);
    }
  };

  const getTaskIcon = (task: Task) => {
    if (task.status === "COMPLETED") {
      return <FaCheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    }
    if (task.due_date && new Date(task.due_date) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status)) {
      return <FaExclamationTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
    return <FaClock className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tarefas</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gerencie as tarefas relacionadas a {customerName}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setShowTaskModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
        >
          <FaPlus className="h-3 w-3" />
          Nova Tarefa
        </button>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Carregando tarefas...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 py-12">
          <svg className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Nenhuma tarefa cadastrada</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Clique em "Nova Tarefa" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {getTaskIcon(task)}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white line-clamp-1">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Vence: {format(parseISO(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      {task.assigned_to_name && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Responsável: {task.assigned_to_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {task.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="rounded-lg p-2 text-green-600 dark:text-green-400 transition-colors hover:bg-green-500/10"
                      title="Marcar como concluída"
                    >
                      <FaCheckCircle className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingTask(task);
                      setShowTaskModal(true);
                    }}
                    className="rounded-lg p-2 text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-500/10"
                    title="Editar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10"
                    title="Excluir"
                  >
                    <FaTimes className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        onSubmit={editingTask ? (data) => handleUpdateTask(data as UpdateTaskInput) : (data) => handleCreateTask(data as CreateTaskInput)}
        initialData={editingTask || undefined}
      />
    </div>
  );
}

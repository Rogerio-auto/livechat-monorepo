import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTasksByEntity } from "../../hooks/useTasks";
import { TaskModal } from "../tasks/TaskModal";
import type { Task, CreateTaskDTO as CreateTaskInput, UpdateTaskDTO as UpdateTaskInput } from "@livechat/shared";
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
  LOW: "text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400",
  MEDIUM: "text-[#1f6feb] bg-[#1f6feb]/10 dark:text-[#388bfd]",
  HIGH: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400",
  URGENT: "text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400",
};

const PRIORITY_LABELS = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const STATUS_COLORS = {
  PENDING: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400",
  IN_PROGRESS: "bg-[#1f6feb]/10 text-[#1f6feb] dark:text-[#388bfd]",
  COMPLETED: "bg-[#2fb463]/10 text-[#2fb463] dark:text-[#74e69e]",
  CANCELLED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
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
  const navigate = useNavigate();

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
      return <FaCheckCircle className="h-5 w-5 text-[#2fb463]" />;
    }
    if (task.due_date && new Date(task.due_date) < new Date() && !["COMPLETED", "CANCELLED"].includes(task.status)) {
      return <FaExclamationTriangle className="h-5 w-5 text-rose-500" />;
    }
    return <FaClock className="h-5 w-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tarefas</h3>
          <p className="text-sm text-slate-500">
            Gerencie as tarefas relacionadas a {customerName}
          </p>
        </div>
        <button
          onClick={() => navigate(`/clientes/${leadId}/tarefas/nova`)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2fb463] px-4 py-2 text-sm font-bold text-white shadow-lg shadow-[#2fb463]/20 transition-all  hover:bg-[#1f8b49]"
        >
          <FaPlus className="h-3 w-3" />
          Nova Tarefa
        </button>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2fb463] border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-16 bg-slate-50/30 dark:bg-slate-800/5">
          <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">Nenhuma tarefa cadastrada</p>
          <p className="text-sm text-slate-500 mt-1">Clique em "Nova Tarefa" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] p-5 transition-all hover:shadow-sm hover:border-[#2fb463]/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    {getTaskIcon(task)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-base font-bold text-slate-900 dark:text-white line-clamp-1 ${task.status === 'COMPLETED' ? 'line-through opacity-50' : ''}`}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {task.due_date && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <FaClock className="h-3 w-3" />
                          {format(parseISO(task.due_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.status !== "COMPLETED" && (
                    <button
                      onClick={() => handleCompleteTask(task.id)}
                      className="rounded-xl p-2 text-[#2fb463] transition-all hover:bg-[#2fb463]/10"
                      title="Marcar como concluída"
                    >
                      <FaCheckCircle className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingTask(task);
                      setShowTaskModal(true);
                    }}
                    className="rounded-xl p-2 text-[#1f6feb] transition-all hover:bg-[#1f6feb]/10"
                    title="Editar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="rounded-xl p-2 text-rose-500 transition-all hover:bg-rose-500/10"
                    title="Excluir"
                  >
                    <FaTimes className="h-5 w-5" />
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


import { useState, useEffect } from "react";
import { FaCheckCircle, FaPlus } from "react-icons/fa";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

interface TaskBadgeProps {
  leadId: string;
  onCreateTask?: () => void;
}

interface TaskCount {
  total: number;
  pending: number;
  overdue: number;
}

export function LeadTaskBadge({ leadId, onCreateTask }: TaskBadgeProps) {
  const [taskCount, setTaskCount] = useState<TaskCount>({ total: 0, pending: 0, overdue: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTaskCount = async () => {
      if (!leadId) return;
      
      try {
        setLoading(true);
        const res = await fetch(`${API}/api/tasks?related_lead_id=${leadId}`, {
          credentials: "include",
        });
        
        if (!res.ok) throw new Error("Failed to fetch tasks");
        
        const data = await res.json();
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        
        const pending = tasks.filter((t: any) => t.status === "PENDING").length;
        const now = new Date();
        const overdue = tasks.filter((t: any) => {
          if (t.status === "COMPLETED") return false;
          if (!t.due_date) return false;
          return new Date(t.due_date) < now;
        }).length;
        
        setTaskCount({ total: tasks.length, pending, overdue });
      } catch (error) {
        console.error("[LeadTaskBadge] Error fetching tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaskCount();

    // Atualizar quando tarefas mudarem via Socket.io
    const handleTaskUpdate = () => {
      fetchTaskCount();
    };

    // Escutar eventos globais de tarefas (você pode refinar para filtrar por leadId)
    window.addEventListener("task:created", handleTaskUpdate);
    window.addEventListener("task:updated", handleTaskUpdate);
    window.addEventListener("task:deleted", handleTaskUpdate);

    return () => {
      window.removeEventListener("task:created", handleTaskUpdate);
      window.removeEventListener("task:updated", handleTaskUpdate);
      window.removeEventListener("task:deleted", handleTaskUpdate);
    };
  }, [leadId]);

  if (loading) return null;
  if (taskCount.total === 0 && !onCreateTask) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Badge de contagem */}
      {taskCount.total > 0 && (
        <div className="flex items-center gap-1.5">
          {taskCount.overdue > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-100"
              title={`${taskCount.overdue} tarefa(s) atrasada(s)`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {taskCount.overdue}
            </span>
          )}
          
          {taskCount.pending > 0 && taskCount.overdue === 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100"
              title={`${taskCount.pending} tarefa(s) pendente(s)`}
            >
              <FaCheckCircle className="h-2.5 w-2.5" />
              {taskCount.pending}
            </span>
          )}
          
          {taskCount.pending === 0 && taskCount.overdue === 0 && taskCount.total > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"
              title="Todas as tarefas concluídas"
            >
              <FaCheckCircle className="h-2.5 w-2.5" />
              {taskCount.total}
            </span>
          )}
        </div>
      )}

      {/* Botão de criar tarefa */}
      {onCreateTask && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateTask();
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 transition-all hover:bg-emerald-500 hover:text-white hover:border-emerald-600 active:scale-95"
          title="Criar tarefa para este lead"
        >
          <FaPlus className="h-2.5 w-2.5" />
          Tarefa
        </button>
      )}
    </div>
  );
}

import { TaskForm } from "./TaskForm";
import {
  Task,
  CreateTaskDTO as CreateTaskInput,
  UpdateTaskDTO as UpdateTaskInput,
} from "@livechat/shared";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  initialData?: Task | null;
  prefilledData?: Partial<CreateTaskInput>;
}

export function TaskModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  prefilledData,
}: TaskModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1015] shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1015]/95 backdrop-blur-sm px-8 py-5">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {initialData ? "Editar Tarefa" : "Nova Tarefa"}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {initialData ? "Atualize os dados da tarefa" : "Preencha os dados para criar uma nova tarefa"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-slate-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Fechar
          </button>
        </div>

        <TaskForm
          onSubmit={onSubmit}
          onClose={onClose}
          initialData={initialData}
          prefilledData={prefilledData}
          isModal={true}
        />
      </div>
    </div>
  );
}

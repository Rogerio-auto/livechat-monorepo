import { useState } from "react";
import type { Task, TaskStatus } from "../../types/tasks";
import { TaskCard } from "./TaskCard";

interface TaskKanbanViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, status: TaskStatus) => void;
}

interface KanbanColumn {
  id: TaskStatus;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    id: "PENDING",
    title: "Pendente",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  {
    id: "IN_PROGRESS",
    title: "Em Progresso",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "COMPLETED",
    title: "Concluída",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
  },
];

export function TaskKanbanView({
  tasks,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
  onUpdateTask,
}: TaskKanbanViewProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return tasks.filter((task) => task.status === status);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    
    if (draggedTask && draggedTask.status !== newStatus) {
      onUpdateTask(draggedTask.id, newStatus);
    }
    
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {COLUMNS.map((column) => {
        const columnTasks = getTasksByStatus(column.id);
        const isOver = dragOverColumn === column.id;
        const canDrop = draggedTask && draggedTask.status !== column.id;

        return (
          <div
            key={column.id}
            className={`flex flex-col rounded-2xl border-2 ${column.borderColor} ${column.bgColor} p-4 transition-all duration-200 ${
              isOver && canDrop ? "ring-4 ring-blue-400 ring-opacity-50 scale-105" : ""
            }`}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className={`text-lg font-bold ${column.color}`}>
                  {column.title}
                </h3>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${column.bgColor} text-sm font-semibold ${column.color}`}
                >
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Tasks List */}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {columnTasks.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma tarefa
                  </p>
                </div>
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-move transition-all duration-200 ${
                      draggedTask?.id === task.id ? "opacity-50 scale-95" : ""
                    }`}
                  >
                    <TaskCard
                      task={task}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onComplete={onCompleteTask}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// frontend/src/components/projects/ProjectCard.tsx

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Project, TemplateWithDetails } from "../../types/projects";

type Props = {
  project: Project;
  template: TemplateWithDetails | null;
  isDragging?:  boolean;
};

export default function ProjectCard({ project, template, isDragging = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: project.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    urgent: 'bg-red-500/10 text-red-500',
    high: 'bg-orange-500/10 text-orange-500',
    medium: 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]',
    low: 'bg-gray-500/10 text-gray-500',
  };

  const statusIcons = {
    active: '🔵',
    completed: '✅',
    on_hold: '⏸️',
    cancelled: '❌',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[color:var(--color-surface)] rounded-lg border border-[color:var(--color-border)] p-4 cursor-pointer hover:shadow-lg transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-[color:var(--color-text)] mb-1 line-clamp-2">
            {project.title}
          </h4>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {project.project_number}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-lg">{statusIcons[project.status]}</span>
          {project.is_favorite && <span className="text-yellow-500">⭐</span>}
        </div>
      </div>

      {/* Customer */}
      {project.customer_name && (
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-text-muted)] mb-2">
          <span>👤</span>
          <span className="truncate">{project.customer_name}</span>
        </div>
      )}

      {/* Custom Fields (que devem aparecer no card) */}
      {template?.custom_fields
        .filter((field) => field.show_in_card && project.custom_fields[field.field_key])
        .slice(0, 2)
        .map((field) => (
          <div key={field.id} className="text-sm text-[color:var(--color-text-muted)] mb-1">
            <span className="font-medium">{field.field_label}:</span>{' '}
            {formatFieldValue(project.custom_fields[field.field_key], field.field_type)}
          </div>
        ))}

      {/* Value */}
      {project.estimated_value && (
        <div className="text-lg font-bold text-[color:var(--color-primary)] mb-2">
          {formatCurrency(project.estimated_value, project.currency)}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[color:var(--color-border)]">
        <div className="flex items-center gap-2">
          {/* Priority Badge */}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityColors[project.priority]}`}>
            {project.priority.toUpperCase()}
          </span>

          {/* Tags */}
          {project.tags.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Date */}
        {project.start_date && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            📅 {formatDate(project.start_date)}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {project.progress_percentage > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Progresso</span>
            <span>{project.progress_percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${project.progress_percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HELPERS ====================

function formatFieldValue(value: any, type: string): string {
  if (value === null || value === undefined) return '—';

  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'date': 
      return formatDate(value);
    case 'boolean':
      return value ? 'Sim' : 'Não';
    case 'number':
      return value.toLocaleString('pt-BR');
    default:
      return String(value);
  }
}

function formatCurrency(value: number, currency: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

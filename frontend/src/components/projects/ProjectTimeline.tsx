// frontend/src/components/projects/ProjectTimeline.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { ProjectActivity } from "@livechat/shared";

const API = import.meta.env.VITE_API_URL;

type Props = {
  projectId: string;
};

export default function ProjectTimeline({ projectId }: Props) {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<ProjectActivity[]>(`${API}/projects/${projectId}/activities`)
      .then(setActivities)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-(--color-text-muted)">
        <div className="text-4xl mb-2">📅</div>
        <p>Nenhuma atividade registrada ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          isLast={index === activities.length - 1}
        />
      ))}
    </div>
  );
}

// ==================== ACTIVITY ITEM ====================

function ActivityItem({ activity, isLast }: { activity: ProjectActivity; isLast: boolean }) {
  const activityIcons:  Record<string, string> = {
    created: '🎉',
    stage_change: '➡️',
    field_update: '✏️',
    comment:  '💬',
    file_upload: '📎',
    file_delete: '🗑️',
    assigned:  '👤',
    unassigned: '👤',
    status_change: '🔄',
    completed: '✅',
    reopened: '🔓',
  };

  const icon = activityIcons[activity. activity_type] || '📌';

  return (
    <div className="flex gap-4">
      {/* Timeline Line */}
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-(--color-primary)/10 flex items-center justify-center text-lg">
          {icon}
        </div>
        {! isLast && (
          <div className="w-0.5 flex-1 bg-(--color-border) my-1"></div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-(--color-surface-muted) rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-(--color-text)">
              {activity.title || formatActivityType(activity.activity_type)}
            </h4>
            <span className="text-xs text-(--color-text-muted)">
              {formatDateTime(activity.created_at)}
            </span>
          </div>
          
          {activity.description && (
            <p className="text-sm text-(--color-text-muted) mb-2">
              {activity.description}
            </p>
          )}

          {activity.activity_type === 'stage_change' && activity.metadata && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Estágio alterado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== HELPERS ====================

function formatActivityType(type: string): string {
  const labels: Record<string, string> = {
    created: 'Projeto criado',
    stage_change:  'Estágio alterado',
    field_update: 'Campos atualizados',
    comment: 'Comentário adicionado',
    file_upload: 'Arquivo enviado',
    file_delete: 'Arquivo removido',
    assigned: 'Usuário atribuído',
    unassigned: 'Usuário removido',
    status_change:  'Status alterado',
    completed: 'Projeto concluído',
    reopened: 'Projeto reaberto',
  };
  return labels[type] || type;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}m atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

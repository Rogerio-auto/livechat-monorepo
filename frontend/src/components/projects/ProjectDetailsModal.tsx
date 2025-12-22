// frontend/src/components/projects/ProjectDetailsModal.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { Project, TemplateWithDetails } from "../../types/projects";
import ProjectTimeline from "./ProjectTimeline";
import ProjectComments from "./ProjectComments";
import ProjectAttachments from "./ProjectAttachments";
import ProjectTasks from "./ProjectTasks";
import ProjectForm from "./ProjectForm";
import { Button } from "../ui";

const API = import.meta.env.VITE_API_URL;

type Props = {
  project: Project;
  template:  TemplateWithDetails;
  onClose: () => void;
  onUpdate:  () => void;
};

type TabType = 'overview' | 'timeline' | 'comments' | 'attachments' | 'tasks';

export default function ProjectDetailsModal({ project:  initialProject, template, onClose, onUpdate }: Props) {
  const [project, setProject] = useState(initialProject);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sincronizar estado local se o projeto inicial mudar
  useEffect(() => {
    setProject(initialProject);
  }, [initialProject]);

  // Buscar dados atualizados do projeto
  const refreshProject = async () => {
    try {
      const data = await fetchJson<Project>(`${API}/projects/${project.id}`);
      setProject(data);
    } catch (error) {
      console.error("Error refreshing project:", error);
    }
  };

  const handleStageChange = async (newStageId: string) => {
    setLoading(true);
    try {
      await fetchJson(`${API}/projects/${project.id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ stage_id: newStageId }),
      });
      await refreshProject();
      onUpdate();
    } catch (error) {
      console.error("Error changing stage:", error);
      alert("Erro ao mudar estágio");
    } finally {
      setLoading(false);
    }
  };

  const handleProgressChange = async (newProgress: number) => {
    try {
      await fetchJson(`${API}/projects/${project.id}`, {
        method: 'PUT',
        body: JSON. stringify({ progress_percentage: newProgress }),
      });
      setProject({ ...project, progress_percentage: newProgress });
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    try {
      await fetchJson(`${API}/projects/${project.id}/archive`, {
        method: 'PUT',
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error archiving project:", error);
      alert("Erro ao arquivar projeto");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await fetchJson(`${API}/projects/${project.id}`, {
        method: 'DELETE',
      });
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Erro ao deletar projeto");
    } finally {
      setLoading(false);
    }
  };

  const currentStage = template.stages.find(s => s.id === project.current_stage_id);
  const statusColors = {
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const priorityColors = {
    urgent: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-green-600 dark:text-green-400',
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {project.title}
                  </h2>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${statusColors[project. status]}`}>
                    {project.status. toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-mono">{project.project_number}</span>
                  {currentStage && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentStage.color }}></span>
                      {currentStage.name}
                    </span>
                  )}
                  <span className={`font-semibold ${priorityColors[project.priority]}`}>
                    {project.priority === 'urgent' && '🔴'}
                    {project. priority === 'high' && '🟠'}
                    {project.priority === 'medium' && '🟡'}
                    {project.priority === 'low' && '🟢'}
                    {' '}
                    {project. priority. toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={() => setShowEditForm(true)} variant="ghost" size="sm">
                ✏️ Editar
              </Button>
              <Button onClick={handleArchive} variant="ghost" size="sm" disabled={loading}>
                📦 Arquivar
              </Button>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="ghost" size="sm">
                🗑️ Excluir
              </Button>
              <div className="flex-1"></div>
              {project.is_favorite ?  (
                <button className="text-yellow-500 text-xl">⭐</button>
              ) : (
                <button className="text-gray-400 hover:text-yellow-500 text-xl">☆</button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1 px-6">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                📋 Visão Geral
              </TabButton>
              <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
                📅 Timeline
              </TabButton>
              <TabButton active={activeTab === 'comments'} onClick={() => setActiveTab('comments')}>
                💬 Comentários
              </TabButton>
              <TabButton active={activeTab === 'attachments'} onClick={() => setActiveTab('attachments')}>
                📎 Arquivos
              </TabButton>
              <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>
                ✅ Tarefas
              </TabButton>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <OverviewTab 
                project={project} 
                template={template}
                onStageChange={handleStageChange}
                onProgressChange={handleProgressChange}
                loading={loading}
              />
            )}
            {activeTab === 'timeline' && <ProjectTimeline projectId={project.id} />}
            {activeTab === 'comments' && <ProjectComments projectId={project.id} />}
            {activeTab === 'attachments' && <ProjectAttachments projectId={project.id} />}
            {activeTab === 'tasks' && <ProjectTasks projectId={project.id} />}
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <ProjectForm
          template={template}
          project={project}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            refreshProject();
            onUpdate();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja excluir o projeto <strong>{project.title}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setShowDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
              <Button onClick={handleDelete} variant="primary" disabled={loading}>
                {loading ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==================== TAB BUTTON ====================

function TabButton({ active, onClick, children }: { active: boolean; onClick:  () => void; children: React. ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// ==================== OVERVIEW TAB ====================

type OverviewTabProps = {
  project: Project;
  template: TemplateWithDetails;
  onStageChange: (stageId: string) => void;
  onProgressChange: (progress: number) => void;
  loading: boolean;
};

function OverviewTab({ project, template, onStageChange, onProgressChange, loading }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stage Selector */}
      <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Estágio Atual
        </h3>
        <select
          value={project.current_stage_id || ''}
          onChange={(e) => onStageChange(e. target.value)}
          disabled={loading}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Selecione um estágio... </option>
          {template.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </section>

      {/* Progress */}
      <section className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Progresso do Projeto
          </h3>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {project.progress_percentage}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={project. progress_percentage}
          onChange={(e) => onProgressChange(parseInt(e.target.value))}
          className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </section>

      {/* Basic Info */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Informações Gerais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.description && (
            <div className="md:col-span-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Descrição</label>
              <p className="text-gray-900 dark:text-white mt-1">{project.description}</p>
            </div>
          )}

          {project.customer_name && (
            <InfoCard label="Cliente" value={project. customer_name} icon="👤" />
          )}
          {project.customer_phone && (
            <InfoCard label="Telefone" value={project.customer_phone} icon="📱" />
          )}
          {project.customer_email && (
            <InfoCard label="Email" value={project.customer_email} icon="📧" />
          )}
          {project.estimated_value && (
            <InfoCard 
              label="Valor Estimado" 
              value={formatCurrency(project.estimated_value, project.currency)} 
              icon="💰" 
            />
          )}
          {project.start_date && (
            <InfoCard label="Data de Início" value={formatDate(project.start_date)} icon="📅" />
          )}
          {project.estimated_end_date && (
            <InfoCard label="Previsão de Término" value={formatDate(project. estimated_end_date)} icon="🏁" />
          )}
        </div>
      </section>

      {/* Custom Fields */}
      {template.custom_fields.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Informações Específicas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {template.custom_fields.map((field) => {
              const value = project.custom_fields[field.field_key];
              if (! value && value !== 0 && value !== false) return null;
              
              return (
                <InfoCard
                  key={field. id}
                  label={field. field_label}
                  value={formatFieldValue(value, field.field_type)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Tags */}
      {project.tags.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {project. tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ==================== INFO CARD ====================

function InfoCard({ label, value, icon }: { label: string; value:  string; icon?:  string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-lg">{icon}</span>}
        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</label>
      </div>
      <p className="text-gray-900 dark:text-white font-semibold">{value}</p>
    </div>
  );
}

// ==================== HELPERS ====================

function formatCurrency(value: number, currency: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatFieldValue(value: any, type: string): string {
  if (value === null || value === undefined) return '—';

  switch (type) {
    case 'currency':
      return formatCurrency(value);
    case 'date':
    case 'datetime':
      return formatDate(value);
    case 'boolean':
      return value ? '✅ Sim' : '❌ Não';
    case 'number':
      return value.toLocaleString('pt-BR');
    default:
      return String(value);
  }
}

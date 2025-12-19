// frontend/src/pages/projects/ProjectDetails.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  Calendar, 
  User, 
  Tag, 
  Clock, 
  CheckSquare, 
  MessageSquare, 
  Paperclip, 
  History,
  MoreVertical,
  Plus,
  Send,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Edit3,
  Settings,
  LayoutGrid
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProjectWithDetails, TemplateWithDetails } from "../../types/projects";
import ProjectTasks from "../../components/projects/ProjectTasks";
import ProjectComments from "../../components/projects/ProjectComments";
import ProjectAttachments from "../../components/projects/ProjectAttachments";
import ProjectTimeline from "../../components/projects/ProjectTimeline";
import ProjectForm from "../../components/projects/ProjectForm";

const API = import.meta.env.VITE_API_URL;

const ProjectDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [template, setTemplate] = useState<TemplateWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects/${id}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setProject(data);
        
        // Fetch template details if we have a template_id
        if (data.template_id) {
          const tResp = await fetch(`${API}/projects/templates/${data.template_id}`, {
            credentials: "include"
          });
          if (tResp.ok) {
            const tData = await tResp.json();
            setTemplate(tData);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching project details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm("Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const response = await fetch(`${API}/projects/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (response.ok) {
        navigate("/projects");
      } else {
        alert("Erro ao excluir projeto");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Erro ao excluir projeto");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed": return "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] border-[color:var(--color-primary)]/20";
      case "pending": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "cancelled": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-[color:var(--color-text-muted)]/10 text-[color:var(--color-text-muted)] border-[color:var(--color-text-muted)]/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-[color:var(--color-primary)]";
      default: return "bg-[color:var(--color-text-muted)]";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full livechat-theme bg-[color:var(--color-bg)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--color-primary)]"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 livechat-theme bg-[color:var(--color-bg)]">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold text-[color:var(--color-text)]">Projeto não encontrado</h2>
        <button 
          onClick={() => navigate("/projects")}
          className="px-4 py-2 bg-[color:var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-colors"
        >
          Voltar para Projetos
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col livechat-theme relative overflow-visible">
      {/* Header */}
      <div className="sticky top-0 livechat-panel border-b border-[color:var(--color-border)] px-6 py-4 shadow-sm z-[1000] overflow-visible">
        <div className="max-w-[1600px] mx-auto overflow-visible">
          <div className="flex items-center justify-between overflow-visible">
            <div className="flex items-center gap-4 overflow-visible">
              <button 
                onClick={() => navigate("/projects")}
                className="p-2 hover:bg-[color:var(--color-surface-muted)] rounded-xl transition-colors text-[color:var(--color-text-muted)]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="overflow-visible">
                <div className="flex items-center gap-3 overflow-visible">
                  <h1 className="text-xl font-bold text-[color:var(--color-text)]">{project.title}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-muted)] mt-0.5 overflow-visible">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    {project.template?.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    {project.owner?.name || "Sem responsável"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 relative overflow-visible">
              <button 
                onClick={() => setShowEditForm(true)}
                className="p-2 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-muted)] rounded-lg transition-all border border-[color:var(--color-border)]"
                title="Configurações do Projeto"
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <div className="relative overflow-visible">
                <button 
                  onClick={() => setShowActions(!showActions)}
                  className="flex items-center gap-2 px-4 py-2 bg-[color:var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all text-xs font-bold shadow-sm active:scale-95"
                >
                  Ações
                </button>

                {showActions && (
                  <>
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={() => setShowActions(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-xl shadow-2xl z-[9999] py-2 animate-in fade-in zoom-in duration-200">
                      <button
                        onClick={() => {
                          setShowEditForm(true);
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)] transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Editar Projeto
                      </button>
                      <div className="h-px bg-[color:var(--color-border)] my-1" />
                      <button
                        onClick={() => {
                          handleDeleteProject();
                          setShowActions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Projeto
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && template && (
        <ProjectForm
          template={template}
          project={project}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            fetchProjectDetails();
          }}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[color:var(--color-bg)] relative z-0">
        <div className="max-w-[1600px] mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Main Info & Tasks (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Quick Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="livechat-card p-4 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Datas</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[color:var(--color-text-muted)]">Início: <span className="font-semibold text-[color:var(--color-text)]">{project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy") : "-"}</span></p>
                    <p className="text-xs text-[color:var(--color-text-muted)]">Prazo: <span className="font-semibold text-[color:var(--color-text)]">{project.estimated_end_date ? format(new Date(project.estimated_end_date), "dd/MM/yyyy") : "-"}</span></p>
                  </div>
                </div>
                <div className="livechat-card p-4 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] mb-2">
                    <Tag className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Financeiro</span>
                  </div>
                  <p className="text-lg font-bold text-[color:var(--color-text)]">R$ {(project.estimated_value || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-[color:var(--color-text-muted)]">Orçamento Estimado</p>
                </div>
                <div className="livechat-card p-4 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 text-[color:var(--color-text-muted)] mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Progresso</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[color:var(--color-primary)]">{project.progress_percentage}%</span>
                    <div className="flex-1 bg-[color:var(--color-surface-muted)] rounded-full h-1.5">
                      <div className="bg-[color:var(--color-primary)] h-1.5 rounded-full" style={{ width: `${project.progress_percentage}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              <div className="livechat-card p-5 rounded-xl shadow-sm">
                <h3 className="text-sm font-bold text-[color:var(--color-text)] mb-3 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-[color:var(--color-primary)]" />
                  Descrição
                </h3>
                <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">{project.description || "Sem descrição."}</p>
                
                {project.custom_fields && Object.keys(project.custom_fields).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--color-border)]">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(project.custom_fields).map(([key, value]: [string, any], idx: number) => (
                        <div key={idx} className="p-2 bg-[color:var(--color-surface-muted)] rounded-lg border border-[color:var(--color-border)]">
                          <span className="block text-[9px] font-bold text-[color:var(--color-text-muted)] uppercase mb-0.5">{key}</span>
                          <span className="text-xs font-semibold text-[color:var(--color-text)] truncate block">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tasks Card */}
              <div className="livechat-card rounded-xl shadow-sm flex flex-col">
                <div className="p-5 border-b border-[color:var(--color-border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-sm font-bold text-[color:var(--color-text)]">Tarefas</h3>
                  </div>
                  <span className="text-[10px] bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] px-2 py-0.5 rounded-full font-bold">
                    {project.progress_percentage}% Concluído
                  </span>
                </div>
                <div className="p-5 min-h-[300px]">
                  {id && <ProjectTasks projectId={id} />}
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Team Card */}
              <div className="livechat-card p-5 rounded-xl shadow-sm">
                <h3 className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider mb-4">Equipe e Cliente</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[color:var(--color-primary)]/10 flex items-center justify-center text-[color:var(--color-primary)] font-bold text-sm">
                      {project.owner?.name?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--color-text)]">{project.owner?.name || "Sem responsável"}</p>
                      <p className="text-[10px] text-[color:var(--color-text-muted)]">Responsável</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-[color:var(--color-border)]">
                    <p className="text-sm font-semibold text-[color:var(--color-text)]">{project.customer_name || "Sem cliente"}</p>
                    <p className="text-[10px] text-[color:var(--color-text-muted)] mt-0.5">{project.customer_phone || project.customer_email || "Sem contato"}</p>
                  </div>
                </div>
              </div>

              {/* Attachments Card */}
              <div className="livechat-card rounded-xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-[color:var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Arquivos</h3>
                  </div>
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {id && <ProjectAttachments projectId={id} />}
                </div>
              </div>

              {/* Comments Card */}
              <div className="livechat-card rounded-xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-[color:var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Comentários</h3>
                  </div>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {id && <ProjectComments projectId={id} />}
                </div>
              </div>

              {/* History Card */}
              <div className="livechat-card rounded-xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-[color:var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Histórico</h3>
                  </div>
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {id && <ProjectTimeline projectId={id} />}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProjectDetails;

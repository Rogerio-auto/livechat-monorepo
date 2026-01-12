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
  LayoutGrid,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProjectWithDetails, TemplateWithDetails } from "@livechat/shared";
import ProjectTasks from "../../components/projects/ProjectTasks";
import ProjectComments from "../../components/projects/ProjectComments";
import ProjectAttachments from "../../components/projects/ProjectAttachments";
import ProjectTimeline from "../../components/projects/ProjectTimeline";
import { useConfirmation } from "../../hooks/useConfirmation";
import { ConfirmationModal } from "../../components/ui/ConfirmationModal";
import { Breadcrumbs } from "../../components/Breadcrumbs";

const API = import.meta.env.VITE_API_URL;

const ProjectDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectWithDetails | null>(null);
  const [template, setTemplate] = useState<TemplateWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const { confirm, modalProps } = useConfirmation();

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
    const confirmed = await confirm({
      title: "Excluir Projeto",
      message: "Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      type: "danger"
    });

    if (!confirmed) return;

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

  const handleUpdateProject = async (updates: Partial<ProjectWithDetails>) => {
    try {
      const response = await fetch(`${API}/projects/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates),
        credentials: "include"
      });
      
      if (response.ok) {
        fetchProjectDetails();
      } else {
        alert("Erro ao atualizar projeto");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Erro ao atualizar projeto");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "completed": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "pending": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "cancelled": return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-emerald-500";
      default: return "bg-slate-400";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen gap-6 bg-white dark:bg-slate-900">
        <div className="w-20 h-20 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Projeto não encontrado</h2>
          <p className="text-slate-500 mt-2">O projeto que você está procurando não existe ou foi removido.</p>
        </div>
        <button 
          onClick={() => navigate("/projects")}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 dark:shadow-none"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para Projetos
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs 
          items={[
            { label: "Projetos", href: "/projects" },
            { label: project.title, active: true }
          ]} 
        />

        {/* Header Section */}
        <div className="mb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <LayoutGrid className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {project.title}
                  </h1>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Tag className="w-4 h-4" />
                    {project.template?.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    <LayoutGrid className="w-4 h-4" />
                    {project.stage?.name || "Sem estágio"}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <User className="w-4 h-4" />
                    {project.owner?.name || "Sem responsável"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/projects/${id}/edit`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <Edit3 className="w-4 h-4" />
                Editar
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowActions(!showActions)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 dark:shadow-none"
                >
                  Ações
                </button>

                {showActions && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                    <div className="absolute right-0 top-full mt-3 w-64 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-md z-50 py-2 animate-in fade-in zoom-in duration-200 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                      </div>
                      <div className="p-1 grid grid-cols-2 gap-1">
                        {[
                          { id: "active", label: "Ativo", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
                          { id: "on_hold", label: "Espera", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
                          { id: "completed", label: "Concluído", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
                          { id: "cancelled", label: "Cancelado", color: "text-slate-600 bg-slate-50 dark:bg-slate-900/20" }
                        ].map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              handleUpdateProject({ status: s.id as any });
                              setShowActions(false);
                            }}
                            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${s.color} ${project.status === s.id ? "ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-800" : ""}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>

                      <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-700/50 mt-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridade</p>
                      </div>
                      <div className="p-1 grid grid-cols-2 gap-1">
                        {[
                          { id: "urgent", label: "Urgente", color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
                          { id: "high", label: "Alta", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
                          { id: "medium", label: "Média", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
                          { id: "low", label: "Baixa", color: "text-slate-600 bg-slate-50 dark:bg-slate-900/20" }
                        ].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              handleUpdateProject({ priority: p.id as any });
                              setShowActions(false);
                            }}
                            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all ${p.color} ${project.priority === p.id ? "ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-800" : ""}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-50 dark:border-slate-700/50">
                        <button
                          onClick={() => {
                            handleDeleteProject();
                            setShowActions(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-bold"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir Projeto
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Main Info & Tasks (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Quick Info Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Datas</span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Início: <span className="font-bold text-slate-900 dark:text-white">{project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy") : "-"}</span></p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Prazo: <span className="font-bold text-slate-900 dark:text-white">{project.estimated_end_date ? format(new Date(project.estimated_end_date), "dd/MM/yyyy") : "-"}</span></p>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-4">
                  <Tag className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Financeiro</span>
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">R$ {(project.estimated_value || 0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">Orçamento Estimado</p>
              </div>

              <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Progresso</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{project.progress_percentage}%</span>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${project.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description Card */}
            <div className="p-8 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-emerald-500" />
                Descrição
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{project.description || "Sem descrição."}</p>
              
              {project.custom_fields && Object.keys(project.custom_fields).length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(project.custom_fields).map(([key, value]: [string, any], idx: number) => (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1">{key}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate block">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tasks Section */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <ProjectTasks projectId={project.id} />
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <ProjectComments projectId={project.id} />
            </div>
          </div>

          {/* Right Column: Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Attachments */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <ProjectAttachments projectId={project.id} />
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <ProjectTimeline projectId={project.id} />
            </div>

          </div>
        </div>
      </div>

      <ConfirmationModal {...modalProps} />
    </div>
  );
};

export default ProjectDetails;

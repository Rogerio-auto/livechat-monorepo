// frontend/src/pages/projects/ProjectsList.tsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List as ListIcon, 
  MoreVertical,
  Calendar,
  User,
  Tag,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Project } from "../../types/projects";
import { useConfirmation } from "../../hooks/useConfirmation";
import { ConfirmationModal } from "../../components/ui/ConfirmationModal";

const API = import.meta.env.VITE_API_URL;

const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const { confirm, modalProps } = useConfirmation();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(Array.isArray(data) ? data : (data.projects || []));
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    
    const confirmed = await confirm({
      title: "Excluir Projeto",
      message: "Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (response.ok) {
        fetchProjects();
      } else {
        alert("Erro ao excluir projeto");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Erro ao excluir projeto");
    }
  };

  const handleEditProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    navigate(`/projects/${projectId}/edit`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed": return "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] border-[color:var(--color-primary)]/20";
      case "on_hold": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "cancelled": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-[color:var(--color-text-muted)]/10 text-[color:var(--color-text-muted)] border-[color:var(--color-text-muted)]/20";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "high": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium": return <Clock className="w-4 h-4 text-[color:var(--color-primary)]" />;
      default: return <CheckCircle2 className="w-4 h-4 text-[color:var(--color-text-muted)]" />;
    }
  };

  const filteredProjects = projects.filter(p => 
    (p.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.template_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedProjects = {
    active: filteredProjects.filter(p => p.status === "active"),
    on_hold: filteredProjects.filter(p => p.status === "on_hold"),
    completed: filteredProjects.filter(p => p.status === "completed"),
    other: filteredProjects.filter(p => !["active", "on_hold", "completed"].includes(p.status))
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 livechat-theme bg-[color:var(--color-bg)] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 livechat-panel p-8 rounded-lg border border-[color:var(--color-border)]">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--color-text)] tracking-tight">Gestão de Projetos</h1>
          <p className="text-[color:var(--color-text-muted)] mt-1 text-lg">Gerencie seus projetos, tarefas e prazos em um só lugar.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/projects/kanban")}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[color:var(--color-text)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md hover:bg-[color:var(--color-surface-muted)] transition-all shadow-sm"
          >
            <LayoutGrid className="w-4 h-4" />
            Ver Kanban
          </button>
          <button 
            onClick={() => navigate("/projects/new")}
            className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[color:var(--color-primary)] rounded-md hover:opacity-90 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[color:var(--color-surface-muted)] p-4 rounded-lg border border-[color:var(--color-border)]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar projetos por nome ou template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md focus:outline-none focus:ring-4 focus:ring-[color:var(--color-primary)]/10 focus:border-[color:var(--color-primary)] transition-all shadow-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)]"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md p-1.5 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === "grid" ? "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] font-semibold shadow-sm" : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm">Grade</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === "list" ? "bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] font-semibold shadow-sm" : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"}`}
            >
              <ListIcon className="w-4 h-4" />
              <span className="text-sm">Lista</span>
            </button>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md hover:bg-[color:var(--color-surface-muted)] shadow-sm transition-all">
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--color-primary)]"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-[color:var(--color-surface)] border border-dashed border-[color:var(--color-border)] rounded-lg">
          <div className="mx-auto w-12 h-12 bg-[color:var(--color-surface-muted)] rounded-full flex items-center justify-center mb-4">
            <LayoutGrid className="w-6 h-6 text-[color:var(--color-text-muted)]" />
          </div>
          <h3 className="text-lg font-medium text-[color:var(--color-text)]">Nenhum projeto encontrado</h3>
          <p className="text-[color:var(--color-text-muted)] mt-1">Comece criando seu primeiro projeto ou use um template.</p>
          <button 
            onClick={() => navigate("/projects/new")}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:opacity-80"
          >
            <Plus className="w-4 h-4" />
            Criar projeto agora
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="space-y-12">
          {Object.entries(groupedProjects).map(([status, statusProjects]) => (
            statusProjects.length > 0 && (
              <div key={status} className="space-y-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-[color:var(--color-text)] capitalize">
                    {status === "active" ? "Em Andamento" : status === "pending" ? "Pendentes" : status === "completed" ? "Concluídos" : "Outros"}
                  </h2>
                  <span className="px-3 py-1 bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)] rounded-full text-xs font-bold">
                    {statusProjects.length}
                  </span>
                  <div className="flex-1 h-px bg-[color:var(--color-border)]"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {statusProjects.map((project) => (
                    <div 
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="group bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-6 hover:shadow-xl hover:border-[color:var(--color-primary)]/50 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                          {project.status === "active" ? "Ativo" : project.status}
                        </span>
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(project.priority)}
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === project.id ? null : project.id);
                              }}
                              className="p-1.5 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] rounded-md hover:bg-[color:var(--color-primary)]/10 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {activeMenuId === project.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-10" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                  }} 
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg shadow-lg z-20 py-1">
                                  <button
                                    onClick={(e) => handleEditProject(project.id, e)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)]"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Excluir
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-[color:var(--color-text)] group-hover:text-[color:var(--color-primary)] transition-colors mb-2 line-clamp-1">
                        {project.title}
                      </h3>
                      <p className="text-sm text-[color:var(--color-text-muted)] line-clamp-2 mb-6 grow">
                        {project.description || "Sem descrição disponível."}
                      </p>

                      <div className="space-y-3 mb-6 bg-[color:var(--color-surface-muted)] p-4 rounded-md border border-[color:var(--color-border)]">
                        <div className="flex items-center gap-3 text-sm text-[color:var(--color-text-muted)]">
                          <Tag className="w-4 h-4 text-[color:var(--color-primary)]/70" />
                          <span className="font-medium">{project.template_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[color:var(--color-text-muted)]">
                          <Calendar className="w-4 h-4 text-[color:var(--color-primary)]/70" />
                          <span>{project.end_date ? format(new Date(project.end_date), "dd 'de' MMM", { locale: ptBR }) : "Sem prazo"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[color:var(--color-text-muted)]">
                          <User className="w-4 h-4 text-[color:var(--color-primary)]/70" />
                          <span>{project.owner_name || "Não atribuído"}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[color:var(--color-border)] mt-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Progresso</span>
                          <span className="text-xs font-black text-[color:var(--color-primary)]">{project.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-[color:var(--color-surface-muted)] rounded-full h-2">
                          <div 
                            className="bg-[color:var(--color-primary)] h-2 rounded-full transition-all duration-700 ease-out" 
                            style={{ width: `${project.progress || 0}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-[color:var(--color-primary)]/10 border-2 border-[color:var(--color-surface)] flex items-center justify-center text-[10px] font-bold text-[color:var(--color-primary)]">
                              {project.owner_name?.charAt(0) || "U"}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-muted)] px-2 py-1 rounded-md">
                            {project.completed_tasks_count || 0}/{project.tasks_count || 0} TAREFAS
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[color:var(--color-surface-muted)] border-b border-[color:var(--color-border)]">
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Projeto</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Template</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Responsável</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Prazo</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest">Progresso</th>
                <th className="px-8 py-5 text-xs font-bold text-[color:var(--color-text-muted)] uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]">
              {filteredProjects.map((project) => (
                <tr 
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="hover:bg-[color:var(--color-surface-muted)] cursor-pointer transition-colors group"
                >
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-[color:var(--color-text)] group-hover:text-[color:var(--color-primary)] transition-colors">{project.title}</span>
                      <span className="text-xs text-[color:var(--color-text-muted)] mt-0.5">{project.contact_name || "Sem contato vinculado"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[color:var(--color-primary)]/60"></div>
                      <span className="text-sm text-[color:var(--color-text-muted)] font-medium">{project.template_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center text-[10px] font-bold text-[color:var(--color-text-muted)] border border-[color:var(--color-surface)] shadow-sm">
                        {project.owner_name?.charAt(0) || "U"}
                      </div>
                      <span className="text-sm text-[color:var(--color-text-muted)]">{project.owner_name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-[color:var(--color-text-muted)] font-medium">
                    {project.end_date ? format(new Date(project.end_date), "dd/MM/yyyy") : "-"}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-[color:var(--color-surface-muted)] rounded-full h-2 min-w-[100px]">
                        <div 
                          className="bg-[color:var(--color-primary)] h-2 rounded-full transition-all duration-700" 
                          style={{ width: `${project.progress || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-black text-[color:var(--color-text)]">{project.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)]/10 rounded-md transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmationModal {...modalProps} />
    </div>
  );
};

export default ProjectsList;

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
import type { Project, ProjectTemplate, ProjectStage } from "../../types/projects";
import { useConfirmation } from "../../hooks/useConfirmation";
import { ConfirmationModal } from "../../components/ui/ConfirmationModal";
import { Breadcrumbs } from "../../components/Breadcrumbs";

const API = import.meta.env.VITE_API_URL;

const INPUT_BASE_CLASS = "w-full rounded-lg border border-[rgba(15,36,24,0.12)] bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900 dark:text-white";
const ACTION_PRIMARY_CLASS = "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1f8b49] via-[#23a257] to-[#36c173] px-6 py-3 text-sm font-bold text-white shadow-sm shadow-[#1f8b49]/20 transition-all duration-200 hover:shadow-[#1f8b49]/30";
const ACTION_GHOST_CLASS = "inline-flex items-center gap-2 rounded-lg border border-transparent bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { confirm, modalProps } = useConfirmation();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects?include_details=true`, {
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
      default: return "bg-(--color-text-muted)/10 text-(--color-text-muted) border-(--color-text-muted)/20";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "high": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium": return <Clock className="w-4 h-4 text-(--color-primary)" />;
      default: return <CheckCircle2 className="w-4 h-4 text-(--color-text-muted)" />;
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.template_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || p.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const groupedProjects = {
    active: filteredProjects.filter(p => p.status === "active"),
    on_hold: filteredProjects.filter(p => p.status === "on_hold"),
    completed: filteredProjects.filter(p => p.status === "completed"),
    other: filteredProjects.filter(p => !["active", "on_hold", "completed"].includes(p.status))
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <Breadcrumbs 
          items={[
            { label: "Projetos", active: true }
          ]} 
        />

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-(--color-text) tracking-tight">Gestão de Projetos</h1>
              <p className="mt-2 text-lg text-(--color-text-muted)">Gerencie seus projetos, tarefas e prazos em um só lugar.</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate("/projects/kanban")}
                className={ACTION_GHOST_CLASS}
              >
                <LayoutGrid className="w-4 h-4" />
                Ver Kanban
              </button>
              <button 
                onClick={() => navigate("/projects/new")}
                className={ACTION_PRIMARY_CLASS}
              >
                <Plus className="w-5 h-5" />
                Novo Projeto
              </button>
            </div>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 border border-slate-100 dark:border-slate-800 rounded-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar projetos por nome ou template..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={INPUT_BASE_CLASS.replace("w-full", "w-full pl-12")}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === "grid" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-sm">Grade</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <ListIcon className="w-4 h-4" />
                <span className="text-sm">Lista</span>
              </button>
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-lg transition-all border ${
                  showFilters || statusFilter !== "all" || priorityFilter !== "all"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {(statusFilter !== "all" || priorityFilter !== "all") && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                )}
              </button>

              {showFilters && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setShowFilters(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-md z-30 p-4 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Status
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="all">Todos os Status</option>
                        <option value="active">Ativo</option>
                        <option value="on_hold">Em Espera</option>
                        <option value="completed">Concluído</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                        Prioridade
                      </label>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="all">Todas as Prioridades</option>
                        <option value="urgent">Urgente</option>
                        <option value="high">Alta</option>
                        <option value="medium">Média</option>
                        <option value="low">Baixa</option>
                      </select>
                    </div>

                    {(statusFilter !== "all" || priorityFilter !== "all") && (
                      <button
                        onClick={() => {
                          setStatusFilter("all");
                          setPriorityFilter("all");
                        }}
                        className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Projects Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="mx-auto w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
              <LayoutGrid className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nenhum projeto encontrado</h3>
            <p className="text-slate-500 mt-2">Comece criando seu primeiro projeto ou use um template.</p>
            <button 
              onClick={() => navigate("/projects/new")}
              className="mt-8 text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-2 mx-auto"
            >
              <Plus className="w-5 h-5" />
              Criar projeto agora
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="space-y-12">
            {Object.entries(groupedProjects).map(([status, statusProjects]) => (
              statusProjects.length > 0 && (
                <div key={status} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                      {status === "active" ? "Em Andamento" : status === "on_hold" ? "Em Espera" : status === "completed" ? "Concluídos" : "Outros"}
                    </h2>
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold">
                      {statusProjects.length}
                    </span>
                    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {statusProjects.map((project) => (
                      <div 
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-6 hover:shadow-md hover:border-emerald-500/30 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
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
                                className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
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
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-md z-20 py-2 overflow-hidden">
                                    <button
                                      onClick={(e) => handleEditProject(project.id, e)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                      Editar
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteProject(project.id, e)}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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

                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-2 line-clamp-1">
                          {project.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 grow">
                          {project.description || "Sem descrição disponível."}
                        </p>

                        <div className="space-y-3 mb-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <Tag className="w-4 h-4 text-emerald-500/70" />
                            <span className="font-semibold">{project.template_name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <LayoutGrid className="w-4 h-4 text-emerald-500/70" />
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {project.stage?.name || project.current_stage_name || "Sem estágio"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <Calendar className="w-4 h-4 text-emerald-500/70" />
                            <span>
                              {project.end_date || project.estimated_end_date 
                                ? format(new Date(project.end_date || project.estimated_end_date!), "dd 'de' MMM", { locale: ptBR }) 
                                : "Sem prazo"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <User className="w-4 h-4 text-emerald-500/70" />
                            <span>{project.owner_name || "Não atribuído"}</span>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Projeto</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Estágio</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Template</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Prazo</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Responsável</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProjects.map((project) => (
                  <tr 
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getPriorityIcon(project.priority)}
                        <span className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {project.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                        {project.status === "active" ? "Ativo" : project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {project.stage?.name || project.current_stage_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {project.template_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {project.end_date || project.estimated_end_date 
                        ? format(new Date(project.end_date || project.estimated_end_date!), "dd/MM/yyyy") 
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {project.owner_name || "Não atribuído"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleEditProject(project.id, e)}
                          className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {modalProps && <ConfirmationModal {...modalProps} />}
    </div>
  );
};

export default ProjectsList;


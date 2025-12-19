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
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Project } from "../../types/projects";

const API = import.meta.env.VITE_API_URL;

const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");

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
        // Suporta tanto o formato antigo (array) quanto o novo (objeto com {projects, total})
        setProjects(Array.isArray(data) ? data : (data.projects || []));
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-green-100 text-green-700 border-green-200";
      case "on_hold": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "cancelled": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "high": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium": return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredProjects = projects.filter(p => 
    (p.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.template_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar projetos por status para uma visão mais organizada
  const groupedProjects = {
    active: filteredProjects.filter(p => p.status === "active"),
    on_hold: filteredProjects.filter(p => p.status === "on_hold"),
    completed: filteredProjects.filter(p => p.status === "completed"),
    other: filteredProjects.filter(p => !["active", "on_hold", "completed"].includes(p.status))
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Projetos</h1>
          <p className="text-gray-500 mt-1 text-lg">Gerencie seus projetos, tarefas e prazos em um só lugar.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/projects/kanban")}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <LayoutGrid className="w-4 h-4" />
            Ver Kanban
          </button>
          <button 
            onClick={() => navigate("/projects/new")}
            className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar projetos por nome ou template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-indigo-50 text-indigo-600 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm">Grade</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === "list" ? "bg-indigo-50 text-indigo-600 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <ListIcon className="w-4 h-4" />
              <span className="text-sm">Lista</span>
            </button>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm transition-all">
            <Filter className="w-4 h-4" />
            Filtros Avançados
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-xl">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <LayoutGrid className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Nenhum projeto encontrado</h3>
          <p className="text-gray-500 mt-1">Comece criando seu primeiro projeto ou use um template.</p>
          <button 
            onClick={() => navigate("/projects/new")}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
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
                  <h2 className="text-xl font-bold text-gray-800 capitalize">
                    {status === "active" ? "Em Andamento" : status === "pending" ? "Pendentes" : status === "completed" ? "Concluídos" : "Outros"}
                  </h2>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                    {statusProjects.length}
                  </span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {statusProjects.map((project) => (
                    <div 
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="group bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer relative overflow-hidden flex flex-col h-full shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                          {project.status === "active" ? "Ativo" : project.status}
                        </span>
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(project.priority)}
                          <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-1">
                        {project.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-6 grow">
                        {project.description || "Sem descrição disponível."}
                      </p>

                      <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <Tag className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium">{project.template_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-indigo-400" />
                          <span>{project.end_date ? format(new Date(project.end_date), "dd 'de' MMM", { locale: ptBR }) : "Sem prazo"}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <User className="w-4 h-4 text-indigo-400" />
                          <span>{project.owner_name || "Não atribuído"}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 mt-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Progresso</span>
                          <span className="text-xs font-black text-indigo-600">{project.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-700 ease-out" 
                            style={{ width: `${project.progress || 0}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600">
                              {project.owner_name?.charAt(0) || "U"}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
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
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Projeto</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Template</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Responsável</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Prazo</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Progresso</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProjects.map((project) => (
                <tr 
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                >
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{project.title}</span>
                      <span className="text-xs text-gray-500 mt-0.5">{project.contact_name || "Sem contato vinculado"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                      <span className="text-sm text-gray-600 font-medium">{project.template_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 border border-white shadow-sm">
                        {project.owner_name?.charAt(0) || "U"}
                      </div>
                      <span className="text-sm text-gray-600">{project.owner_name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm text-gray-600 font-medium">
                    {project.end_date ? format(new Date(project.end_date), "dd/MM/yyyy") : "-"}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[100px]">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-700" 
                          style={{ width: `${project.progress || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-black text-gray-700">{project.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectsList;

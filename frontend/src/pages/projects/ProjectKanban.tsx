// frontend/src/pages/projects/ProjectKanban.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  MessageSquare, 
  Paperclip, 
  CheckSquare,
  User,
  Filter,
  Search,
  ChevronLeft,
  Settings,
  LayoutGrid,
  List as ListIcon,
  AlertCircle,
  Clock,
  CheckCircle2
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

interface Stage {
  id: string;
  name: string;
  color: string;
  projects: ProjectCard[];
}

interface ProjectCard {
  id: string;
  title: string;
  priority: string;
  end_date: string;
  tasks_count: number;
  completed_tasks_count: number;
  comments_count: number;
  attachments_count: number;
  owner_avatar?: string;
  owner_name?: string;
  tags?: string[];
}

const ProjectKanban: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    fetchKanbanData();
  }, [id]);

  const fetchKanbanData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects`, {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        // Suporta tanto o formato antigo (array) quanto o novo (objeto com {projects, total})
        const projects = Array.isArray(data) ? data : (data.projects || []);
        
        // Agrupar projetos por status (ou stage se disponível)
        const grouped: Record<string, ProjectCard[]> = {
          "pending": [],
          "active": [],
          "completed": [],
          "cancelled": []
        };

        projects.forEach((p: any) => {
          const status = p.status || "pending";
          if (!grouped[status]) grouped[status] = [];
          grouped[status].push({
            id: p.id,
            title: p.title || p.name,
            priority: p.priority || "medium",
            end_date: p.estimated_end_date || p.end_date,
            tasks_count: p.tasks_count || 0,
            completed_tasks_count: p.completed_tasks_count || 0,
            comments_count: p.comments_count || 0,
            attachments_count: p.attachments_count || 0,
            owner_name: p.owner_name,
            tags: p.tags || []
          });
        });

        const newStages: Stage[] = [
          { id: "pending", name: "Pendente", color: "#94a3b8", projects: grouped["pending"] },
          { id: "active", name: "Em Andamento", color: "#3b82f6", projects: grouped["active"] },
          { id: "completed", name: "Concluído", color: "#10b981", projects: grouped["completed"] },
          { id: "cancelled", name: "Cancelado", color: "#ef4444", projects: grouped["cancelled"] }
        ];

        setStages(newStages);
      }
    } catch (error) {
      console.error("Error fetching kanban data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-blue-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/projects")}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quadro Kanban</h1>
              <p className="text-sm text-gray-500 mt-0.5">Visualize e gerencie o fluxo de trabalho dos seus projetos.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar por nome ou tag..."
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
              />
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm transition-all">
              <Filter className="w-4.5 h-4.5" />
              Filtros
            </button>
            <button 
              onClick={() => navigate("/projects/new")}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Novo Projeto
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-8 custom-scrollbar">
        <div className="flex gap-8 h-full min-w-max">
          {stages.map((stage) => (
            <div 
              key={stage.id}
              className="flex flex-col w-80 bg-gray-100/50 rounded-2xl border border-gray-200/60 p-4"
            >
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }}></div>
                  <h3 className="font-bold text-gray-800 uppercase tracking-wider text-xs">{stage.name}</h3>
                  <span className="px-2 py-0.5 bg-white text-gray-500 rounded-lg text-[10px] font-black border border-gray-200 shadow-sm">
                    {stage.projects.length}
                  </span>
                </div>
                <button className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-white transition-all">
                  <MoreHorizontal className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {stage.projects.map((project) => (
                  <div 
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all cursor-pointer group relative"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter text-white ${getPriorityColor(project.priority)}`}>
                        {project.priority}
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 mb-3 leading-snug group-hover:text-indigo-600 transition-colors">
                      {project.title}
                    </h4>

                    {project.tags && project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {project.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-bold uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">{project.completed_tasks_count}/{project.tasks_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold">{project.comments_count}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {project.end_date && (
                          <div className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-bold">20 Dez</span>
                          </div>
                        )}
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 border-2 border-white shadow-sm">
                          {project.owner_name?.charAt(0) || "U"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/projects/new");
                  }}
                  className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Projeto
                </button>
              </div>
            </div>
          ))}

          <button className="w-80 h-fit py-6 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest">
            <Plus className="w-5 h-5" />
            Novo Estágio
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectKanban;

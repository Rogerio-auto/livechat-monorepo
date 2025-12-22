// frontend/src/pages/projects/ProjectKanban.tsx

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  DndContext, 
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  UniqueIdentifier,
  DragCancelEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  MessageSquare, 
  CheckSquare,
  Filter,
  Search,
  ChevronLeft,
  LayoutTemplate,
  ArrowLeft
} from "lucide-react";
import type { ProjectTemplate, ProjectStage } from "../../types/projects";
import { Breadcrumbs } from "../../components/Breadcrumbs";

const API = import.meta.env.VITE_API_URL;

interface KanbanStage {
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
  current_stage_id: string;
}

// --- Components ---

const SortableProjectCard = ({ project, onClick }: { project: ProjectCard, onClick: () => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id, data: { type: 'Project', project } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-emerald-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      onClick={onClick}
      className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all cursor-grab active:cursor-grabbing group relative"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter text-white ${getPriorityColor(project.priority)}`}>
          {project.priority}
        </div>
        <button className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-500 transition-all">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        {project.title}
      </h4>

      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md text-[9px] font-bold uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50 dark:border-slate-700">
        <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
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
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-bold">20 Dez</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-[10px] font-black text-emerald-600 dark:text-emerald-400 border-2 border-white dark:border-slate-800 shadow-sm">
            {project.owner_name?.charAt(0) || "U"}
          </div>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ stage, children }: { stage: KanbanStage, children: React.ReactNode }) => {
  const { setNodeRef } = useSortable({ id: stage.id, data: { type: 'Stage', stage } });

  return (
    <div 
      ref={setNodeRef}
      className="flex flex-col w-80 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-5 h-full max-h-full"
    >
      <div className="flex items-center justify-between mb-5 px-1">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: stage.color }}></div>
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-[10px]">{stage.name}</h3>
          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg text-[10px] font-black border border-slate-100 dark:border-slate-700 shadow-sm">
            {stage.projects.length}
          </span>
        </div>
        <button className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all">
          <MoreHorizontal className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-[100px]">
        {children}
      </div>
    </div>
  );
};

// --- Main Component ---

const ProjectKanban: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [stages, setStages] = useState<KanbanStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 1. Fetch Templates on Mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  // 2. Fetch Kanban Data when Template Changes
  useEffect(() => {
    if (selectedTemplateId) {
      fetchKanbanData();
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API}/projects/templates`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
        // Select first template by default if none selected
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const fetchKanbanData = async () => {
    try {
      setLoading(true);
      
      // A. Fetch Template Details (to get Stages)
      const tplResponse = await fetch(`${API}/projects/templates/${selectedTemplateId}`, { credentials: "include" });
      if (!tplResponse.ok) throw new Error("Failed to fetch template details");
      const tplData = await tplResponse.json();
      const dbStages: ProjectStage[] = tplData.stages.sort((a: ProjectStage, b: ProjectStage) => a.order_index - b.order_index);

      // B. Fetch Projects for this Template
      const projResponse = await fetch(`${API}/projects?template_id=${selectedTemplateId}`, { credentials: "include" });
      if (!projResponse.ok) throw new Error("Failed to fetch projects");
      const projData = await projResponse.json();
      const projects = Array.isArray(projData) ? projData : (projData.projects || []);

      // C. Map Projects to Stages
      const newStages: KanbanStage[] = dbStages.map(stage => {
        const stageProjects = projects
          .filter((p: any) => p.current_stage_id === stage.id)
          .map((p: any) => ({
            id: p.id,
            title: p.title || p.name,
            priority: p.priority || "medium",
            end_date: p.estimated_end_date || p.end_date,
            tasks_count: p.tasks_count || 0,
            completed_tasks_count: p.completed_tasks_count || 0,
            comments_count: p.comments_count || 0,
            attachments_count: p.attachments_count || 0,
            owner_name: p.owner_name,
            tags: p.tags || [],
            current_stage_id: p.current_stage_id
          }));

        return {
          id: stage.id,
          name: stage.name,
          color: stage.color || "#6B7280",
          projects: stageProjects
        };
      });

      setStages(newStages);
    } catch (error) {
      console.error("Error fetching kanban data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProjectStage = async (projectId: string, newStageId: string) => {
    try {
      await fetch(`${API}/projects/${projectId}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage_id: newStageId }),
        credentials: "include"
      });
    } catch (error) {
      console.error("Error updating project stage:", error);
    }
  };

  const findContainer = (id: UniqueIdentifier) => {
    if (stages.find(s => s.id === id)) {
      return id;
    }
    return stages.find(s => s.projects.some(p => p.id === id))?.id;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const { id } = active;
    setActiveId(id);
    
    const stage = stages.find(s => s.projects.some(p => p.id === id));
    const project = stage?.projects.find(p => p.id === id);
    if (project) setActiveProject(project);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const overId = over?.id;

    if (!overId || active.id === overId) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setStages((prev) => {
      const activeItems = prev.find(s => s.id === activeContainer)?.projects || [];
      const overItems = prev.find(s => s.id === overContainer)?.projects || [];
      const activeIndex = activeItems.findIndex(p => p.id === active.id);
      const overIndex = overItems.findIndex(p => p.id === overId);

      let newIndex;
      if (prev.some(s => s.id === overId)) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height;

        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      return prev.map(stage => {
        if (stage.id === activeContainer) {
          return {
            ...stage,
            projects: stage.projects.filter(p => p.id !== active.id)
          };
        }
        if (stage.id === overContainer) {
          const newProjects = [...stage.projects];
          const project = activeItems[activeIndex];
          if (project) {
             // Insert at newIndex
             if (newIndex > newProjects.length) {
                newProjects.push(project);
             } else {
                newProjects.splice(newIndex, 0, project);
             }
          }
          return {
            ...stage,
            projects: newProjects
          };
        }
        return stage;
      });
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const { id } = active;
    const overId = over?.id;

    if (!overId) {
      setActiveId(null);
      setActiveProject(null);
      return;
    }

    const activeContainer = findContainer(id);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    // Check for stage change (compare with original stage from activeProject)
    if (activeProject && activeProject.current_stage_id !== activeContainer) {
      console.log(`[Kanban] Moving project ${id} from ${activeProject.current_stage_id} to ${activeContainer}`);
      updateProjectStage(id as string, activeContainer as string);
      
      // Update local state to reflect new stage ID
      setStages(prev => prev.map(stage => ({
          ...stage,
          projects: stage.projects.map(p => 
              p.id === id ? { ...p, current_stage_id: activeContainer as string } : p
          )
      })));
    }

    // Handle reordering within the new column
    const activeIndex = stages.find(s => s.id === activeContainer)?.projects.findIndex(p => p.id === id) ?? -1;
    const overIndex = stages.find(s => s.id === overContainer)?.projects.findIndex(p => p.id === overId) ?? -1;

    if (activeIndex !== overIndex) {
        setStages((prev) => prev.map(stage => {
            if (stage.id === activeContainer) {
                return {
                    ...stage,
                    projects: arrayMove(stage.projects, activeIndex, overIndex)
                };
            }
            return stage;
        }));
    }

    setActiveId(null);
    setActiveProject(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveProject(null);
  };

  const filteredStages = useMemo(() => {
    if (!searchTerm) return stages;
    return stages.map(stage => ({
      ...stage,
      projects: stage.projects.filter(p => 
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }));
  }, [stages, searchTerm]);

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 h-screen overflow-hidden">
      <div className="w-full max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col h-full overflow-hidden">
        <Breadcrumbs 
          items={[
            { label: "Projetos", href: "/projects" },
            { label: "Quadro Kanban", active: true }
          ]} 
        />

        {/* Header Section */}
        <div className="mb-8 shrink-0">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                Quadro Kanban
              </h1>
              <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
                Visualize e gerencie o fluxo de trabalho dos seus projetos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Template Selector */}
              <div className="relative">
                <LayoutTemplate className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="pl-10 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200 appearance-none cursor-pointer min-w-[220px] font-bold"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome ou tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium"
                />
              </div>

              <button 
                onClick={() => navigate("/projects/new")}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none "
              >
                <Plus className="w-5 h-5" />
                Novo Projeto
              </button>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 overflow-x-auto pb-8 custom-scrollbar">
            <div className="flex gap-8 h-full min-w-max">
              {filteredStages.map((stage) => (
                <SortableContext
                  key={stage.id}
                  items={stage.projects.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <KanbanColumn stage={stage}>
                    {stage.projects.map((project) => (
                      <SortableProjectCard 
                        key={project.id} 
                        project={project} 
                        onClick={() => navigate(`/projects/${project.id}`)}
                      />
                    ))}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/projects/new");
                      }}
                      className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Projeto
                    </button>
                  </KanbanColumn>
                </SortableContext>
              ))}

              <button className="w-80 h-fit py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest">
                <Plus className="w-5 h-5" />
                Novo Estágio
              </button>
            </div>
          </div>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeProject ? (
              <div className="transform rotate-3 cursor-grabbing">
                 <SortableProjectCard project={activeProject} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
};

export default ProjectKanban;

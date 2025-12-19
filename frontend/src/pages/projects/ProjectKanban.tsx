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
  LayoutTemplate
} from "lucide-react";
import type { ProjectTemplate, ProjectStage } from "../../types/projects";

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
      case "medium": return "bg-[color:var(--color-primary)]";
      default: return "bg-[color:var(--color-text-muted)]";
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      onClick={onClick}
      className="bg-[color:var(--color-surface)] p-5 rounded-lg border border-[color:var(--color-border)] shadow-sm hover:shadow-md hover:border-[color:var(--color-primary)]/50 transition-all cursor-grab active:cursor-grabbing group relative"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter text-white ${getPriorityColor(project.priority)}`}>
          {project.priority}
        </div>
        <button className="opacity-0 group-hover:opacity-100 p-1 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] transition-all">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <h4 className="text-sm font-bold text-[color:var(--color-text)] mb-3 leading-snug group-hover:text-[color:var(--color-primary)] transition-colors">
        {project.title}
      </h4>

      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] rounded-md text-[9px] font-bold uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[color:var(--color-border)]">
        <div className="flex items-center gap-3 text-[color:var(--color-text-muted)]">
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
            <div className="flex items-center gap-1 text-[color:var(--color-text-muted)]">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-bold">20 Dez</span>
            </div>
          )}
          <div className="w-7 h-7 rounded-full bg-[color:var(--color-primary)]/10 flex items-center justify-center text-[10px] font-black text-[color:var(--color-primary)] border-2 border-[color:var(--color-surface)] shadow-sm">
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
      className="flex flex-col w-80 bg-[color:var(--color-surface-muted)] rounded-lg border border-[color:var(--color-border)] p-4 h-full max-h-full"
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }}></div>
          <h3 className="font-bold text-[color:var(--color-text)] uppercase tracking-wider text-xs">{stage.name}</h3>
          <span className="px-2 py-0.5 bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] rounded-md text-[10px] font-black border border-[color:var(--color-border)] shadow-sm">
            {stage.projects.length}
          </span>
        </div>
        <button className="p-1.5 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] rounded-md hover:bg-[color:var(--color-surface)] transition-all">
          <MoreHorizontal className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[100px]">
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
    <div className="h-full flex flex-col livechat-theme bg-[color:var(--color-bg)] overflow-hidden">
      {/* Header */}
      <div className="livechat-panel border-b border-[color:var(--color-border)] px-8 py-6">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/projects")}
              className="p-2 hover:bg-[color:var(--color-surface-muted)] rounded-md transition-colors text-[color:var(--color-text-muted)]"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[color:var(--color-text)]">Quadro Kanban</h1>
              <p className="text-sm text-[color:var(--color-text-muted)] mt-0.5">Visualize e gerencie o fluxo de trabalho dos seus projetos.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Template Selector */}
            <div className="relative">
              <LayoutTemplate className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--color-text-muted)]" />
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="pl-9 pr-8 py-2.5 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md focus:outline-none focus:ring-4 focus:ring-[color:var(--color-primary)]/10 focus:border-[color:var(--color-primary)] transition-all text-sm text-[color:var(--color-text)] appearance-none cursor-pointer min-w-[200px]"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[color:var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Filtrar por nome ou tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md focus:outline-none focus:ring-4 focus:ring-[color:var(--color-primary)]/10 focus:border-[color:var(--color-primary)] transition-all text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)]"
              />
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-md hover:bg-[color:var(--color-surface-muted)] shadow-sm transition-all">
              <Filter className="w-4.5 h-4.5" />
              Filtros
            </button>
            <button 
              onClick={() => navigate("/projects/new")}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[color:var(--color-primary)] rounded-md hover:opacity-90 transition-all shadow-md hover:shadow-lg active:scale-95"
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
        <div className="flex-1 overflow-x-auto p-8 custom-scrollbar">
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
                    className="w-full py-3 border-2 border-dashed border-[color:var(--color-border)] rounded-lg text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)]/50 hover:bg-[color:var(--color-primary)]/5 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Projeto
                  </button>
                </KanbanColumn>
              </SortableContext>
            ))}

            <button className="w-80 h-fit py-6 border-2 border-dashed border-[color:var(--color-border)] rounded-lg text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] hover:border-[color:var(--color-primary)]/50 hover:bg-[color:var(--color-primary)]/5 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest">
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
  );
};

export default ProjectKanban;

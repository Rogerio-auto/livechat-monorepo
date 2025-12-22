// frontend/src/components/projects/ProjectKanbanBoard.tsx

import { useState, useEffect, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails, Project, ProjectStage } from "../../types/projects";
import ProjectCard from "./ProjectCard";
import ProjectDetailsModal from "./ProjectDetailsModal";
import ProjectForm from "./ProjectForm";
import { Button } from "../ui/Button";

const API = import.meta.env.VITE_API_URL;

type Props = {
  template: TemplateWithDetails;
};

export default function ProjectKanbanBoard({ template }: Props) {
  const [projectsByStage, setProjectsByStage] = useState<Record<string, Project[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance:  8,
      },
    })
  );

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<Record<string, Project[]>>(
        `${API}/projects/by-stage?template_id=${template.id}`
      );
      setProjectsByStage(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [template.id]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDragStart = (event: DragStartEvent) => {
    const projectId = event.active.id as string;
    const project = Object.values(projectsByStage)
      .flat()
      .find((p) => p.id === projectId);
    setDraggedProject(project || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedProject(null);

    if (!over || active.id === over.id) return;

    const projectId = active.id as string;
    const newStageId = over.id as string;

    try {
      await fetchJson(`${API}/projects/${projectId}/stage`, {
        method: "PUT",
        body: JSON.stringify({ stage_id: newStageId }),
      });

      await fetchProjects();
    } catch (error) {
      console.error("Error moving project:", error);
    }
  };

  const getProjectCount = (stageId: string) => {
    return projectsByStage[stageId]?.length || 0;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-(--color-surface) border-b border-(--color-border) px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-(--color-text)">
              {template.icon} {template.name}
            </h2>
            <span className="text-sm text-(--color-text-muted)">
              {Object.values(projectsByStage).flat().length} projetos
            </span>
          </div>
          <Button onClick={() => setShowProjectForm(true)} variant="primary" size="sm">
            + Novo Projeto
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-(--color-bg)">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full" style={{ minWidth: `${template.stages.length * 320}px` }}>
            {template.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                projects={projectsByStage[stage.id] || []}
                projectCount={getProjectCount(stage.id)}
                onProjectClick={setSelectedProject}
                loading={loading}
              />
            ))}
          </div>

          <DragOverlay>
            {draggedProject ?  (
              <div className="rotate-3 opacity-80">
                <ProjectCard project={draggedProject} template={template} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {showProjectForm && (
        <ProjectForm
          template={template}
          onClose={() => setShowProjectForm(false)}
          onSuccess={() => {
            setShowProjectForm(false);
            fetchProjects();
          }}
        />
      )}

      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          template={template}
          onClose={() => setSelectedProject(null)}
          onUpdate={fetchProjects}
        />
      )}
    </div>
  );
}

// ==================== KANBAN COLUMN ====================

type KanbanColumnProps = {
  stage: ProjectStage;
  projects: Project[];
  projectCount: number;
  onProjectClick: (project:  Project) => void;
  loading: boolean;
};

function KanbanColumn({ stage, projects, projectCount, onProjectClick, loading }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-80 bg-(--color-surface-muted) rounded-xl shrink-0 border border-(--color-border)">
      {/* Column Header */}
      <div
        className="px-4 py-3 border-b-4 rounded-t-xl"
        style={{ borderColor: stage.color }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-(--color-text) flex items-center gap-2">
            {stage.icon && <span>{stage.icon}</span>}
            {stage.name}
          </h3>
          <span className="text-sm font-medium text-(--color-text-muted) bg-(--color-bg) px-2 py-1 rounded-full border border-(--color-border)">
            {projectCount}
          </span>
        </div>
        {stage.description && (
          <p className="text-xs text-(--color-text-muted) mt-1">{stage.description}</p>
        )}
      </div>

      {/* Column Body */}
      <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
          {loading && projects.length === 0 ? (
            <div className="text-center py-8 text-(--color-text-muted)">
              <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-(--color-text-muted) text-sm">
              Nenhum projeto
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} onClick={() => onProjectClick(project)}>
                <ProjectCard project={project} template={null} />
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

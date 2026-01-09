// backend/src/routes/projects.ts

import type { Application } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import {
  notifyProjectCreated,
  notifyProjectAssigned,
  notifyProjectStageChanged,
  notifyTaskCreated,
  notifyTaskAssigned,
  notifyTaskCompleted
} from "../services/notification-triggers.service.js";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  moveProjectStage,
  addComment,
  listProjectComments,
  deleteComment,
  addTask,
  listProjectTasks,
  updateTask,
  deleteTask,
  addAttachment,
  listProjectAttachments,
  deleteAttachment,
  getProjectActivities,
  getProjectStats,
} from "../repos/projects.repo.ts";

// ==================== SCHEMAS ====================

const CreateProjectSchema = z.object({
  template_id: z.string().uuid("Template ID inválido"),
  title: z.string().min(1, "Nome é obrigatório"),
  description: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  customer_phone: z.string().nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  start_date: z.string().nullable().optional(),
  estimated_end_date: z.string().nullable().optional(),
  estimated_value: z.number().nullable().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial().omit({ template_id: true }).extend({
  status: z.string().optional(),
});

const CreateCommentSchema = z.object({
  content: z.string().min(1, "Comentário não pode ser vazio"),
  is_internal: z.boolean().optional(),
  parent_id: z.string().uuid().optional(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  is_completed: z.boolean().optional(),
});

const CreateAttachmentSchema = z.object({
  file_name: z.string().min(1),
  file_url: z.string().url(),
  file_type: z.string().optional(),
  file_size: z.number().optional(),
});

// ==================== MULTER CONFIG ====================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// ==================== HELPERS ====================

function getCompanyId(req: any): string {
  const companyId = req.user?.company_id;
  if (!companyId) {
    throw Object.assign(new Error("Company ID not found"), { status: 403 });
  }
  return companyId;
}

function getUserId(req: any): string {
  const userId = req.user?.public_user_id || req.user?.id;
  if (!userId) {
    throw Object.assign(new Error("User ID not found"), { status: 401 });
  }
  return userId;
}

function handleError(error: unknown) {
  console.error("[Projects] Error:", error);
  
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      payload: {
        error: "Validation failed",
        details: (error as any).errors.map((e: any) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    };
  }

  const status = (error as any)?.status || 500;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Internal server error";

  return { status, payload: { error: message } };
}

// ==================== ROUTES ====================

export function registerProjectRoutes(app: Application) {

  // ===== PROJECTS =====

  app.get("/projects", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { status, template_id, owner_id, contact_id } = req.query;

      const projects = await listProjects(companyId, {
        status: status as any,
        template_id: template_id as string,
        owner_user_id: owner_id as string,
      });

      return res.json(projects);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /projects/stats
   * Estatísticas dos projetos
   */
  app.get("/projects/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { template_id } = req.query;

      const stats = await getProjectStats(companyId, template_id as string);
      return res.json(stats);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * GET /projects/:id
   * Detalhes completos do projeto
   */
  app.get("/projects/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const project = await getProjectWithDetails(companyId, id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      return res.json(project);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * POST /projects
   * Cria novo projeto
   */
  app.post("/projects", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);

      const validated = CreateProjectSchema.parse(req.body);
      const project = await createProject(companyId, userId, validated);

      // Disparar Trigger de Notificação e Fluxo
      try {
        await notifyProjectCreated(
          project.id,
          project.title,
          project.owner_user_id || userId,
          companyId
        );
      } catch (triggerErr) {
        console.warn("[projects] Error firing notifyProjectCreated trigger:", triggerErr);
      }

      return res.status(201).json(project);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PUT /projects/:id
   * Atualiza projeto
   */
  app.put("/projects/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      console.log(`[DEBUG] Updating project ${id} with body:`, req.body);

      const validated = UpdateProjectSchema.parse(req.body);
      const project = await updateProject(companyId, id, userId, validated);

      console.log(`[DEBUG] Project updated:`, project);

      return res.json(project);
    } catch (error) {
      console.error(`[DEBUG] Error updating project:`, error);
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * DELETE /projects/:id
   * Deleta projeto
   */
  app.delete("/projects/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      await deleteProject(companyId, id);

      return res.json({ success: true, message: "Project deleted" });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  /**
   * PATCH /projects/:id/move
   * Move projeto de estágio
   */
  app.patch("/projects/:id/move", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;
      const { stage_id } = req.body;

      console.log(`[DEBUG] PATCH /projects/${id}/move - Stage: ${stage_id}`);

      if (!stage_id) {
        return res.status(400).json({ error: "stage_id is required" });
      }

      const project = await moveProjectStage(companyId, id, userId, stage_id);

      console.log(`[DEBUG] Project moved successfully`);

      // Disparar Trigger de Mudança de Estágio
      try {
        await notifyProjectStageChanged(
          project.id,
          project.title,
          'Estágio Anterior', // Poderia buscar o nome real se necessário
          project.stage_name || stage_id,
          project.owner_user_id || userId,
          companyId
        );
      } catch (triggerErr) {
        console.warn("[projects] Error firing notifyProjectStageChanged trigger:", triggerErr);
      }

      return res.json(project);
    } catch (error) {
      console.error(`[DEBUG] Error moving project:`, error);
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== COMMENTS =====

  app.get("/projects/:id/comments", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const comments = await listProjectComments(id);
      return res.json(comments);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/projects/:id/comments", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      const validated = CreateCommentSchema.parse(req.body);
      const comment = await addComment(companyId, id, userId, validated);

      return res.status(201).json(comment);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.delete("/projects/comments/:commentId", requireAuth, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      await deleteComment(commentId);
      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== TASKS =====

  app.get("/projects/:id/tasks", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tasks = await listProjectTasks(id);
      return res.json(tasks);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/projects/:id/tasks", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      const validated = CreateTaskSchema.parse(req.body);
      const task = await addTask(companyId, id, userId, validated);

      // Disparar Trigger de Criação de Tarefa
      try {
        await notifyTaskCreated(
          task.id,
          task.title,
          userId,
          companyId
        );

        // Se estiver atribuída
        if (task.assigned_to) {
          await notifyTaskAssigned(
            task.id,
            task.title,
            id,
            'Projeto', // Simplificado
            task.assigned_to,
            companyId
          );
        }
      } catch (triggerErr) {
        console.warn("[projects] Error firing task triggers:", triggerErr);
      }

      return res.status(201).json(task);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.put("/projects/tasks/:taskId", requireAuth, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const validated = UpdateTaskSchema.parse(req.body);
      const task = await updateTask(taskId, validated);

      // Gatilho para tarefa concluída
      if (validated.status === 'completed' || validated.is_completed) {
        try {
          // No contexto de projeto, o front pode não ter todos os detalhes
          // notifyTaskCompleted lidará com o que puder
          await notifyTaskCompleted(
            task.id,
            task.title,
            task.project_id || '',
            'Projeto',
            task.created_by || '',
            getCompanyId(req)
          );
        } catch (compErr) {
          console.warn("[projects] Error firing notifyTaskCompleted:", compErr);
        }
      }

      return res.json(task);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.delete("/projects/tasks/:taskId", requireAuth, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      await deleteTask(taskId);
      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== ATTACHMENTS =====

  app.get("/projects/:id/attachments", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const attachments = await listProjectAttachments(id);
      return res.json(attachments);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/projects/:id/attachments", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      const validated = CreateAttachmentSchema.parse(req.body);
      const attachment = await addAttachment(companyId, id, userId, validated);

      return res.status(201).json(attachment);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.post("/projects/:id/attachments/upload", requireAuth, upload.single("file"), async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id: projectId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const file = req.file;
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `${companyId}/${projectId}/${fileName}`;

      // Upload para o Supabase Storage
      const { data, error: uploadError } = await supabaseAdmin.storage
        .from("project-attachments")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error("[Projects] Upload error:", uploadError);
        throw uploadError;
      }

      // Obter URL pública
      const { data: publicData } = supabaseAdmin.storage
        .from("project-attachments")
        .getPublicUrl(filePath);

      // Adicionar registro no banco
      const attachment = await addAttachment(companyId, projectId, userId, {
        file_name: file.originalname,
        file_url: publicData.publicUrl,
        file_type: file.mimetype,
        file_size: file.size,
      });

      return res.status(201).json(attachment);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  app.delete("/projects/attachments/:attachmentId", requireAuth, async (req: any, res) => {
    try {
      const { attachmentId } = req.params;
      await deleteAttachment(attachmentId);
      return res.json({ success: true });
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });

  // ===== ACTIVITIES =====

  app.get("/projects/:id/activities", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const activities = await getProjectActivities(id);
      return res.json(activities);
    } catch (error) {
      const { status, payload } = handleError(error);
      return res.status(status).json(payload);
    }
  });
}

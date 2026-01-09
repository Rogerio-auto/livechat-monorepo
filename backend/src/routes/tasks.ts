import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getIO } from "../lib/io.js";
import {
  notifyTaskAssigned,
  notifyTaskCreated,
  notifyTaskCompleted
} from "../services/notification-triggers.service.js";
import {
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  listTasksByCompany,
  getTasksByEntity,
  getTaskStats,
  completeTask,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilters,
} from "../repos/tasks.repo.js";

export function registerTaskRoutes(app: express.Application) {
  const io = getIO();

  /**
   * POST /api/tasks - Criar nova tarefa
   */
  app.post("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user?.public_user_id || req.user?.id; // Usar public_user_id se disponível
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      if (!userId) {
        return res.status(400).json({ error: "User ID not found" });
      }

      const input: CreateTaskInput = {
        ...req.body,
        company_id: companyId,
        created_by: userId,
      };

      // Log para debug
      console.log("[tasks] 📝 Creating task with input:", {
        title: input.title,
        related_lead_id: input.related_lead_id,
        related_customer_id: input.related_customer_id,
        related_chat_id: input.related_chat_id,
        hasLeadId: !!input.related_lead_id,
        hasCustomerId: !!input.related_customer_id,
      });

      // Validações básicas
      if (!input.title || input.title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }

      const task = await createTask(input);

      // Disparar gatilhos de fluxo e notificações
      try {
        await notifyTaskCreated(
          task.id,
          task.title,
          task.created_by,
          companyId
        );
      } catch (triggerErr) {
        console.error("[tasks] Error firing notifyTaskCreated:", triggerErr);
      }

      // Emitir evento Socket.io
      io.to(`company:${companyId}`).emit("task:created", {
        task,
        companyId,
      });

      // Se foi atribuída a alguém, emitir evento específico
      if (task.assigned_to) {
        io.to(`company:${companyId}`).emit("task:assigned", {
          taskId: task.id,
          assignedTo: task.assigned_to,
          task,
          companyId,
        });

        // 🔔 Enviar notificação persistente e multi-canal via Trigger Service
        try {
          await notifyTaskAssigned(
            task.id,
            task.title,
            task.project_id || '', // Se houver projeto
            task.project_title || 'Sem Projeto',
            task.assigned_to,
            companyId
          );
        } catch (notifErr) {
          console.error("[tasks] Error sending assignment notifications via trigger:", notifErr);
        }
      }

      return res.status(201).json(task);
    } catch (error: any) {
      console.error("[tasks] Error creating task:", error);
      return res.status(500).json({ error: error.message || "Failed to create task" });
    }
  });

  /**
   * GET /api/tasks - Listar tarefas com filtros
   */
  app.get("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      // Parse filtros da query string
      const filters: TaskFilters = {
        status: req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : undefined,
        priority: req.query.priority
          ? Array.isArray(req.query.priority)
            ? req.query.priority
            : [req.query.priority]
          : undefined,
        type: req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) : undefined,
        assigned_to: req.query.assigned_to
          ? Array.isArray(req.query.assigned_to)
            ? req.query.assigned_to
            : [req.query.assigned_to]
          : undefined,
        created_by: req.query.created_by,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        overdue: req.query.overdue === "true",
        due_today: req.query.due_today === "true",
        due_this_week: req.query.due_this_week === "true",
        search: req.query.search,
        related_lead_id: req.query.related_lead_id,
        related_customer_id: req.query.related_customer_id,
        related_chat_id: req.query.related_chat_id,
        kanban_column_id: req.query.kanban_column_id,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };

      const result = await listTasksByCompany(companyId, filters);

      return res.json({
        tasks: result.tasks,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
      });
    } catch (error: any) {
      console.error("[tasks] Error listing tasks:", error);
      return res.status(500).json({ error: error.message || "Failed to list tasks" });
    }
  });

  /**
   * GET /api/tasks/stats - Estatísticas de tarefas
   */
  app.get("/api/tasks/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const stats = await getTaskStats(companyId);

      return res.json(stats);
    } catch (error: any) {
      console.error("[tasks] Error getting task stats:", error);
      return res.status(500).json({ error: error.message || "Failed to get task stats" });
    }
  });

  /**
   * GET /api/tasks/:id - Buscar tarefa por ID
   */
  app.get("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const task = await getTaskById(id, companyId);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      return res.json(task);
    } catch (error: any) {
      console.error("[tasks] Error getting task:", error);
      return res.status(500).json({ error: error.message || "Failed to get task" });
    }
  });

  /**
   * PUT /api/tasks/:id - Atualizar tarefa
   */
  app.put("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const input: UpdateTaskInput = req.body;

      // Buscar tarefa anterior para comparação
      const previousTask = await getTaskById(id, companyId);
      if (!previousTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      const task = await updateTask(id, companyId, input);

      // Gatilho para tarefa concluída
      if (input.status === 'COMPLETED' && previousTask.status !== 'COMPLETED') {
        try {
          await notifyTaskCompleted(
            task.id,
            task.title,
            previousTask.project_id || '',
            previousTask.project_title || 'Sem Projeto',
            task.created_by,
            companyId
          );
        } catch (compErr) {
          console.error("[tasks] Error firing notifyTaskCompleted:", compErr);
        }
      }

      // Emitir evento Socket.io
      io.to(`company:${companyId}`).emit("task:updated", {
        task,
        companyId,
      });

      // Se foi atribuída a alguém novo, emitir evento específico
      if (input.assigned_to && input.assigned_to !== previousTask.assigned_to) {
        io.to(`company:${companyId}`).emit("task:assigned", {
          taskId: task.id,
          assignedTo: task.assigned_to,
          task,
          companyId,
        });

        // 🔔 Enviar notificação persistente via Trigger Service
        try {
          await notifyTaskAssigned(
            task.id,
            task.title,
            previousTask.project_id || '',
            previousTask.project_title || 'Sem Projeto',
            task.assigned_to!,
            companyId
          );
        } catch (notifErr) {
          console.error("[tasks] Error sending assignment notifications via trigger:", notifErr);
        }
      }

      // Se foi marcada como completa, emitir evento específico
      if (input.status === "COMPLETED" && previousTask.status !== "COMPLETED") {
        io.to(`company:${companyId}`).emit("task:completed", {
          task,
          companyId,
        });
      }

      return res.json(task);
    } catch (error: any) {
      console.error("[tasks] Error updating task:", error);
      return res.status(500).json({ error: error.message || "Failed to update task" });
    }
  });

  /**
   * DELETE /api/tasks/:id - Deletar tarefa
   */
  app.delete("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      await deleteTask(id, companyId);

      // Emitir evento Socket.io
      io.to(`company:${companyId}`).emit("task:deleted", {
        taskId: id,
        companyId,
      });

      return res.json({ success: true, id });
    } catch (error: any) {
      console.error("[tasks] Error deleting task:", error);
      return res.status(500).json({ error: error.message || "Failed to delete task" });
    }
  });

  /**
   * PATCH /api/tasks/:id/complete - Marcar tarefa como completa
   */
  app.patch("/api/tasks/:id/complete", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const task = await completeTask(id, companyId);

      // Emitir evento Socket.io
      io.to(`company:${companyId}`).emit("task:completed", {
        task,
        companyId,
      });

      return res.json(task);
    } catch (error: any) {
      console.error("[tasks] Error completing task:", error);
      return res.status(500).json({ error: error.message || "Failed to complete task" });
    }
  });

  /**
   * GET /api/tasks/entity/:entityType/:entityId - Buscar tarefas por entidade
   */
  app.get("/api/tasks/entity/:entityType/:entityId", requireAuth, async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      if (!["lead", "customer", "chat"].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type. Must be: lead, customer, or chat" });
      }

      const tasks = await getTasksByEntity(companyId, entityType as "lead" | "customer" | "chat", entityId);

      return res.json(tasks);
    } catch (error: any) {
      console.error("[tasks] Error getting tasks by entity:", error);
      return res.status(500).json({ error: error.message || "Failed to get tasks by entity" });
    }
  });

  /**
   * GET /api/kanban/columns/:columnId/tasks - Buscar tarefas de uma coluna do kanban
   */
  app.get("/api/kanban/columns/:columnId/tasks", requireAuth, async (req: any, res) => {
    try {
      const { columnId } = req.params;
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const result = await listTasksByCompany(companyId, {
        kanban_column_id: columnId,
      });

      return res.json(result.tasks);
    } catch (error: any) {
      console.error("[tasks] Error getting tasks by kanban column:", error);
      return res.status(500).json({ error: error.message || "Failed to get tasks by kanban column" });
    }
  });

  /**
   * GET /api/tasks/calendar-view - Tarefas para visualização de calendário
   */
  app.get("/api/tasks/calendar-view", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user?.company_id;

      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }

      const { start, end } = req.query;

      const filters: TaskFilters = {
        date_from: start as string,
        date_to: end as string,
      };

      const result = await listTasksByCompany(companyId, filters);

      // Formatar para FullCalendar
      const events = result.tasks
        .filter((task) => task.due_date)
        .map((task) => ({
          id: task.id,
          title: task.title,
          start: task.due_date,
          end: task.due_date,
          allDay: true,
          backgroundColor: getPriorityColor(task.priority),
          borderColor: getPriorityColor(task.priority),
          extendedProps: {
            type: "task",
            taskType: task.type,
            status: task.status,
            priority: task.priority,
            assignedToName: task.assigned_to_name,
            description: task.description,
          },
        }));

      return res.json(events);
    } catch (error: any) {
      console.error("[tasks] Error getting calendar view:", error);
      return res.status(500).json({ error: error.message || "Failed to get calendar view" });
    }
  });
}

// Helper para cores de prioridade
function getPriorityColor(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "#DC2626"; // red-600
    case "HIGH":
      return "#F97316"; // orange-500
    case "MEDIUM":
      return "#EAB308"; // yellow-500
    case "LOW":
      return "#22C55E"; // green-500
    default:
      return "#6B7280"; // gray-500
  }
}

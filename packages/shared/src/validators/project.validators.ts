import { z } from "zod";

export const CreateProjectSchema = z.object({
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

export const UpdateProjectSchema = CreateProjectSchema.partial().omit({ template_id: true }).extend({
  status: z.string().optional(),
});

export const CreateCommentSchema = z.object({
  content: z.string().min(1, "Comentário não pode ser vazio"),
  is_internal: z.boolean().optional(),
  parent_id: z.string().uuid().optional(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  is_completed: z.boolean().optional(),
});

export const CreateAttachmentSchema = z.object({
  file_name: z.string().min(1),
  file_url: z.string().url(),
  file_type: z.string().optional(),
  file_size: z.number().optional(),
});

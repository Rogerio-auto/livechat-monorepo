import { z } from "zod";

export const SendMessageV1Schema = z.object({
  inbox_id: z.string().uuid("inbox_id inválido"),
  phone: z.string().min(8, "Número de telefone inválido"),
  text: z.string().max(4096).optional(),
  type: z.enum(["text", "image", "audio", "video", "document"]).default("text"),
  media_url: z.string().url("URL de mídia inválida").optional(),
  media_base64: z.string().optional(),
  filename: z.string().optional(),
  name: z.string().optional(), // Nome do contato (opcional)
});

export const UpsertContactV1Schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().min(8, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
});

export const ToggleAiAgentV1Schema = z.object({
  enabled: z.boolean(),
});

export const TriggerFlowV1Schema = z.object({
  contact_id: z.string().uuid("contact_id inválido"),
  chat_id: z.string().uuid("chat_id inválido").optional(),
  trigger_data: z.record(z.any()).optional().default({}),
});

export const WebhookSubscriptionV1Schema = z.object({
  url: z.string().url("URL inválida"),
  events: z.array(z.string()).default(["*"]),
});

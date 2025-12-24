import { z } from "zod";

export const CampaignSchema = z.object({
  name: z.string().min(1, "Nome da campanha é obrigatório").max(255),
  type: z.enum(["BROADCAST", "API", "TRIGGER"]).default("BROADCAST"),
  inbox_id: z.string().uuid("ID da inbox inválido").optional().nullable(),
  rate_limit_per_minute: z.number().int().min(1).max(1000).default(30),
  auto_handoff: z.boolean().default(false),
  start_at: z.string().datetime({ offset: true }).optional().nullable(),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  send_windows: z.object({
    enabled: z.boolean().default(false),
    windows: z.array(z.object({
      day: z.number().min(0).max(6),
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    })).optional(),
  }).optional().default({ enabled: false }),
  timezone: z.string().default("America/Sao_Paulo"),
  status: z.enum(["DRAFT", "RUNNING", "PAUSED", "SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  segment_id: z.string().uuid().optional().nullable(),
});

export const CampaignUpdateSchema = CampaignSchema.partial();

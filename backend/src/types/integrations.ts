import { z } from "zod";

const JsonRecordSchema = z.record(z.string(), z.any());
const TrimmedString = z.string().trim().min(1);

const ModelsAllowedSchema = z
  .array(TrimmedString)
  .optional()
  .transform((value) => (value ? Array.from(new Set(value)) : undefined));

export const OpenAIIntegrationSchema = z
  .object({
    name: TrimmedString,
    api_key: TrimmedString,
    org_id: TrimmedString.optional(),
    project_id: TrimmedString.optional(),
    default_model: TrimmedString.optional(),
    models_allowed: ModelsAllowedSchema,
    usage_limits: JsonRecordSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

const AgentStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const AgentSchema = z
  .object({
    name: TrimmedString,
    description: TrimmedString.max(40000).optional(),
    status: AgentStatusSchema.optional(),
    integration_openai_id: TrimmedString.optional().or(z.null()),
    model: TrimmedString.optional(),
    model_params: JsonRecordSchema.optional(),
    aggregation_enabled: z.boolean().optional(),
    aggregation_window_sec: z.number().int().min(1).optional(),
    max_batch_messages: z.number().int().min(1).optional(),
    reply_if_idle_sec: z.number().int().min(0).nullable().optional(),
    media_config: JsonRecordSchema.optional(),
    tools_policy: JsonRecordSchema.optional(),
    allow_handoff: z.boolean().optional(),
    ignore_group_messages: z.boolean().optional(),
    enabled_inbox_ids: z.array(z.string().uuid()).optional(),
    transcription_model: z.string().optional().or(z.null()).transform(val => val === "" ? null : val),
    vision_model: z.string().optional().or(z.null()).transform(val => val === "" ? null : val),
  })
  .strict();

export type OpenAIIntegrationInput = z.infer<typeof OpenAIIntegrationSchema>;
export type AgentInput = z.infer<typeof AgentSchema>;

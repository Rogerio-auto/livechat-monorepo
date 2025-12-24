import { z } from "zod";

export const SendMessageSchema = z.object({
  chatId: z.string().uuid("ID do chat inválido"),
  text: z.string().min(1, "A mensagem não pode estar vazia").max(4096, "Mensagem muito longa"),
  senderType: z.enum(["AGENT", "CUSTOMER", "BOT"]).optional().default("AGENT"),
  reply_to: z.string().uuid().optional().nullable(),
});

export const CreateChatSchema = z.object({
  inboxId: z.string().uuid("ID da caixa de entrada inválido"),
  customerId: z.string().uuid("ID do cliente inválido"),
  externalId: z.string().optional().nullable(),
  initialMessage: z.string().optional().nullable(),
});

export const UpdateChatStatusSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "CLOSED", "RESOLVED"]),
});

export const TransferChatSchema = z.object({
  departmentId: z.string().uuid("ID do departamento inválido"),
});

export const AssignAgentSchema = z.object({
  agentId: z.string().uuid("ID do agente inválido").nullable(),
});

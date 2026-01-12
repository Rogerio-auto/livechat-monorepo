import { z } from "zod";

export const ROLE_VALUES = ["AGENT", "SUPERVISOR", "TECHNICIAN", "MANAGER"] as const;

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(ROLE_VALUES).default("AGENT"),
  avatarUrl: z.string().url().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(ROLE_VALUES).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nada para atualizar",
  });

import { z } from "zod";

export const ContactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(255),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email("Email inválido").max(255).optional().nullable().or(z.literal("")),
  instagram: z.string().max(100).optional().nullable(),
  facebook: z.string().max(100).optional().nullable(),
  twitter: z.string().max(100).optional().nullable(),
  telegram: z.string().max(100).optional().nullable(),
  website: z.string().url("URL inválida").max(255).optional().nullable().or(z.literal("")),
  notes: z.string().max(2000).optional().nullable(),
});

export const ContactUpdateSchema = ContactSchema.partial();

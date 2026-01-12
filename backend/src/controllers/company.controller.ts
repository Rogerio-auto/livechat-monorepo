import { Response } from "express";
import { AuthRequest } from "../types/express.js";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";

export class CompanyController {
  static async getMyCompany(req: AuthRequest, res: Response) {
    try {
      const authUserId = req.user?.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { data: comp, error: cerr } = await supabaseAdmin
        .from("companies")
        .select("id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at")
        .eq("id", companyId)
        .maybeSingle();
      if (cerr) return res.status(500).json({ error: cerr.message });
      if (!comp) return res.status(404).json({ error: "Empresa não encontrada" });
      return res.json(comp);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company get error" });
    }
  }

  static async updateMyCompany(req: AuthRequest, res: Response) {
    try {
      const authUserId = req.user?.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const schema = z.object({
        name: z.string().min(1).optional(),
        cnpj: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().min(3).optional(),
        address: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        zip_code: z.string().optional().nullable(),
        logo: z.string().url().optional().nullable(),
      }).passthrough();
      
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      
      const body = parsed.data as any;
      const update: Record<string, any> = {};
      const fields = ["name", "cnpj", "email", "phone", "address", "city", "state", "zip_code", "logo"] as const;
      for (const k of fields) if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
      update.updated_at = new Date().toISOString();

      const { data: updated, error } = await supabaseAdmin
        .from("companies")
        .update(update)
        .eq("id", companyId)
        .select("id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at")
        .single();
      if (error) return res.status(500).json({ error: error.message });

      req.app?.locals?.io?.emit("company:updated", { companyId, changes: update, company: updated });
      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company update error" });
    }
  }
}

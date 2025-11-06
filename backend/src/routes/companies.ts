import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";

// Middleware para verificar se é ADMIN
async function requireAdmin(req: any, res: any, next: any) {
  const authUserId = req.user?.id;
  if (!authUserId) return res.status(401).json({ error: "Não autenticado" });
  
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle();
  
  if (String(user?.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }
  
  next();
}

export function registerCompanyRoutes(app: express.Application) {
  // GET all companies (ADMIN only)
  app.get("/api/companies", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { data: companies, error } = await supabaseAdmin
        .from("companies")
        .select("id, name, email, phone, address, created_at")
        .order("created_at", { ascending: false });
      
      if (error) return res.status(500).json({ error: error.message });
      
      // Buscar contadores para cada empresa
      const companiesWithCounts = await Promise.all(
        (companies || []).map(async (company: any) => {
          // Contar usuários
          const { count: usersCount } = await supabaseAdmin
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          // Contar inboxes
          const { count: inboxesCount } = await supabaseAdmin
            .from("inboxes")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          // Contar agentes
          const { count: agentsCount } = await supabaseAdmin
            .from("agents")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          return {
            ...company,
            _count: {
              users: usersCount || 0,
              inboxes: inboxesCount || 0,
              agents: agentsCount || 0,
            },
          };
        })
      );
      
      return res.json(companiesWithCounts);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "companies list error" });
    }
  });

  // GET current user's company data
  app.get("/companies/me", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
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
        .select(
          "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at"
        )
        .eq("id", companyId)
        .maybeSingle();
      if (cerr) return res.status(500).json({ error: cerr.message });
      if (!comp) return res.status(404).json({ error: "Empresa não encontrada" });
      return res.json(comp);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company get error" });
    }
  });

  // PUT update current user's company data (partial)
  app.put("/companies/me", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const schema = z
        .object({
          name: z.string().min(1).optional(),
          cnpj: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().min(3).optional(),
          address: z.string().optional().nullable(),
          city: z.string().optional().nullable(),
          state: z.string().optional().nullable(),
          zip_code: z.string().optional().nullable(),
          logo: z.string().url().optional().nullable(),
        })
        .passthrough();
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }
      const body = parsed.data as any;
      const update: Record<string, any> = {};
      const fields = [
        "name",
        "cnpj",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip_code",
        "logo",
      ] as const;
      for (const k of fields)
        if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
      update.updated_at = new Date().toISOString();
      if (Object.keys(update).length === 1) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("companies")
        .update(update)
        .eq("id", companyId)
        .select(
          "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at"
        )
        .single();
      if (error) return res.status(500).json({ error: error.message });

      try {
        getIO()?.emit("company:updated", { companyId, changes: update, company: updated });
      } catch {}

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company update error" });
    }
  });
}


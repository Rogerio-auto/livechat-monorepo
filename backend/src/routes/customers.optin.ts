// src/routes/customers.optin.ts
import express from "express";
import { AuthRequest } from "../types/express.js";
import type { Application } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import {
  registerOptIn,
  registerOptOut,
  getOptInStatus,
  getOptInStatusByPhone,
  bulkRegisterOptIn,
} from "../services/customers/opt-in.service.js";
import { z } from "zod";

const OptInSchema = z.object({
  method: z.enum(["whatsapp", "website", "checkout", "import", "manual"]),
  source: z.string().optional(),
});

const BulkOptInSchema = z.object({
  phones: z.array(z.string()).min(1).max(1000),
  method: z.enum(["whatsapp", "website", "checkout", "import", "manual"]),
  source: z.string().optional(),
});

export function registerCustomerOptInRoutes(app: Application) {
  async function resolveCompanyId(req: AuthRequest): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, user_id, company_id")
      .eq("user_id", req.user?.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as any;
    const companyId = row?.company_id;
    if (!companyId) throw new Error("Usuário sem company_id");

    if (req.user) {
      req.user.company_id ||= companyId;
      req.user.db_user_id = row?.id ?? null;
      req.user.user_uid = row?.user_id ?? null;
    }

    return companyId;
  }

  const router = express.Router();

  /**
   * POST /api/customers/:customerId/opt-in
   * Registra consentimento de marketing (LGPD)
   */
  router.post("/:customerId/opt-in", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { customerId } = req.params;

      // Validar body
      const parsed = OptInSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: parsed.error.flatten() 
        });
      }

      // Validar customer pertence à company
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone")
        .eq("id", customerId)
        .eq("company_id", companyId)
        .single();

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const result = await registerOptIn({
        customerId,
        method: parsed.data.method,
        source: parsed.data.source,
      });

      return res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
        opt_in: result,
      });
    } catch (error) {
      console.error("[Opt-in API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao registrar opt-in",
      });
    }
  });

  /**
   * POST /api/customers/:customerId/opt-out
   * Remove consentimento de marketing (LGPD)
   */
  router.post("/:customerId/opt-out", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { customerId } = req.params;

      // Validar customer pertence à company
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone")
        .eq("id", customerId)
        .eq("company_id", companyId)
        .single();

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const result = await registerOptOut(customerId);

      return res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
        opt_out: result,
      });
    } catch (error) {
      console.error("[Opt-out API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao registrar opt-out",
      });
    }
  });

  /**
   * GET /api/customers/:customerId/opt-in-status
   * Consulta status de opt-in de um cliente
   */
  router.get("/:customerId/opt-in-status", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { customerId } = req.params;

      // Validar customer pertence à company
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, company_id")
        .eq("id", customerId)
        .single();

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      if (customer.company_id !== companyId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const status = await getOptInStatus(customerId);

      if (!status) {
        return res.status(404).json({ error: "Status não encontrado" });
      }

      return res.json({
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
        opt_in: status,
      });
    } catch (error) {
      console.error("[Opt-in Status API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao consultar status",
      });
    }
  });

  /**
   * GET /api/customers/opt-in-status/phone/:phone
   * Consulta status de opt-in por telefone
   */
  router.get("/opt-in-status/phone/:phone", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { phone } = req.params;

      // Validar customer pertence à company
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name, phone, company_id")
        .eq("phone", phone)
        .eq("company_id", companyId)
        .single();

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const status = await getOptInStatusByPhone(phone);

      if (!status) {
        return res.status(404).json({ error: "Status não encontrado" });
      }

      return res.json({
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
        opt_in: status,
      });
    } catch (error) {
      console.error("[Opt-in Status API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao consultar status",
      });
    }
  });

  /**
   * POST /api/customers/opt-in/bulk
   * Registra opt-in em massa para múltiplos telefones
   */
  router.post("/opt-in/bulk", requireAuth, async (req, res) => {
    try {
      const companyId = await resolveCompanyId(req);

      // Validar body
      const parsed = BulkOptInSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: parsed.error.flatten() 
        });
      }

      const result = await bulkRegisterOptIn({
        phones: parsed.data.phones,
        method: parsed.data.method,
        source: parsed.data.source,
        companyId,
      });

      return res.json({
        success: true,
        summary: {
          total: parsed.data.phones.length,
          success: result.success,
          failed: result.failed,
        },
        errors: result.errors.length > 0 ? result.errors.slice(0, 10) : [], // Max 10 erros
      });
    } catch (error) {
      console.error("[Bulk Opt-in API] Erro:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao registrar opt-ins em massa",
      });
    }
  });

  app.use("/api/customers", router);
}

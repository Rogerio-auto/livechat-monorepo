import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";
import { NotificationService } from "../services/NotificationService.ts";

export function registerProposalRoutes(app: express.Application) {
  // List proposals
  app.get("/proposals", requireAuth, async (req: any, res) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.json([]);

      const leadFilter = (req.query.leadId as string | undefined)?.trim();

      let query = supabaseAdmin
        .from("proposals")
        .select(
          "id, number, title, description, total_value, status, valid_until, created_at, customer_id, ai_generated, lead_id"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (leadFilter) query = query.eq("lead_id", leadFilter);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Proposals list error" });
    }
  });

  // Create proposal
  app.post("/proposals", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      if (!urow?.company_id) return res.status(404).json({ error: "Usuário sem company_id" });

      const body = req.body || {};
      let customerId: string | null = body.customer_id || null;
      const leadId: string | null = body.lead_id || null;

      // Se não tem customer_id, tentar criar/encontrar a partir do lead_id
      if (!customerId && leadId) {
        try {
          const { data: cust } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("lead_id", leadId)
            .maybeSingle();
          customerId = (cust as any)?.id || null;
        } catch {}
        
        // Se ainda não tem customer, criar um a partir do lead
        if (!customerId) {
          const { data: l } = await supabaseAdmin
            .from("leads")
            .select("id, name, email")
            .eq("id", leadId)
            .maybeSingle();
          
          if (l) {
            const payload: any = {
              company_id: (urow as any).company_id,
              name: (l as any)?.name || "Cliente",
              email: (l as any)?.email || null,
            };
            try {
              payload.lead_id = leadId;
              const { data: created } = await supabaseAdmin
                .from("customers")
                .insert([payload])
                .select("id")
                .single();
              customerId = (created as any)?.id || null;
            } catch {
              delete payload.lead_id;
              const { data: created2 } = await supabaseAdmin
                .from("customers")
                .insert([payload])
                .select("id")
                .single();
              customerId = (created2 as any)?.id || null;
            }
          }
        }
      }
      
      // customer_id agora é opcional - proposta pode ser criada sem cliente

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const num =
        "P-" +
        now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        "-" +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());

      const insert: any = {
        number: num,
        title: String(body.title || "Proposta"),
        description: body.description ?? null,
        system_power: Number(body.system_power ?? 0) || 0,
        panel_quantity: Number(body.panel_quantity ?? 1) || 1,
        total_value: Number(body.total_value ?? 0) || 0,
        installments: body.installments ?? 1,
        installment_value: body.installment_value ?? null,
        valid_days: Number(body.valid_days ?? 30) || 30,
        valid_until: new Date(now.getTime() + (Number(body.valid_days ?? 30) || 30) * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        status: body.status || "DRAFT",
        ai_generated: !!body.ai_generated,
        company_id: (urow as any).company_id,
        customer_id: customerId,
        lead_id: leadId,
        created_by_id: (urow as any).id,
        // Campos de pagamento
        payment_method: body.payment_method ?? null,
        payment_terms: body.payment_terms ?? null,
        // Campos de financiamento (se aplicável)
        financing_bank: body.financing_bank ?? null,
        financing_installments: body.financing_installments ?? null,
        financing_installment_value: body.financing_installment_value ?? null,
        financing_interest_rate: body.financing_interest_rate ?? null,
        financing_total_amount: body.financing_total_amount ?? null,
        financing_entry_value: body.financing_entry_value ?? null,
        financing_cet: body.financing_cet ?? null,
        financing_iof: body.financing_iof ?? null,
        financing_type: body.financing_type ?? null,
        financing_first_due_date: body.financing_first_due_date ?? null,
      };

      const { data, error } = await supabaseAdmin
        .from("proposals")
        .insert([insert])
        .select("id")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      try {
        getIO()?.emit("proposals:changed", { type: "created", id: (data as any).id });
      } catch {}
      return res.status(201).json({ id: (data as any).id, number: num });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create proposal error" });
    }
  });

  // Edit proposal (partial update)
  app.patch("/proposals/:id", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { id } = req.params as { id: string };
      const { data: prop, error: perr } = await supabaseAdmin
        .from("proposals")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (perr) return res.status(500).json({ error: perr.message });
      if (!prop || (prop as any).company_id !== companyId)
        return res.status(404).json({ error: "Proposta não encontrada" });

      const body = req.body || {};
      const up: Record<string, any> = {};
      const fields = [
        "title",
        "description",
        "system_power",
        "panel_quantity",
        "total_value",
        "installments",
        "installment_value",
        "valid_until",
        "status",
      ] as const;
      for (const k of fields) if (Object.prototype.hasOwnProperty.call(body, k)) up[k] = (body as any)[k];
      if (Object.keys(up).length === 0) return res.status(400).json({ error: "Nada para atualizar" });

      const { error } = await supabaseAdmin.from("proposals").update(up).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      try {
        getIO()?.emit("proposals:changed", { type: "updated", id });
      } catch {}
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update proposal error" });
    }
  });

  // Update proposal status
  app.patch("/proposals/:id/status", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { id } = req.params as { id: string };
      const status = String((req.body?.status ?? "")).trim();
      if (!status) return res.status(400).json({ error: "status obrigatório" });
      const allowed = new Set(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "CANCELLED", "APPROVED"]);
      if (!allowed.has(status.toUpperCase())) {
        return res.status(400).json({ error: "status inválido" });
      }

      const { data: prop, error: perr } = await supabaseAdmin
        .from("proposals")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (perr) return res.status(500).json({ error: perr.message });
      if (!prop || (prop as any).company_id !== companyId) {
        return res.status(404).json({ error: "Proposta não encontrada" });
      }

      const { error } = await supabaseAdmin.from("proposals").update({ status }).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      
      // 🔔 Enviar notificação se proposta foi aceita
      if (status.toUpperCase() === "ACCEPTED") {
        try {
          const { data: proposal } = await supabaseAdmin
            .from("proposals")
            .select("id, customer_id, customers(name)")
            .eq("id", id)
            .maybeSingle();

          const customerName = (proposal as any)?.customers?.name || "Cliente";
          
          await NotificationService.create({
            title: "🎉 Proposta Aceita!",
            message: `${customerName} aceitou a proposta #${id.substring(0, 8)}`,
            type: "PROPOSAL_ACCEPTED",
            userId: authUserId,
            companyId: companyId,
            data: { proposalId: id, customerName },
            actionUrl: `/dashboard/propostas/${id}`,
          });
          console.log("[PATCH /proposals/:id/status] 🔔 Notificação PROPOSAL_ACCEPTED enviada");
        } catch (notifError) {
          console.warn("[PATCH /proposals/:id/status] ⚠️ Erro ao enviar notificação:", notifError);
        }
      }
      
      try {
        getIO()?.emit("proposals:changed", { type: "updated", id });
      } catch {}
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Update proposal status error" });
    }
  });

  // Duplicate proposal
  app.post("/proposals/:id/duplicate", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { id } = req.params as { id: string };
      const { data: src, error: serr } = await supabaseAdmin
        .from("proposals")
        .select(
          "id, number, title, description, system_power, panel_quantity, total_value, installments, installment_value, valid_until, status, ai_generated, company_id"
        )
        .eq("id", id)
        .maybeSingle();
      if (serr) return res.status(500).json({ error: serr.message });
      if (!src || (src as any).company_id !== companyId)
        return res.status(404).json({ error: "Proposta não encontrada" });

      // Generate new sequential-like number (YYYYMM-####)
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}`;
      const { data: last } = await supabaseAdmin
        .from("proposals")
        .select("number")
        .like("number", `${ym}-%`)
        .order("number", { ascending: false })
        .limit(1);
      let seq = 1;
      const lastNum = Array.isArray(last) && (last as any)[0]?.number ? String((last as any)[0].number) : null;
      if (lastNum && /^\d{6}-\d{4}$/.test(lastNum)) {
        seq = (parseInt(lastNum.slice(-4)) || 0) + 1;
      }
      const newNumber = `${ym}-${seq.toString().padStart(4, "0")}`;

      // Calculate new valid_until based on previous or +30d
      const baseValidDays = (() => {
        try {
          const srcDate = (src as any).valid_until ? new Date((src as any).valid_until) : null;
          if (srcDate && !isNaN(srcDate.getTime())) {
            const diffMs = srcDate.getTime() - now.getTime();
            const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
            return days;
          }
        } catch {}
        return 30;
      })();
      const newValidUntil = new Date(now.getTime() + baseValidDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const insert: any = {
        number: newNumber,
        title: `${(src as any).title || "Proposta"} (Cópia)`,
        description: (src as any).description ?? null,
        system_power: (src as any).system_power ?? null,
        panel_quantity: (src as any).panel_quantity ?? 1,
        total_value: (src as any).total_value ?? 0,
        installments: (src as any).installments ?? 1,
        installment_value: (src as any).installment_value ?? null,
        valid_until: newValidUntil,
        status: "DRAFT",
        ai_generated: false,
        company_id: companyId,
        customer_id: (src as any).customer_id ?? null,
        lead_id: (src as any).lead_id ?? null,
        created_by_id: (urow as any).id,
      };

      const { data: created, error: cerr } = await supabaseAdmin
        .from("proposals")
        .insert([insert])
        .select("id, number")
        .single();
      if (cerr) return res.status(500).json({ error: cerr.message });
      try {
        getIO()?.emit("proposals:changed", { type: "created", id: (created as any).id });
      } catch {}
      return res.status(201).json({ id: (created as any).id, number: (created as any).number });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Duplicate proposal error" });
    }
  });

  // Delete proposal
  app.delete("/proposals/:id", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { id } = req.params as { id: string };
      const { data: prop, error: perr } = await supabaseAdmin
        .from("proposals")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (perr) return res.status(500).json({ error: perr.message });
      if (!prop || (prop as any).company_id !== companyId)
        return res.status(404).json({ error: "Proposta não encontrada" });

      // Delete linked documents first
      try {
        await supabaseAdmin.from("documents").delete().eq("company_id", companyId).eq("proposta_id", id);
      } catch {}
      const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      try {
        getIO()?.emit("proposals:changed", { type: "deleted", id });
      } catch {}
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete proposal error" });
    }
  });
}


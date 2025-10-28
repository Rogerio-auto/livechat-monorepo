import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { DOCS_BUCKET } from "../config/env.ts";

export function registerDocumentRoutes(app: express.Application) {
  // List documents for current user's company
  app.get("/documents", requireAuth, async (req: any, res) => {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.json([]);

      const customerId = (req.query.customer_id as string | undefined)?.trim();
      const docType = (req.query.doc_type as string | undefined)?.trim();

      let query = supabaseAdmin
        .from("documents")
        .select(
          "id, customer_id, proposta_id, doc_type, status, number, series, full_number, total, issued_at, due_at, created_at, pdf_path"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (customerId) query = query.eq("customer_id", customerId);
      if (docType) query = query.eq("doc_type", docType);

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      const items = (data || []).map((d: any) => ({
        id: d.id,
        customer_id: d.customer_id,
        proposta_id: d.proposta_id || null,
        doc_type: d.doc_type,
        status: d.status,
        number: d.number,
        series: d.series,
        full_number: d.full_number || (d.series ? String(d.series) + "-" + String(d.number) : d.number ?? ""),
        total: d.total,
        issued_at: d.issued_at,
        due_at: d.due_at,
        created_at: d.created_at,
        has_pdf: !!d.pdf_path,
      }));
      return res.json(items);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Documents list error" });
    }
  });

  // Download document PDF (redirect to signed URL)
  app.get("/documents/:id/download", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const { data, error } = await supabaseAdmin
        .from("documents")
        .select("pdf_path")
        .eq("id", id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      const pdfPath = (data as any)?.pdf_path as string | null;
      if (!pdfPath) return res.status(404).json({ error: "PDF não disponível" });
      const { data: signed, error: sErr } = await (supabaseAdmin as any).storage
        .from(DOCS_BUCKET)
        .createSignedUrl(pdfPath, 60);
      if (sErr) return res.status(500).json({ error: sErr.message });
      if (!signed?.signedUrl) return res.status(500).json({ error: "Falha ao assinar URL" });
      return res.redirect(signed.signedUrl);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Download error" });
    }
  });

  // Create simple CONTRACT doc draft
  app.post("/documents", requireAuth, async (req: any, res) => {
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

      if (!customerId && leadId) {
        try {
          const { data: cust } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("lead_id", leadId)
            .maybeSingle();
          customerId = (cust as any)?.id || null;
        } catch {}
        if (!customerId) {
          const { data: l } = await supabaseAdmin
            .from("leads")
            .select("id, name, email")
            .eq("id", leadId)
            .maybeSingle();
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
      if (!customerId) return res.status(400).json({ error: "customer_id ou lead_id obrigatório" });

      const discountPct = Number(body.discountPct || 0);
      const itemDesc = String(body.item_description || "Item");
      const qty = Number(body.quantity || 1);
      const unitPrice = Number(body.unit_price || 0);
      const subtotal = qty * unitPrice;
      const discount = (Math.max(0, Math.min(100, discountPct)) / 100) * subtotal;
      const total = Math.max(0, subtotal - discount);
      const propId: string | null = (body.proposal_id || body.proposta_id || body?.metadata?.proposal_id || null) ?? null;

      const meta: any = { ...(body.metadata ?? {}) };
      meta.payload = { item_description: itemDesc, quantity: qty, unit_price: unitPrice, discountPct };

      const docInsert: any = {
        company_id: (urow as any).company_id,
        doc_type: String(body.doc_type || "CONTRACT"),
        status: "DRAFT",
        customer_id: customerId,
        currency: "BRL",
        metadata: meta,
        proposta_id: propId,
        subtotal,
        discount,
        total,
        created_by: (urow as any).id,
        updated_by: (urow as any).id,
      };

      const { data: doc, error: dErr } = await supabaseAdmin
        .from("documents")
        .insert([docInsert])
        .select("id")
        .single();
      if (dErr) return res.status(500).json({ error: dErr.message });

      const docId = (doc as any).id as string;
      const item = {
        document_id: docId,
        position: 1,
        description: itemDesc,
        quantity: qty,
        unit: body.unit || null,
        unit_price: unitPrice,
        total: total,
      } as any;
      try {
        await supabaseAdmin.from("document_items").insert([item]);
      } catch {}
      return res.status(201).json({ id: docId });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create document error" });
    }
  });
}


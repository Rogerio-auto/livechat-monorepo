import { Response } from "express";
import { AuthRequest } from "../types/express.js";
import { supabaseAdmin } from "../lib/supabase.js";

const DOCS_BUCKET = process.env.DOCS_BUCKET || "documents";

export class DocumentController {
  static async listDocuments(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from("users").select("id, company_id").eq("user_id", req.user?.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.json([]);

      const customerId = (req.query.customer_id as string | undefined)?.trim();
      const docType = (req.query.doc_type as string | undefined)?.trim();

      let query = supabaseAdmin.from("documents").select("id, customer_id, proposta_id, doc_type, status, number, series, full_number, total, issued_at, due_at, created_at, pdf_path").eq("company_id", companyId).order("created_at", { ascending: false });

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
        full_number: d.full_number || (d.series ? String(d.series) + "-" + String(d.number) : (d.number ?? "")),
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
  }

  static async getById(req: AuthRequest, res: Response) {
      try {
          const { id } = req.params;
          const { data, error } = await supabaseAdmin.from("documents").select("*").eq("id", id).maybeSingle();
          if (error) return res.status(500).json({ error: error.message });
          return res.json(data);
      } catch (e: any) {
          return res.status(500).json({ error: e.message });
      }
  }

  static async downloadDocument(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin.from("documents").select("pdf_path").eq("id", id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      const pdfPath = (data as any)?.pdf_path as string | null;
      if (!pdfPath) return res.status(404).json({ error: "PDF não disponível" });
      const { data: signed, error: sErr } = await (supabaseAdmin as any).storage.from(DOCS_BUCKET).createSignedUrl(pdfPath, 60);
      if (sErr) return res.status(500).json({ error: sErr.message });
      return res.redirect(signed.signedUrl);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Download error" });
    }
  }

  static async createDocument(req: AuthRequest, res: Response) {
      try {
          const { data: urow } = await supabaseAdmin.from("users").select("id, company_id").eq("user_id", req.user?.id).maybeSingle();
          const companyId = (urow as any)?.company_id;
          if (!companyId) return res.status(403).send();

          const { data, error } = await supabaseAdmin.from("documents").insert([{ ...req.body, company_id: companyId }]).select().single();
          if (error) return res.status(500).json({ error: error.message });
          return res.status(201).json(data);
      } catch (e: any) {
          return res.status(500).json({ error: e.message });
      }
  }
}


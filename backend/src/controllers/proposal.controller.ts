import { Response } from "express";
import { AuthRequest } from "../types/express.js";
import { supabaseAdmin } from "../lib/supabase.js";

export class ProposalController {
  static async listProposals(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", req.user?.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;

      if (!companyId) return res.json([]);

      const leadFilter = (req.query.leadId as string | undefined)?.trim();

      let query = supabaseAdmin
        .from("proposals")
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (leadFilter) query = query.eq("lead_id", leadFilter);

      const { data: src, error: serr } = await query;
      if (serr) return res.status(500).json({ error: serr.message });
      return res.json(src || []);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "proposals list error" });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: urow } = await supabaseAdmin.from("users").select("company_id").eq("user_id", req.user?.id).maybeSingle();
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(403).send();

      const { data, error } = await supabaseAdmin.from("proposals").select("*").eq("id", id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data || (data as any).company_id !== companyId) return res.status(404).send();
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async createProposal(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("user_id", req.user?.id)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(403).json({ error: "No company" });

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}`;
      const { data: last } = await supabaseAdmin.from("proposals").select("number").like("number", `${ym}-%`).order("number", { ascending: false }).limit(1);
      let seq = 1;
      const lastNum = Array.isArray(last) && (last as any)[0]?.number ? String((last as any)[0].number) : null;
      if (lastNum && /^\d{6}-\d{4}$/.test(lastNum)) seq = (parseInt(lastNum.slice(-4)) || 0) + 1;
      const newNumber = `${ym}-${seq.toString().padStart(4, "0")}`;

      const insert: any = { ...req.body, company_id: companyId, number: newNumber, created_by_id: (urow as any).id };
      const { data: created, error: cerr } = await supabaseAdmin.from("proposals").insert([insert]).select("*").single();

      if (cerr) return res.status(500).json({ error: cerr.message });
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "proposal create error" });
    }
  }

  static async duplicateProposal(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { data: urow } = await supabaseAdmin.from("users").select("id, company_id").eq("user_id", req.user?.id).maybeSingle();
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(403).send();

      const { data: src, error: serr } = await supabaseAdmin.from("proposals").select("*").eq("id", id).maybeSingle();
      if (serr || !src) return res.status(404).json({ error: "Proposta não encontrada" });

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}`;
      const { data: last } = await supabaseAdmin.from("proposals").select("number").like("number", `${ym}-%`).order("number", { ascending: false }).limit(1);
      let seq = 1;
      const lastNum = Array.isArray(last) && (last as any)[0]?.number ? String((last as any)[0].number) : null;
      if (lastNum && /^\d{6}-\d{4}$/.test(lastNum)) seq = (parseInt(lastNum.slice(-4)) || 0) + 1;
      
      const { id: _, number: __, created_at: ___, updated_at: ____, ...rest } = src as any;
      const insert = {
        ...rest,
        number: `${ym}-${seq.toString().padStart(4, "0")}`,
        title: `${rest.title || "Proposta"} (Cópia)`,
        status: "DRAFT",
      };

      const { data: created, error: cerr } = await supabaseAdmin.from("proposals").insert([insert]).select("*").single();
      if (cerr) return res.status(500).json({ error: cerr.message });
      
      return res.status(201).json(created);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { data: urow } = await supabaseAdmin.from("users").select("company_id").eq("user_id", req.user?.id).maybeSingle();
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(403).send();

      const { data, error } = await supabaseAdmin.from("proposals").update({ status }).eq("id", id).eq("company_id", companyId).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async stats(req: AuthRequest, res: Response) {
    try {
      const { data: urow } = await supabaseAdmin.from("users").select("company_id").eq("user_id", req.user?.id).maybeSingle();
      const companyId = (urow as any)?.company_id;
      if (!companyId) return res.status(403).send();

      const { data, error } = await supabaseAdmin.from("proposals").select("status, total_value").eq("company_id", companyId);
      if (error) return res.status(500).json({ error: error.message });

      const stats = {
        total: data.length,
        draft: data.filter(p => p.status === 'DRAFT').length,
        sent: data.filter(p => p.status === 'SENT').length,
        approved: data.filter(p => p.status === 'APPROVED').length,
        rejected: data.filter(p => p.status === 'REJECTED').length,
        totalValue: data.reduce((sum, p) => sum + (Number(p.total_value) || 0), 0)
      };
      return res.json(stats);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  static async deleteProposal(req: AuthRequest, res: Response) {
    try {
      const { data: urow, error: uerr } = await supabaseAdmin.from("users").select("id, company_id").eq("user_id", req.user?.id).maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id || null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { id } = req.params;
      const { data: prop, error: perr } = await supabaseAdmin.from("proposals").select("id, company_id").eq("id", id).maybeSingle();
      if (perr) return res.status(500).json({ error: perr.message });
      if (!prop || (prop as any).company_id !== companyId) return res.status(404).json({ error: "Proposta não encontrada" });

      await supabaseAdmin.from("documents").delete().eq("company_id", companyId).eq("proposta_id", id);
      const { error } = await supabaseAdmin.from("proposals").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      
      const io = (req.app as any).get("io");
      if (io) io.emit("proposals:changed", { type: "deleted", id });
      
      return res.status(204).send();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Delete proposal error" });
    }
  }
}


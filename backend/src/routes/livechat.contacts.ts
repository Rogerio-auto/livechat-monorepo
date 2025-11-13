import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

export function registerLivechatContactsRoutes(app: express.Application) {
  // List contacts of current user's company
 // ===== Livechat Contacts (customers) =====
 // List contacts of current user's company (fallback to customers if customers not available)
// ===== Livechat Contacts (customers) =====
app.get("/livechat/contacts", requireAuth, async (req: any, res) => {
  try {
    // 1) company_id do usuário autenticado (aceita user_id OU id)
    const authUserId = String(req?.user?.id ?? "");
    if (!authUserId) return res.status(401).json({ error: "unauthenticated" });

    const { data: urow, error: errU } = await supabaseAdmin
      .from("users")
      .select("company_id, id, user_id")
      .or(`user_id.eq.${authUserId},id.eq.${authUserId}`)
      .maybeSingle();

    if (errU) return res.status(500).json({ error: errU.message });
    if (!urow?.company_id)
      return res.status(404).json({ error: "Usuário sem company_id" });

    const companyId = String(urow.company_id);

    // 2) query params
    const q = (req.query.q as string | undefined)?.trim() || "";
    const city = (req.query.city as string | undefined)?.trim() || "";
    // aceita ?state= e ?uf= como alias para state
    const stateParam =
      (req.query.state as string | undefined)?.trim() ||
      (req.query.uf as string | undefined)?.trim() ||
      "";

    const rawLimit = Number(req.query.limit ?? 20);
    const rawOffset = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    // 3) consulta — apenas colunas REAIS do schema
    let query = supabaseAdmin
      .from("customers")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });

    if (q) {
      // busca livre por name/phone/email
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    }
    if (city) query = query.ilike("city", `%${city}%`);
    if (stateParam) query = query.ilike("state", `%${stateParam}%`);

    const { data, error, count } = await query.range(
      offset,
      offset + Math.max(0, limit - 1)
    );
    if (error) {
      console.error("customers select error:", error);
      return res.status(500).json({ error: error.message || "customers select failed" });
    }

    // 4) map enxuto
    const items = (data ?? []).map((r: any) => ({
      id: r.id as string,
      name: r.name ?? null,
      phone: r.phone ?? null,
      email: r.email ?? null,
      city: r.city ?? null,
      state: r.state ?? null,
      address: r.address ?? null,
      zip_code: r.zip_code ?? null,
      cpf_cnpj: r.cpf_cnpj ?? null,
      birth_date: r.birth_date ?? null,
      lead_id: r.lead_id ?? null,
      updated_at: r.updated_at ?? null,
    }));

    return res.json({ items, total: count ?? 0 });
  } catch (e: any) {
    console.error("GET /livechat/contacts fatal:", e);
    return res.status(500).json({ error: e?.message || "contacts list error" });
  }
});

 
 // Get a single contact
 app.get("/livechat/contacts/:id", requireAuth, async (req: any, res) => {
   const { id } = req.params as { id: string };
   const companyId = req.user?.company_id;
   if (!companyId) {
     return res.status(400).json({ error: "Missing company context" });
   }
   
   try {
     const { data, error } = await supabaseAdmin
       .from("customers")
       .select("*")
       .eq("id", id)
       .eq("company_id", companyId)
       .maybeSingle();
     if (!error && data) {
       let assigned_agent: string | null = null;
       let assigned_agent_name: string | null = null;
       let lead_id: string | null = null;
       try {
         // tenta ler assigned_agent (se coluna existir)
         assigned_agent = (data as any).assigned_agent ?? null;
         if (assigned_agent === undefined) {
           const { data: row2 } = await supabaseAdmin
             .from("customers")
             .select("assigned_agent")
             .eq("id", id)
             .maybeSingle();
           assigned_agent = (row2 as any)?.assigned_agent ?? null;
         }
         if (assigned_agent) {
           const { data: u } = await supabaseAdmin
             .from("users")
             .select("id, name, avatar")
             .eq("id", assigned_agent)
             .maybeSingle();
           assigned_agent_name = (u as any)?.name || null;
         }
         // tentar descobrir lead vinculado
         lead_id = (data as any).lead_id || null;
         if (!lead_id) {
           const { data: l } = await supabaseAdmin
             .from("leads")
             .select("id")
             .eq("customer_id", id)
             .maybeSingle();
           lead_id = (l as any)?.id || null;
         }
       } catch { }
       return res.json({
         id: (data as any).id,
         name: (data as any).name || (data as any).title || (data as any).id,
         phone:
           (data as any).phone ||
           (data as any).cellphone ||
           (data as any).celular ||
           (data as any).telefone ||
           null,
         email: (data as any).email || null,
         instagram: (data as any).instagram || null,
         facebook: (data as any).facebook || null,
         twitter: (data as any).twitter || null,
         telegram: (data as any).telegram || null,
         website: (data as any).website || (data as any).site || null,
         notes: (data as any).notes || (data as any).observacoes || null,
         assigned_agent: assigned_agent || null,
         assigned_agent_name,
         lead_id,
       });
     }
   } catch { }
   try {
     const { data, error } = await supabaseAdmin
       .from("customers")
       .select("*")
       .eq("id", id)
       .maybeSingle();
     if (error) return res.status(500).json({ error: error.message });
     if (!data) return res.status(404).json({ error: "Contato nãoo encontrado" });
     let assigned_agent: string | null = null;
     let assigned_agent_name: string | null = null;
     try {
       // tenta ler assigned_agent (se coluna existir)
       assigned_agent = (data as any).assigned_agent ?? null;
       if (assigned_agent === undefined) {
         const { data: row2 } = await supabaseAdmin
           .from("customers")
           .select("assigned_agent")
           .eq("id", id)
           .maybeSingle();
         assigned_agent = (row2 as any)?.assigned_agent ?? null;
       }
       if (assigned_agent) {
         const { data: u } = await supabaseAdmin
           .from("users")
           .select("id, name, avatar")
           .eq("id", assigned_agent)
           .maybeSingle();
         assigned_agent_name = (u as any)?.name || null;
       }
     } catch { }
     return res.json({
       id: (data as any).id,
       name: (data as any).name || (data as any).title || (data as any).id,
       phone:
         (data as any).phone ||
         (data as any).cellphone ||
         (data as any).celular ||
         (data as any).telefone ||
         null,
       email: (data as any).email || null,
       instagram: (data as any).instagram || null,
       facebook: (data as any).facebook || null,
       twitter: (data as any).twitter || null,
       telegram: (data as any).telegram || null,
       website: (data as any).website || (data as any).site || null,
       notes: (data as any).notes || (data as any).observacoes || null,
       assigned_agent: assigned_agent || null,
       assigned_agent_name,
     });
   } catch (e: any) {
     // Fallback final: leads, caso o id seja de lead
     try {
       const { data } = await supabaseAdmin
         .from("leads")
         .select("*")
         .eq("id", id)
         .maybeSingle();
       if (!data)
         return res
           .status(500)
           .json({ error: e?.message || "contact get error" });
       return res.json({
         id: (data as any).id,
         name: (data as any).name || (data as any).title || (data as any).id,
         phone: (data as any).phone || (data as any).cellphone || null,
         email: (data as any).email || null,
         instagram: (data as any).instagram || null,
         facebook: (data as any).facebook || null,
         twitter: (data as any).twitter || null,
         telegram: (data as any).telegram || null,
         website: (data as any).website || (data as any).site || null,
         notes: (data as any).notes || (data as any).observacoes || null,
         assigned_agent: (data as any).assigned_to_id || null,
         assigned_agent_name: null,
       });
     } catch {
       return res.status(500).json({ error: e?.message || "contact get error" });
     }
   }
 });
 
 // Create contact
 app.post("/livechat/contacts", requireAuth, async (req: any, res) => {
   try {
     const authUserId = req.user.id as string;
     const { data: urow, error: errU } = await supabaseAdmin
       .from("users")
       .select("company_id")
       .eq("user_id", authUserId)
       .maybeSingle();
     if (errU) return res.status(500).json({ error: errU.message });
     if (!urow?.company_id)
       return res.status(404).json({ error: "Usu?rio sem company_id" });
 
     const body = req.body || {};
     const payload = {
       company_id: (urow as any).company_id,
       name: body.name ?? null,
       phone: body.phone ?? null,
       email: body.email ?? null,
       instagram: body.instagram ?? null,
       facebook: body.facebook ?? null,
       twitter: body.twitter ?? null,
       telegram: body.telegram ?? null,
       website: body.website ?? null,
       notes: body.notes ?? null,
     } as any;
     try {
       const { data, error } = await supabaseAdmin
         .from("customers")
         .insert([payload])
         .select("id")
         .single();
       if (error) throw error;
       return res.status(201).json({ id: (data as any).id });
     } catch (e) {
       // fallback legacy table with column mapping
       const legacy = {
         company_id: (urow as any).company_id,
         name: body.name ?? null,
         celular: body.phone ?? null,
         telefone: null,
         email: body.email ?? null,
         instagram: body.instagram ?? null,
         facebook: body.facebook ?? null,
         twitter: body.twitter ?? null,
         telegram: body.telegram ?? null,
         site: body.website ?? null,
         observacoes: body.notes ?? null,
       } as any;
       try {
         const { data, error } = await supabaseAdmin
           .from("customers")
           .insert([legacy])
           .select("id")
           .single();
         if (error) throw error;
         return res.status(201).json({ id: (data as any).id });
       } catch (err: any) {
         return res
           .status(500)
           .json({ error: err?.message || "contact create error" });
       }
     }
   } catch (e: any) {
     return res
       .status(500)
       .json({ error: e?.message || "contact create error" });
   }
 });
 
 // Update contact
 app.put("/livechat/contacts/:id", requireAuth, async (req: any, res) => {
   const { id } = req.params as { id: string };
   const companyId = req.user?.company_id;
   if (!companyId) {
     return res.status(400).json({ error: "Missing company context" });
   }
   
   const body = req.body || {};
   const payload = {
     name: body.name ?? undefined,
     phone: body.phone ?? undefined,
     email: body.email ?? undefined,
     instagram: body.instagram ?? undefined,
     facebook: body.facebook ?? undefined,
     twitter: body.twitter ?? undefined,
     telegram: body.telegram ?? undefined,
     website: body.website ?? undefined,
     notes: body.notes ?? undefined,
   } as any;
   try {
     const { data, error } = await supabaseAdmin
       .from("customers")
       .update(payload)
       .eq("id", id)
       .eq("company_id", companyId)
       .select("id")
       .maybeSingle();
     if (!error) return res.json({ id: (data as any)?.id ?? id });
   } catch { }
   try {
     const legacy = {
       name: body.name ?? undefined,
       celular: body.phone ?? undefined,
       email: body.email ?? undefined,
       instagram: body.instagram ?? undefined,
       facebook: body.facebook ?? undefined,
       twitter: body.twitter ?? undefined,
       telegram: body.telegram ?? undefined,
       site: body.website ?? undefined,
       observacoes: body.notes ?? undefined,
     } as any;
     const { data, error } = await supabaseAdmin
       .from("customers")
       .update(legacy)
       .eq("id", id)
       .eq("company_id", companyId)
       .select("id")
       .maybeSingle();
     if (error) return res.status(500).json({ error: error.message });
     return res.json({ id: (data as any)?.id ?? id });
   } catch (e: any) {
     return res
       .status(500)
       .json({ error: e?.message || "contact update error" });
   }
 });
}

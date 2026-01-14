import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { ContactSchema, ContactUpdateSchema } from "../schemas/contact.schema.js";
import { NotificationService } from "../services/notification.service.js";
import { getBoardIdForCompany, ensureLeadCustomerChat } from "../services/meta/store.service.js";
import { QueueController } from "../controllers/queue.controller.js";

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
 app.post("/livechat/contacts", requireAuth, async (req: any, res, next) => {
   try {
     const authUserId = req.user.id as string;
     const { data: urow, error: errU } = await supabaseAdmin
       .from("users")
       .select("company_id")
       .eq("user_id", authUserId)
       .maybeSingle();
     if (errU) return res.status(500).json({ error: errU.message });
     if (!urow?.company_id)
       return res.status(404).json({ error: "Usuário sem company_id" });
 
     const body = ContactSchema.parse(req.body);
     const payload = {
       company_id: (urow as any).company_id,
       name: body.name,
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

       const customerId = (data as any).id;

       // 💡 Criar Lead vinculado (Essencial para o funcionamento do sistema conforme feedback)
       let leadId = null;
       try {
         const boardId = await getBoardIdForCompany((urow as any).company_id);
         const { data: leadData } = await supabaseAdmin
           .from("leads")
           .insert([{
             company_id: (urow as any).company_id,
             customer_id: customerId,
             name: body.name,
             phone: body.phone ?? null,
             email: body.email ?? null,
             kanban_board_id: boardId,
             statusClient: "Ativo"
           }])
           .select("id")
           .single();
         leadId = (leadData as any)?.id;

         if (leadId) {
           await supabaseAdmin
             .from("customers")
             .update({ lead_id: leadId })
             .eq("id", customerId);
         }
       } catch (leadErr: any) {
         logger.warn("[contacts:create] lead creation failed", { error: leadErr.message });
       }

       // 🔔 Notificar novo cliente cadastrado
       try {
         await NotificationService.create({
           title: "👤 Novo Cliente Cadastrado",
           message: `${body.name}${body.phone ? ` - ${body.phone}` : ""}`,
           type: "NEW_CUSTOMER",
           userId: authUserId,
           companyId: (urow as any).company_id,
           data: { contactId: customerId, leadId },
           actionUrl: `/livechat/contacts/${customerId}`,
         });
       } catch (notifErr) {
         logger.warn("[contacts:create] notification failed", { error: (notifErr as any).message });
       }

       return res.status(201).json({ id: customerId, lead_id: leadId });
     } catch (e: any) {
       logger.error("[contacts:create] primary insert failed, trying legacy", { error: e.message });
       // fallback legacy table with column mapping
       const legacy = {
         company_id: (urow as any).company_id,
         name: body.name,
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

         const customerIdLegacy = (data as any).id;

         // 💡 Criar Lead vinculado (Legacy path)
         let leadIdLegacy = null;
         try {
           const boardId = await getBoardIdForCompany((urow as any).company_id);
           const { data: leadData } = await supabaseAdmin
             .from("leads")
             .insert([{
               company_id: (urow as any).company_id,
               customer_id: customerIdLegacy,
               name: body.name,
               phone: body.phone ?? null,
               email: body.email ?? null,
               kanban_board_id: boardId,
               statusClient: "Ativo"
             }])
             .select("id")
             .single();
           leadIdLegacy = (leadData as any)?.id;

           if (leadIdLegacy) {
             await supabaseAdmin
               .from("customers")
               .update({ lead_id: leadIdLegacy })
               .eq("id", customerIdLegacy);
           }
         } catch (leadErr: any) {
           logger.warn("[contacts:create:legacy] lead creation failed", { error: leadErr.message });
         }

         // 🔔 Notificar novo cliente cadastrado (legacy)
         try {
           await NotificationService.create({
             title: "👤 Novo Cliente Cadastrado",
             message: `${body.name}${body.phone ? ` - ${body.phone}` : ""}`,
             type: "NEW_CUSTOMER",
             userId: authUserId,
             companyId: (urow as any).company_id,
             data: { contactId: customerIdLegacy, leadId: leadIdLegacy },
             actionUrl: `/livechat/contacts/${customerIdLegacy}`,
           });
         } catch (notifErr) {
           logger.warn("[contacts:create:legacy] notification failed", { error: (notifErr as any).message });
         }

         return res.status(201).json({ id: customerIdLegacy, lead_id: leadIdLegacy });
       } catch (err: any) {
         logger.error("[contacts:create] fatal", { error: err.message });
         next(err);
       }
     }
   } catch (e: any) {
     next(e);
   }
 });
 
 // Update contact
 app.put("/livechat/contacts/:id", requireAuth, async (req: any, res, next) => {
   const { id } = req.params as { id: string };
   const companyId = req.user?.company_id;
   if (!companyId) {
     return res.status(400).json({ error: "Missing company context" });
   }
   
   try {
     const body = ContactUpdateSchema.parse(req.body);
     const payload = {
       name: body.name,
       phone: body.phone,
       email: body.email,
       instagram: body.instagram,
       facebook: body.facebook,
       twitter: body.twitter,
       telegram: body.telegram,
       website: body.website,
       notes: body.notes,
     } as any;
     
     const { data, error } = await supabaseAdmin
       .from("customers")
       .update(payload)
       .eq("id", id)
       .eq("company_id", companyId)
       .select("id")
       .maybeSingle();
       
     if (!error) return res.json({ id: (data as any)?.id ?? id });
     
     // fallback legacy table with column mapping
     const legacy = {
       name: body.name,
       celular: body.phone,
       email: body.email,
       instagram: body.instagram,
       facebook: body.facebook,
       twitter: body.twitter,
       telegram: body.telegram,
       site: body.website,
       observacoes: body.notes,
     } as any;
     
     const { data: dataLegacy, error: errorLegacy } = await supabaseAdmin
       .from("customers")
       .update(legacy)
       .eq("id", id)
       .eq("company_id", companyId)
       .select("id")
       .maybeSingle();
       
     if (errorLegacy) throw errorLegacy;
     return res.json({ id: (dataLegacy as any)?.id ?? id });
   } catch (e: any) {
     logger.error("[contacts:update] fatal", { error: e.message, id });
     next(e);
   }
 });

 // ===== Start Chat from Contact =====
 // Esta rota é chamada pelo CRM para iniciar uma conversa ativa de forma síncrona
 app.post("/livechat/contacts/:id/start-chat", requireAuth, async (req: any, res, next) => {
   const { id } = req.params;
   const { inboxId } = req.body;
   const companyId = req.user?.company_id;

   if (!inboxId || inboxId === "null") {
     return res.status(400).json({ error: "inboxId é obrigatório e deve ser válido" });
   }

   try {
     // 1. Localizar o contato
     const { data: contactData, error: contactError } = await supabaseAdmin
       .from("customers")
       .select("id, phone, name, lead_id")
       .eq("id", id)
       .eq("company_id", companyId)
       .maybeSingle();

     if (contactError) throw contactError;
     if (!contactData) return res.status(404).json({ error: "Contato não encontrado" });
     if (!contactData.phone) return res.status(400).json({ error: "Contato não possui telefone cadastrado" });

     // 2. Usar o serviço robusto para garantir que tudo (Chat, Lead, Customer) está sincronizado
     // O ensureLeadCustomerChat já lida com a criação de lead se não existir
     const result = await ensureLeadCustomerChat({
       inboxId,
       companyId,
       phone: contactData.phone,
       name: contactData.name,
     });

     // Se o contactData.lead_id estiver vazio, aproveitamos para atualizar agora
     if (!contactData.lead_id && result.leadId) {
        await supabaseAdmin.from("customers").update({ lead_id: result.leadId }).eq("id", id);
     }

     // 3. Retornar o ID do chat para o frontend redirecionar imediatamente
     return res.json({ id: result.chatId });

   } catch (e: any) {
     logger.error("[contacts:start-chat] fatal", { error: e.message, id });
     next(e);
   }
 });
}

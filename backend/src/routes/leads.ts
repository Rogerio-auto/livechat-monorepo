import express, { Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { NotificationService } from "../services/notification.service.js";
import { getBoardIdForCompany } from "../services/meta/store.service.js";
import type { Lead, CreateLeadDTO, UpdateLeadDTO, AuthRequest } from "../types/index.js";

interface LeadForm {
  tipoPessoa?: string; cpf?: string; nome?: string; rg?: string; orgao?: string;
  dataNascimento?: string; mae?: string; pai?: string; sexo?: string; naturalidade?: string;
  estadoCivil?: string; conjuge?: string; cep?: string; rua?: string; numero?: string;
  complemento?: string; bairro?: string; uf?: string; cidade?: string; celular?: string;
  celularAlternativo?: string; telefone?: string; telefoneAlternativo?: string; email?: string;
  site?: string; observacoes?: string; status?: string; etapa?: string; kanban_column_id?: string;
  customer_id?: string; chat_id?: string; kanban_board_id?: string;
}

export function mapLead(form: LeadForm): Partial<Lead> {
  const mapped: any = {
    cpf: form.cpf ?? null,
    name: form.nome ?? null,
    rg: form.rg ?? null,
    rgOrgao: form.orgao ?? null,
    birthDate: form.dataNascimento ? new Date(form.dataNascimento).toISOString() : null,
    mother: form.mae ?? null,
    father: form.pai ?? null,
    gender: form.sexo ?? null,
    birthPlace: form.naturalidade ?? null,
    maritalStatus: form.estadoCivil ?? null,
    spouse: form.conjuge ?? null,
    cep: form.cep ?? null,
    street: form.rua ?? null,
    number: form.numero ?? null,
    complement: form.complemento ?? null,
    neighborhood: form.bairro ?? null,
    state: form.uf ?? null,
    city: form.cidade ?? null,
    cellphone: form.celular ?? null,
    altCellphone: form.celularAlternativo ?? null,
    telephone: form.telefone ?? null,
    altTelephone: form.telefoneAlternativo ?? null,
    email: form.email ?? null,
    site: form.site ?? null,
    notes: form.observacoes ?? null,
    statusClient: form.status ?? "Ativo",
    kanban_column_id: (form.kanban_column_id || form.etapa) ?? null,
    customer_id: form.customer_id ?? null,
    kanban_board_id: form.kanban_board_id ?? null,
  };
  
  // personType e phone são obrigatórios apenas no CREATE, não no UPDATE
  if (form.tipoPessoa !== undefined) {
    mapped.personType = form.tipoPessoa ?? null;
  }
  
  // Garantir que 'phone' seja preenchido (é NOT NULL no banco)
  // Prioridade: telefone > celular
  const phoneValue = form.telefone || form.celular;
  if (phoneValue !== undefined) {
    mapped.phone = phoneValue;
    mapped.msisdn = phoneValue; // Sincronizar msisdn também
  }
  
  return mapped;
}

import { Request, Response } from "express";

interface AuthRequest extends Request {
  user: {
    id: string;
    email?: string;
    company_id: string;
    role?: string;
  };
}

export function registerLeadRoutes(app: express.Application) {
  // Check phone existence
  app.get("/leads/check-phone/:phone", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { phone } = req.params;
      const companyId = req.user?.company_id;
      if (!companyId) return res.status(400).json({ error: "Missing company context" });

      // 1. Verificar na tabela leads
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();

      if (lead) {
        return res.json({ exists: true, type: 'lead', name: lead.name });
      }

      // 2. Verificar na tabela customers
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("phone", phone)
        .maybeSingle();

      if (customer) {
        return res.json({ exists: true, type: 'customer', name: customer.name });
      }

      return res.json({ exists: false });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // List
  app.get("/leads", requireAuth, async (req: AuthRequest, res: Response) => {
    const companyId = req.user?.company_id;
    console.log('[GET /leads] \u{1F50D} Request from user:', {
      userId: req.user?.id,
      email: req.user?.email,
      companyId: companyId,
    });
    
    if (!companyId) {
      console.log('[GET /leads] \u274C Missing company_id');
      return res.status(400).json({ error: "Missing company context" });
    }
    
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    
    console.log('[GET /leads] \u{1F4CA} Query result:', {
      companyId,
      count: data?.length || 0,
      error: error?.message,
    });
    
    if (error) return res.status(500).json({ error: error.message });
    const mapped = (data ?? []).map((r: Lead) => ({
      id: r.id,
      nome: r.name,
      name: r.name,
      cpf: r.cpf,
      email: r.email,
      status: (r.statusClient ?? (r as any).status_client ?? "Ativo").toLowerCase(),
      kanban_column_id: r.kanban_column_id,
      tipoPessoa: r.personType ?? (r as any).person_type,
      rg: r.rg,
      orgao: r.rgOrgao ?? (r as any).rg_orgao,
      dataNascimento: r.birthDate ?? (r as any).birth_date,
      mae: r.mother,
      pai: r.father,
      sexo: r.gender,
      naturalidade: r.birthPlace ?? (r as any).birth_place,
      estadoCivil: r.maritalStatus ?? (r as any).marital_status,
      conjuge: r.spouse,
      cep: r.cep,
      rua: r.street,
      numero: r.number,
      complemento: r.complement,
      bairro: r.neighborhood,
      uf: r.state,
      cidade: r.city,
      celular: r.cellphone,
      celularAlternativo: r.altCellphone ?? (r as any).alt_cellphone,
      telefone: r.telephone,
      telefoneAlternativo: r.altTelephone ?? (r as any).alt_telephone,
      site: r.site,
      observacoes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return res.json(mapped);
  });

  // Statistics endpoint
  app.get("/api/leads/stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "Missing company context" });
      }
      
      // Get all leads for this company
      const { data: allLeads, error: leadsError } = await supabaseAdmin
        .from("leads")
        .select('id, "statusClient", status_client, created_at, kanban_column_id, customer_id')
        .eq("company_id", companyId);
      
      if (leadsError) throw leadsError;

      const leads = (allLeads || []) as Lead[];
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Calculate basic metrics
      const total = leads.length;
      const active = leads.filter((l: Lead) => {
        const status = (l.statusClient || (l as any).status_client || "").toLowerCase();
        return status === "ativo";
      }).length;
      const inactive = total - active;

      const newThisMonth = leads.filter((l: Lead) => 
        new Date(l.created_at) >= firstDayThisMonth
      ).length;
      const newLastMonth = leads.filter((l: Lead) => {
        const created = new Date(l.created_at);
        return created >= firstDayLastMonth && created <= lastDayLastMonth;
      }).length;

      // Distribution by kanban stage
      const byStage: Record<string, number> = {};
      const stageIds = [...new Set(leads.map((l: Lead) => l.kanban_column_id).filter((id): id is string => !!id))];
      
      // Get stage names
      const { data: columns } = await supabaseAdmin
        .from("kanban_columns")
        .select("id, name, title")
        .in("id", stageIds);

      const stageMap = new Map((columns || []).map((c: any) => [c.id, c.name || c.title || "Sem tÃtulo"]));

      for (const lead of leads) {
        if (lead.kanban_column_id) {
          const stageName = stageMap.get(lead.kanban_column_id) || "Outros";
          byStage[stageName] = (byStage[stageName] || 0) + 1;
        } else {
          byStage["Sem etapa"] = (byStage["Sem etapa"] || 0) + 1;
        }
      }

      // Count leads with proposals
      const leadIds = leads.map((l: Lead) => l.id);
      const { data: proposals } = await supabaseAdmin
        .from("proposals")
        .select("lead_id, total_value")
        .in("lead_id", leadIds);

      const leadsWithProposals = new Set((proposals || []).map((p: any) => p.lead_id)).size;
      const conversionRate = total > 0 ? leadsWithProposals / total : 0;
      
      const totalValue = (proposals || []).reduce((sum: number, p: any) => sum + (Number(p.total_value) || 0), 0);
      const avgTicket = leadsWithProposals > 0 ? totalValue / leadsWithProposals : 0;

      return res.json({
        total,
        active,
        inactive,
        newThisMonth,
        newLastMonth,
        byStage,
        withProposals: leadsWithProposals,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgTicket: Math.round(avgTicket * 100) / 100,
      });
    } catch (error: any) {
      console.error("[leads/stats] Error:", error);
      return res.status(500).json({ error: error.message || "Failed to get stats" });
    }
  });

  // Minimal by id (for receipts)
  app.get("/leads/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "Missing company context" });
      }
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select(`
          id, name, email, phone, 
          cpf, rg, rgOrgao, rgEmissao, mother, father, gender, birthPlace, birthDate,
          maritalStatus, spouse, personType,
          city, state, street, number, complement, neighborhood, cep,
          cellphone, altCellphone, telephone, altTelephone,
          facebook, instagram, twitter, website, site,
          notes, observacao, source, priority, status_client, statusClient,
          company_id, customer_id, assigned_to_id,
          created_at, updated_at
        `)
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Lead não encontrado" });
      return res.json(data as Lead);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "leads get error" });
    }
  });

  // Minimal by customer
  app.get("/leads/by-customer/:customerId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { customerId } = req.params as { customerId: string };
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "Missing company context" });
      }
      
      const selectColumns =
        "id, name, email, phone, cpf, rg, city, state, customer_id, kanban_column_id";
      const { data: leadByCustomer, error: leadByCustomerErr } = await supabaseAdmin
        .from("leads")
        .select(selectColumns)
        .eq("customer_id", customerId)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leadByCustomerErr) return res.status(500).json({ error: leadByCustomerErr.message });
      if (leadByCustomer) return res.json(leadByCustomer as Lead);

      const { data: leadById, error: leadByIdErr } = await supabaseAdmin
        .from("leads")
        .select(selectColumns)
        .eq("id", customerId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (leadByIdErr) return res.status(500).json({ error: leadByIdErr.message });
      if (leadById) return res.json(leadById as Lead);

      const { data: customer, error: customerErr } = await supabaseAdmin
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", customerId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (customerErr) return res.status(500).json({ error: customerErr.message });
      if (customer) {
        return res.json({
          id: customer.id,
          customer_id: customer.id,
          name: customer.name ?? "",
          email: customer.email || null,
          phone: customer.phone || null,
        } as Partial<Lead>);
      }
      return res.json(null);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "leads by customer error" });
    }
  });

  // Create lead
  app.post("/leads", requireAuth, async (req: AuthRequest, res: Response) => {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company context" });
    }
    
    const payload = mapLead(req.body as LeadForm);
    if (!payload.name) return res.status(400).json({ error: "Campo 'nome' Ã© obrigatÃ³rio" });
    
    // Garantir que o lead pertence Ã  empresa do usuÃ¡rio
    payload.company_id = companyId;
    
    // Garantir que o lead tenha um kanban_board_id (NOT NULL no banco)
    if (!payload.kanban_board_id) {
      try {
        payload.kanban_board_id = await getBoardIdForCompany(companyId);
      } catch (boardErr) {
        console.error("[POST /leads] Failed to get default board:", boardErr);
      }
    }

    // Verificar duplicidade antes de inserir
    if (payload.phone) {
      // 1. Verificar na tabela leads
      const { data: leadExists } = await supabaseAdmin
        .from("leads")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", payload.phone)
        .maybeSingle();

      if (leadExists) {
        return res.status(400).json({ error: "JÃ¡ existe um lead cadastrado com este nÃºmero de telefone." });
      }

      // 2. Verificar na tabela customers
      const { data: customerExists } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("company_id", companyId)
        .eq("phone", payload.phone)
        .maybeSingle();

      if (customerExists) {
        return res.status(400).json({ error: "JÃ¡ existe um cliente cadastrado com este nÃºmero de telefone." });
      }
    }
    
    // Tentar inserir o lead
    const { data, error } = await supabaseAdmin.from("leads").insert([payload]).select("*").single();
    
    if (error) {
      console.error("[POST /leads] Insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    const lead = data as Lead;

    // 🔔 Enviar notificaÃ§Ã£o de novo lead
    try {
      await NotificationService.create({
        title: "🎯 Novo Lead Capturado",
        message: `${lead.name}${lead.phone ? ` - ${lead.phone}` : ""}`,
        type: "NEW_LEAD",
        userId: req.user.id,
        companyId: companyId,
        data: { leadId: lead.id, leadName: lead.name, leadPhone: lead.phone },
        actionUrl: `/dashboard/leads/${lead.id}`,
      });
      console.log("[POST /leads] 🔔 NotificaÃ§Ã£o NEW_LEAD enviada");
    } catch (notifError) {
      console.warn("[POST /leads] ⚠️ Erro ao enviar notificaÃ§Ã£o:", notifError);
    }

    return res.status(201).json(lead);
  });

  // Update lead
  app.put("/leads/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company context" });
    }
    
    console.log("[PUT /leads/:id] Received payload:", JSON.stringify(req.body, null, 2));
    
    const payload = mapLead(req.body as LeadForm);
    
    console.log("[PUT /leads/:id] Mapped payload:", JSON.stringify(payload, null, 2));
    
    // Atualizar lead
    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();
      
    if (error) {
      console.error("[PUT /leads/:id] Update error:", error);
      return res.status(500).json({ error: error.message });
    }
    
    const lead = data as Lead;
    console.log("[PUT /leads/:id] Updated successfully:", { id, name: lead?.name });
    
    // Se o lead tem customer_id, atualizar tambÃ©m a tabela customers
    // (excluindo phone, msisdn e lid conforme solicitado)
    if (lead?.customer_id) {
      const customerPayload: any = {};
      
      // Dados gerais permitidos
      if (payload.name) customerPayload.name = payload.name;
      if (payload.email !== undefined) customerPayload.email = payload.email;
      if (payload.cpf !== undefined) customerPayload.cpf_cnpj = payload.cpf;
      if (payload.birthDate !== undefined) customerPayload.birth_date = payload.birthDate;
      
      // EndereÃ§o
      const addressParts = [
        payload.street,
        payload.number,
        payload.complement,
        payload.neighborhood,
      ].filter(Boolean);
      if (addressParts.length > 0) {
        customerPayload.address = addressParts.join(", ");
      }
      if (payload.city !== undefined) customerPayload.city = payload.city;
      if (payload.state !== undefined) customerPayload.state = payload.state;
      if (payload.cep !== undefined) customerPayload.zip_code = payload.cep;
      
      // Atualizar customer se tiver algum dado
      if (Object.keys(customerPayload).length > 0) {
        const { error: custError } = await supabaseAdmin
          .from("customers")
          .update(customerPayload)
          .eq("id", lead.customer_id)
          .eq("company_id", companyId);
          
        if (custError) {
          console.error("[leads/:id PUT] Failed to sync customer:", custError);
          // NÃ£o retorna erro, apenas loga
        }
      }
    }
    
    return res.json(lead);
  });

  // Delete lead
  app.delete("/leads/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    const { id } = req.params as { id: string };
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company context" });
    }
    
    const { error } = await supabaseAdmin
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  });

  // ==========================================
  // CUSTOMERS ROUTES
  // ==========================================

  // Get customer by ID (busca na tabela leads pelo customer_id)
  app.get("/customers/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const companyId = req.user?.company_id;
      if (!companyId) {
        return res.status(400).json({ error: "Missing company context" });
      }
      
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select(`
          id, name, email, phone, 
          cpf, rg, rgOrgao, rgEmissao, mother, father, gender, birthPlace, birthDate,
          maritalStatus, spouse, personType,
          city, state, street, number, complement, neighborhood, cep,
          cellphone, altCellphone, telephone, altTelephone,
          facebook, instagram, twitter, website, site,
          notes, observacao, source, priority, status_client, statusClient,
          company_id, customer_id, assigned_to_id,
          created_at, updated_at
        `)
        .eq("customer_id", id)
        .eq("company_id", companyId)
        .limit(1);
      
      if (error) {
        console.error("[customers/:id] Error:", error);
        return res.status(500).json({ error: error.message });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Cliente nÃ£o encontrado" });
      }
      
      return res.json(data[0] as Lead);
    } catch (e: any) {
      console.error("[customers/:id] Exception:", e);
      return res.status(500).json({ error: e?.message || "customers get error" });
    }
  });
}

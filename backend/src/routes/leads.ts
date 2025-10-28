import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

type LeadForm = {
  tipoPessoa?: string; cpf?: string; nome?: string; rg?: string; orgao?: string;
  dataNascimento?: string; mae?: string; pai?: string; sexo?: string; naturalidade?: string;
  estadoCivil?: string; conjuge?: string; cep?: string; rua?: string; numero?: string;
  complemento?: string; bairro?: string; uf?: string; cidade?: string; celular?: string;
  celularAlternativo?: string; telefone?: string; telefoneAlternativo?: string; email?: string;
  site?: string; observacoes?: string; status?: string; etapa?: string; kanban_column_id?: string;
};

export function mapLead(form: LeadForm) {
  return {
    personType: form.tipoPessoa ?? null,
    phone: form.telefone,
    cpf: form.cpf ?? null,
    name: form.nome,
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
  } as any;
}

export function registerLeadRoutes(app: express.Application) {
  // List
  app.get("/leads", requireAuth, async (_req, res) => {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      cpf: r.cpf,
      email: r.email,
      status: r.status_client ?? r.status,
      kanban_column_id: r.kanban_column_id,
      tipoPessoa: r.person_type,
      rg: r.rg,
      orgao: r.rg_orgao,
      dataNascimento: r.birth_date,
      mae: r.mother,
      pai: r.father,
      sexo: r.gender,
      naturalidade: r.birth_place,
      estadoCivil: r.marital_status,
      conjuge: r.spouse,
      cep: r.cep,
      rua: r.street,
      numero: r.number,
      complemento: r.complement,
      bairro: r.neighborhood,
      uf: r.state,
      cidade: r.city,
      celular: r.cellphone,
      celularAlternativo: r.alt_cellphone,
      telefone: r.telephone,
      telefoneAlternativo: r.alt_telephone,
      site: r.site,
      observacoes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return res.json(mapped);
  });

  // Minimal by id (for receipts)
  app.get("/leads/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params as { id: string };
      const { data, error } = await supabaseAdmin
        .from("leads")
        .select("id, name, email, phone, cpf, rg, city, state")
        .eq("id", id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Lead não encontrado" });
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "leads get error" });
    }
  });

  // Minimal by customer
  app.get("/leads/by-customer/:customerId", requireAuth, async (req: any, res) => {
    try {
      const { customerId } = req.params as { customerId: string };
      const selectColumns =
        "id, name, email, phone, cpf, rg, city, state, customer_id, kanban_column_id";
      const { data: leadByCustomer, error: leadByCustomerErr } = await supabaseAdmin
        .from("leads")
        .select(selectColumns)
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (leadByCustomerErr) return res.status(500).json({ error: leadByCustomerErr.message });
      if (leadByCustomer) return res.json(leadByCustomer);

      const { data: leadById, error: leadByIdErr } = await supabaseAdmin
        .from("leads")
        .select(selectColumns)
        .eq("id", customerId)
        .maybeSingle();
      if (leadByIdErr) return res.status(500).json({ error: leadByIdErr.message });
      if (leadById) return res.json(leadById);

      const { data: customer, error: customerErr } = await supabaseAdmin
        .from("customers")
        .select("id, name, email, phone")
        .eq("id", customerId)
        .maybeSingle();
      if (customerErr) return res.status(500).json({ error: customerErr.message });
      if (customer) {
        return res.json({
          id: customer.id,
          customer_id: customer.id,
          name: (customer as any).name,
          email: (customer as any).email || null,
          phone: (customer as any).phone || null,
        });
      }
      return res.json(null);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "leads by customer error" });
    }
  });

  // Create lead
  app.post("/leads", requireAuth, async (req, res) => {
    const payload = mapLead(req.body);
    if (!payload.name) return res.status(400).json({ error: "Campo 'nome' é obrigatório" });
    await supabaseAdmin.from("leads").insert([payload]).select("*").single().then(({ data, error }) => {
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    });
  });

  // Update lead
  app.put("/leads/:id", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const payload = mapLead(req.body);
    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  // Delete lead
  app.delete("/leads/:id", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  });
}

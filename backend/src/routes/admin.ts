import type { Application, Response, NextFunction } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { AuthRequest } from "../types/express.js";
import { getSubscription, updateSubscriptionOverrides, updateSubscriptionStatus, extendSubscription } from "../services/subscriptions.service.js";

// Middleware para verificar se é ADMIN
const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // O role está em req.profile.role, não em req.user.role
    const role = String(req.profile?.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Erro ao verificar permissões" });
  }
};

// Configurações padrão por nicho (copiado de onboarding.ts)
const INDUSTRY_CONFIG = {
  education: {
    agent_name: "Assistente Acadêmico",
    agent_instructions: "Você é um assistente acadêmico. Ajude com informações sobre cursos, matrículas, agendamento de aulas experimentais e tire dúvidas sobre modalidades de ensino.",
    custom_fields: [
      { key: "curso_interesse", label: "Curso de Interesse", type: "text" },
      { key: "modalidade", label: "Modalidade Preferida", type: "select", options: ["Presencial", "Online", "Híbrido"] },
      { key: "turno", label: "Turno Desejado", type: "select", options: ["Manhã", "Tarde", "Noite"] },
    ],
    templates: ["confirmacao_matricula", "lembrete_aula", "aula_experimental"],
    enabled_modules: ["calendar", "catalog", "scheduling"],
  },
  accounting: {
    agent_name: "Assistente Contábil",
    agent_instructions: "Você é um assistente contábil. Ajude clientes com dúvidas sobre serviços contábeis, prazos fiscais, documentação necessária e agendamento de consultorias.",
    custom_fields: [
      { key: "tipo_empresa", label: "Tipo de Empresa", type: "select", options: ["MEI", "ME", "EPP", "Ltda", "SA"] },
      { key: "regime_tributario", label: "Regime Tributário", type: "select", options: ["Simples Nacional", "Lucro Presumido", "Lucro Real"] },
      { key: "servico_interesse", label: "Serviço de Interesse", type: "text" },
    ],
    templates: ["solicitacao_documentos", "prazo_fiscal", "consultoria_agendada"],
    enabled_modules: ["documents", "calendar", "catalog"],
  },
  clinic: {
    agent_name: "Recepcionista Virtual",
    agent_instructions: "Você é uma recepcionista virtual de clínica. Ajude pacientes a agendar consultas, confirmar horários, esclarecer sobre especialidades e enviar lembretes.",
    custom_fields: [
      { key: "especialidade", label: "Especialidade Procurada", type: "text" },
      { key: "convenio", label: "Convênio Médico", type: "select", options: ["Particular", "Unimed", "Bradesco Saúde", "Amil", "SulAmérica", "Outros"] },
      { key: "horario_preferencial", label: "Horário Preferencial", type: "select", options: ["Manhã", "Tarde", "Noite"] },
    ],
    templates: ["confirmacao_consulta", "lembrete_consulta", "pos_consulta"],
    enabled_modules: ["calendar", "scheduling", "reminders"],
  },
  solar_energy: {
    agent_name: "Consultor Solar",
    agent_instructions: "Você é um consultor de energia solar. Ajude clientes com informações sobre sistemas fotovoltaicos, cálculos de economia, financiamento e geração de propostas técnicas.",
    custom_fields: [
      { key: "consumo_medio_kwh", label: "Consumo Médio (kWh/mês)", type: "number" },
      { key: "valor_conta_luz", label: "Valor Médio da Conta", type: "text" },
      { key: "tipo_instalacao", label: "Tipo de Instalação", type: "select", options: ["Residencial", "Comercial", "Industrial", "Rural"] },
      { key: "financiamento", label: "Interesse em Financiamento", type: "select", options: ["Sim", "Não", "Talvez"] },
    ],
    templates: ["proposta_solar", "simulacao_economia", "contrato_instalacao"],
    enabled_modules: ["quotes", "documents", "catalog"],
  },
  construction: {
    agent_name: "Assistente de Obras",
    agent_instructions: "Você é um assistente de construção civil. Ajude com orçamentos de obras, cronogramas, especificações técnicas e acompanhamento de projetos.",
    custom_fields: [
      { key: "tipo_obra", label: "Tipo de Obra", type: "select", options: ["Residencial", "Comercial", "Industrial", "Reforma", "Acabamento"] },
      { key: "area_construcao", label: "Área (m²)", type: "number" },
      { key: "prazo_estimado", label: "Prazo Estimado", type: "select", options: ["Até 3 meses", "3-6 meses", "6-12 meses", "Acima de 1 ano"] },
      { key: "orcamento", label: "Orçamento Aproximado", type: "text" },
    ],
    templates: ["orcamento_obra", "cronograma", "contrato_empreitada"],
    enabled_modules: ["quotes", "documents", "calendar"],
  },
  real_estate: {
    agent_name: "Corretor Virtual",
    agent_instructions: "Você é um corretor imobiliário virtual. Ajude clientes a encontrar imóveis, agendar visitas, esclarecer sobre financiamento e documentação necessária.",
    custom_fields: [
      { key: "tipo_imovel", label: "Tipo de Imóvel", type: "select", options: ["Apartamento", "Casa", "Terreno", "Comercial", "Rural"] },
      { key: "finalidade", label: "Finalidade", type: "select", options: ["Compra", "Aluguel", "Venda"] },
      { key: "faixa_preco", label: "Faixa de Preço", type: "select", options: ["Até R$ 200k", "R$ 200k-500k", "R$ 500k-1M", "Acima de R$ 1M"] },
      { key: "bairro_preferencia", label: "Bairro/Região de Interesse", type: "text" },
    ],
    templates: ["proposta_imovel", "contrato_locacao", "contrato_compra_venda"],
    enabled_modules: ["catalog", "calendar", "documents"],
  },
  events: {
    agent_name: "Consultor de Eventos",
    agent_instructions: "Você é um consultor de eventos. Ajude clientes a escolher pacotes, calcular orçamentos, agendar visitas e esclarecer sobre serviços disponíveis.",
    custom_fields: [
      { key: "tipo_evento", label: "Tipo de Evento", type: "select", options: ["Casamento", "Aniversário", "Corporativo", "Formatura", "Outros"] },
      { key: "data_pretendida", label: "Data Pretendida", type: "date" },
      { key: "num_convidados", label: "Número de Convidados", type: "number" },
      { key: "orcamento_estimado", label: "Orçamento Estimado", type: "select", options: ["Até R$ 5.000", "R$ 5.000-15.000", "R$ 15.000-30.000", "Acima de R$ 30.000"] },
    ],
    templates: ["proposta_evento", "checklist_evento", "pos_evento"],
    enabled_modules: ["calendar", "catalog", "quotes"],
  },
  law: {
    agent_name: "Assistente Jurídico",
    agent_instructions: "Você é um assistente jurídico. Ajude clientes com agendamento de consultas, informações sobre áreas de atuação, documentação necessária e acompanhamento de processos.",
    custom_fields: [
      { key: "area_juridica", label: "Área Jurídica de Interesse", type: "select", options: ["Cível", "Trabalhista", "Criminal", "Família", "Empresarial", "Tributário"] },
      { key: "tipo_processo", label: "Tipo de Processo", type: "text" },
      { key: "urgencia", label: "Urgência", type: "select", options: ["Baixa", "Média", "Alta", "Urgente"] },
    ],
    templates: ["agendamento_consulta", "andamento_processo", "documentacao_necessaria"],
    enabled_modules: ["documents", "calendar", "catalog"],
  },
};

const VALID_INDUSTRIES = ["education", "accounting", "clinic", "solar_energy", "construction", "real_estate", "events", "law"];

export function registerAdminRoutes(app: Application) {
  
  // PUT /api/admin/companies/:companyId/industry
  // Editar industry de uma empresa e aplicar configurações automaticamente
  app.put("/api/admin/companies/:companyId/industry", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      const { industry } = req.body;

      console.log(`[ADMIN] =================================`);
      console.log(`[ADMIN] PUT /api/admin/companies/:companyId/industry`);
      console.log(`[ADMIN] Company ID: ${companyId}`);
      console.log(`[ADMIN] Nova industry: ${industry}`);
      console.log(`[ADMIN] User: ${JSON.stringify(req.user)}`);
      console.log(`[ADMIN] Profile: ${JSON.stringify(req.profile)}`);
      console.log(`[ADMIN] =================================`);

      // Validar industry
      if (!industry || !VALID_INDUSTRIES.includes(industry)) {
        console.log(`[ADMIN] ❌ Industry inválida: ${industry}`);
        return res.status(400).json({ 
          error: "Industry inválida", 
          valid: VALID_INDUSTRIES 
        });
      }

      console.log(`[ADMIN] ✅ Industry válida, atualizando...`);

      // Atualizar company (sem updated_at por enquanto)
      const { data, error: updateError } = await supabaseAdmin
        .from("companies")
        .update({ industry })
        .eq("id", companyId)
        .select();

      if (updateError) {
        console.error("[ADMIN] ❌ Erro ao atualizar industry:", updateError);
        return res.status(500).json({ 
          error: "Erro ao atualizar empresa", 
          details: updateError.message 
        });
      }

      console.log(`[ADMIN] ✅ Company atualizada:`, data);

      // Aplicar configurações do nicho
      const config = INDUSTRY_CONFIG[industry as keyof typeof INDUSTRY_CONFIG];
      if (config) {
        console.log(`[ADMIN] Aplicando configurações para ${industry}...`);
        
        const settingsToInsert = [
          {
            company_id: companyId,
            setting_key: "custom_lead_fields",
            setting_value: config.custom_fields,
          },
          {
            company_id: companyId,
            setting_key: "enabled_modules",
            setting_value: config.enabled_modules,
          },
          {
            company_id: companyId,
            setting_key: "industry_config",
            setting_value: { industry, templates: config.templates },
          },
        ];

        const { error: settingsError } = await supabaseAdmin
          .from("company_settings")
          .upsert(settingsToInsert, { onConflict: "company_id,setting_key" });

        if (settingsError) {
          console.error("[ADMIN] Erro ao salvar settings:", settingsError);
        } else {
          console.log(`[ADMIN] ✅ Configurações aplicadas com sucesso`);
        }
      }

      return res.json({ 
        success: true, 
        industry,
        message: `Industry atualizada para ${industry} e configurações aplicadas` 
      });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao editar industry:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/companies/:companyId/apply-industry-config
  // Re-aplicar configurações do nicho (sem alterar a industry)
  app.post("/api/admin/companies/:companyId/apply-industry-config", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;

      console.log(`[ADMIN] Re-aplicando configurações da empresa ${companyId}`);

      // Buscar industry atual da empresa
      const { data: company, error: fetchError } = await supabaseAdmin
        .from("companies")
        .select("industry")
        .eq("id", companyId)
        .single();

      if (fetchError || !company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      const { industry } = company;

      if (!industry || !VALID_INDUSTRIES.includes(industry)) {
        return res.status(400).json({ 
          error: "Empresa não possui industry válida. Configure primeiro." 
        });
      }

      // Aplicar configurações
      const config = INDUSTRY_CONFIG[industry as keyof typeof INDUSTRY_CONFIG];
      if (!config) {
        return res.status(400).json({ error: "Configuração não encontrada para este nicho" });
      }

      console.log(`[ADMIN] Aplicando configurações para ${industry}...`);
      
      const settingsToInsert = [
        {
          company_id: companyId,
          setting_key: "custom_lead_fields",
          setting_value: config.custom_fields,
        },
        {
          company_id: companyId,
          setting_key: "enabled_modules",
          setting_value: config.enabled_modules,
        },
        {
          company_id: companyId,
          setting_key: "industry_config",
          setting_value: { industry, templates: config.templates },
        },
      ];

      const { error: settingsError } = await supabaseAdmin
        .from("company_settings")
        .upsert(settingsToInsert, { onConflict: "company_id,setting_key" });

      if (settingsError) {
        console.error("[ADMIN] Erro ao salvar settings:", settingsError);
        return res.status(500).json({ error: "Erro ao aplicar configurações" });
      }

      console.log(`[ADMIN] ✅ Configurações re-aplicadas com sucesso`);

      return res.json({ 
        success: true,
        industry,
        message: `Configurações do nicho ${industry} aplicadas com sucesso` 
      });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao aplicar configurações:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/admin/companies/:companyId/subscription
  app.get("/api/admin/companies/:companyId/subscription", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      const sub = await getSubscription(companyId);
      
      if (!sub) {
        return res.status(404).json({ error: "Assinatura não encontrada para esta empresa" });
      }

      return res.json(sub);
    } catch (error: any) {
      console.error("[ADMIN] Erro ao buscar assinatura:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/admin/companies/:companyId/subscription/overrides
  app.patch("/api/admin/companies/:companyId/subscription/overrides", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      const { custom_limits, custom_features, notes } = req.body;

      await updateSubscriptionOverrides(companyId, {
        custom_limits,
        custom_features,
        notes
      });

      return res.json({ success: true, message: "Sobrescritas atualizadas com sucesso" });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao atualizar sobrescritas:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/companies/:companyId/subscription/status
  app.post("/api/admin/companies/:companyId/subscription/status", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      const { status } = req.body;

      if (!['active', 'trial', 'past_due', 'canceled', 'expired'].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }

      await updateSubscriptionStatus(companyId, status);
      return res.json({ success: true, message: `Status alterado para ${status}` });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao alterar status da assinatura:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/companies/:companyId/subscription/extend
  app.post("/api/admin/companies/:companyId/subscription/extend", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = req.params;
      const { days } = req.body;

      if (!days || isNaN(days)) {
        return res.status(400).json({ error: "Número de dias inválido" });
      }

      await extendSubscription(companyId, days);
      return res.json({ success: true, message: `Assinatura estendida em ${days} dias` });
    } catch (error: any) {
      console.error("[ADMIN] Erro ao estender assinatura:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}

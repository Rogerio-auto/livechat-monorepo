import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { JWT_COOKIE_NAME, JWT_COOKIE_SECURE, JWT_COOKIE_DOMAIN, FRONTEND_URL } from "../config/env.js";

// Tipos e schemas
const IndustryEnum = z.enum(["education", "accounting", "clinic", "solar_energy", "construction", "real_estate", "events", "law"]);
const TeamSizeEnum = z.enum(["1-5", "6-15", "16-50", "50+"]);

const OnboardingStep1Schema = z.object({
  industry: IndustryEnum,
});

const OnboardingStep2Schema = z.object({
  company_name: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  team_size: z.string().optional(),
  main_challenge: z.string().min(1),
});

const OnboardingStep3Schema = z.object({
  wants_ai_agent: z.boolean().default(true),
  wants_templates: z.boolean().default(true),
  wants_catalog: z.boolean().default(true),
});

// Configurações padrão por nicho
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

// Helper para resolver company_id
async function resolveCompanyId(req: any): Promise<string> {
  console.log("[resolveCompanyId] req.user:", req.user);
  
  // Tentar pegar do req.user (JWT auth) primeiro
  if (req.user?.company_id) {
    console.log("[resolveCompanyId] ✅ Found company_id in req.user:", req.user.company_id);
    return req.user.company_id;
  }

  // Fallback: buscar pelo userId na tabela users
  const userId = req.user?.id;
  if (!userId) {
    console.error("[resolveCompanyId] ❌ User not authenticated - no userId");
    throw new Error("User not authenticated");
  }

  console.log("[resolveCompanyId] 🔍 Buscando company_id na tabela users para userId:", userId);
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  console.log("[resolveCompanyId] Resultado da query:", { data, error });

  if (error || !data?.company_id) {
    console.error("[resolveCompanyId] ❌ Erro ao buscar company_id:", error);
    throw new Error("Missing company context");
  }
  
  console.log("[resolveCompanyId] ✅ Found company_id:", data.company_id);
  return data.company_id;
}

export function registerCadastroRoutes(app: Application) {
  // ROTA ÚNICA: Criar usuário + empresa de uma vez com todos os dados
  app.post("/api/cadastro/signup-complete", async (req: any, res) => {
    try {
      console.log("[signup-complete] Iniciando cadastro completo...");
      const { 
        // Dados do usuário
        name, 
        email, 
        password, 
        phone,
        // Dados da empresa
        company_name,
        cnpj,
        company_phone,
        city,
        state,
        team_size,
        industry, // Opcional: se vier do onboarding
        plan_id // Novo: plano selecionado no cadastro
      } = req.body;
      
      console.log("[signup-complete] Dados recebidos:", { 
        name, email, phone, company_name, cnpj, city, state, team_size, plan_id 
      });

      // ============ VALIDAÇÕES ============
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Nome, email e senha são obrigatórios" });
      }

      if (!company_name || !cnpj) {
        return res.status(400).json({ error: "Nome da empresa e CNPJ são obrigatórios" });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Validar senha (mínimo 6 caracteres)
      if (password.length < 6) {
        return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
      }

      console.log("[signup-complete] ✅ Validações OK");

      // ============ ETAPA 1: CRIAR USUÁRIO NO AUTH ============
      console.log("[signup-complete] 1️⃣ Criando usuário no Supabase Auth...");
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          phone: phone || null,
        },
      });

      if (authError || !authData.user) {
        console.error("[signup-complete] ❌ Erro ao criar usuário no auth:", authError);
        if (authError?.message?.includes("already") || authError?.message?.includes("exists")) {
          return res.status(400).json({ error: "Email já cadastrado" });
        }
        return res.status(500).json({ error: "Erro ao criar usuário", details: authError?.message });
      }

      const authUserId = authData.user.id;
      console.log("[signup-complete] ✅ Usuário criado no auth.users:", authUserId);

      // Mapear plan_id para o ENUM do banco
      const planMap: Record<string, string> = {
        "starter": "STARTER",
        "growth": "GROWTH",
        "professional": "PROFESSIONAL", 
        "business": "BUSINESS"
      };
      const planEnum = planMap[(plan_id || "starter").toLowerCase()] || "STARTER";

      // ============ ETAPA 2: CRIAR EMPRESA ============
      console.log("[signup-complete] 2️⃣ Criando empresa...");
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: company_name,
          cnpj: cnpj || "",
          email,
          phone: company_phone || phone || "",
          city: city || "",
          state: state || "",
          team_size: team_size || null,
          industry: industry || 'solar_energy', // Default para solar_energy
          onboarding_step: 1,
          onboarding_completed: false,
          is_active: true,
          plan: planEnum,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (companyError || !company) {
        console.error("[signup-complete] ❌ Erro ao criar empresa:", companyError);
        // Rollback: deletar usuário do auth
        console.log("[signup-complete] 🔄 Fazendo rollback do auth...");
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        return res.status(500).json({ error: "Erro ao criar empresa", details: companyError?.message });
      }

      console.log("[signup-complete] ✅ Empresa criada:", company.id);

      // ============ ETAPA 3: CRIAR REGISTRO EM PUBLIC.USERS ============
      console.log("[signup-complete] 3️⃣ Criando registro em public.users...");
      const { data: publicUser, error: publicUserError } = await supabaseAdmin
        .from("users")
        .insert({
          id: authUserId,
          email,
          name,
          phone: phone || null,
          company_id: company.id,
          role: "MANAGER",
          status: "ACTIVE",
          user_id: authUserId, // FK para auth.users
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id, email, name, role, company_id")
        .single();

      if (publicUserError) {
        console.error("[signup-complete] ❌ Erro ao criar public.users:", publicUserError);
        // Rollback: deletar auth e empresa
        console.log("[signup-complete] 🔄 Fazendo rollback completo...");
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        return res.status(500).json({ error: "Erro ao criar perfil do usuário", details: publicUserError.message });
      }

      console.log("[signup-complete] ✅ Usuário criado em public.users");

      // ============ ETAPA 4: CRIAR ASSINATURA (TRIAL 30 DIAS) ============
      console.log("[signup-complete] 4️⃣ Criando assinatura trial...");
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 30);

      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          company_id: company.id,
          plan_id: (plan_id || "starter").toLowerCase(),
          status: "trial",
          billing_cycle: "monthly",
          trial_ends_at: trialEndsAt.toISOString(),
          trial_used: true,
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndsAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (subError) {
        console.error("[signup-complete] ⚠️ Erro ao criar assinatura:", subError);
      }

      console.log("[signup-complete] 🎉 Cadastro completo realizado com sucesso!");
      return res.json({
        success: true,
        user_id: publicUser.id,
        company_id: company.id,
        message: "Cadastro realizado com sucesso! Faça login para acessar o sistema.",
      });
    } catch (error: any) {
      console.error("[signup-complete] 💥 Erro inesperado:", error);
      return res.status(500).json({ error: error.message || "Erro interno do servidor" });
    }
  });

  // PASSO 2: Atualizar empresa temporária com dados reais
  app.post("/api/cadastro/create-company", requireAuth, async (req: any, res) => {
    try {
      console.log("[create-company] Iniciando atualização da empresa...");
      const { company_name, city, state, team_size, phone, cnpj } = req.body;
      const userId = req.user.id; // Vem do requireAuth
      const companyId = req.user.company_id;

      console.log("[create-company] User ID:", userId, "Company ID:", companyId);

      // Validações
      if (!company_name) {
        return res.status(400).json({ error: "Nome da empresa é obrigatório" });
      }

      if (!companyId) {
        return res.status(400).json({ error: "Empresa temporária não encontrada. Faça o cadastro novamente." });
      }

      // Atualizar empresa temporária com dados reais
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .update({
          name: company_name,
          phone: phone || null,
          city: city || "",
          state: state || "",
          cnpj: cnpj || "",
          team_size,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId)
        .select()
        .single();

      if (companyError || !company) {
        console.error("[create-company] Erro ao atualizar empresa:", companyError);
        return res.status(500).json({ error: "Erro ao atualizar empresa", details: companyError?.message });
      }

      console.log("[create-company] Empresa atualizada com sucesso!");
      return res.json({
        success: true,
        company_id: company.id,
        company,
        message: "Empresa configurada com sucesso!",
      });
    } catch (error: any) {
      console.error("[create-company] Erro inesperado:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // [DEPRECATED] Signup antigo - manter por compatibilidade
  app.post("/api/cadastro/signup", async (req: any, res) => {
    try {
      const { name, email, password, phone, company_name, city, state, team_size } = req.body;

      // Validações básicas
      if (!name || !email || !password || !company_name) {
        return res.status(400).json({ error: "Dados obrigatórios faltando" });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Validar senha (mínimo 6 caracteres)
      if (password.length < 6) {
        return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
      }

      // 1. CRIAR USUÁRIO NO SUPABASE AUTH PRIMEIRO
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirmar email (opcional, ajuste conforme necessário)
        user_metadata: {
          name,
          phone: phone || null,
        },
      });

      if (authError || !authData.user) {
        console.error("Erro ao criar usuário no Supabase Auth:", authError);
        return res.status(500).json({ error: "Erro ao criar usuário", details: authError?.message });
      }

      const authUserId = authData.user.id;

      // 2. CRIAR EMPRESA (agora que temos o usuário criado)
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: company_name,
          email,
          phone: phone || null,
          city: city || "",
          state: state || "",
          team_size,
          cnpj: "", // Vazio por enquanto
          onboarding_step: 1,
          onboarding_completed: false,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (companyError || !company) {
        // Rollback: deletar usuário do auth se empresa falhar
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        console.error("Erro ao criar empresa:", companyError);
        return res.status(500).json({ error: "Erro ao criar empresa", details: companyError?.message });
      }

      // 3. CRIAR REGISTRO EM PUBLIC.USERS (espelho do auth.users, com company_id)
      const { data: publicUser, error: publicUserError } = await supabaseAdmin
        .from("users")
        .insert({
          id: authUserId, // Usar o mesmo ID do auth.users
          email,
          name,
          phone: phone || null,
          company_id: company.id,
          role: "MANAGER", // Primeiro usuário é MANAGER (acesso completo na ferramenta)
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select("id, email, name, company_id, role")
        .single();

      if (publicUserError) {
        // Rollback: deletar usuário do auth e empresa
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        await supabaseAdmin.from("companies").delete().eq("id", company.id);
        console.error("Erro ao criar usuário em public.users:", publicUserError);
        return res.status(500).json({ error: "Erro ao criar perfil do usuário", details: publicUserError.message });
      }

      // 4. GERAR SESSION/TOKEN para o usuário fazer login automaticamente
      // Vamos usar signInWithPassword para gerar o token de acesso
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      let accessToken = null;
      if (signInData?.session) {
        accessToken = signInData.session.access_token;
        
        // Setar cookie HTTP-only para autenticação automática
        res.cookie(JWT_COOKIE_NAME, accessToken, {
          httpOnly: true,
          secure: JWT_COOKIE_SECURE,
          sameSite: "lax",
          domain: JWT_COOKIE_DOMAIN,
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        });
      }

      return res.json({
        success: true,
        user_id: publicUser.id,
        company_id: company.id,
        user: publicUser,
        access_token: accessToken, // Token JWT para o frontend usar (backup se cookie não funcionar)
        message: "Conta criada com sucesso!",
      });
    } catch (error: any) {
      console.error("Erro ao criar signup:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Obter estado atual do onboarding
  app.get("/api/cadastro/status", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);

      const { data, error } = await supabaseAdmin
        .from("companies")
        .select("industry, team_size, onboarding_completed, onboarding_step, onboarding_data")
        .eq("id", companyId)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Company not found" });

      return res.json({
        industry: data.industry,
        team_size: data.team_size,
        completed: data.onboarding_completed || false,
        current_step: data.onboarding_step || 1,
        data: data.onboarding_data || {},
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Salvar Step 1: Nicho da empresa
  app.post("/api/cadastro/step/1", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const parsed = OnboardingStep1Schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }

      const { industry } = parsed.data;

      // Atualizar company com industry
      const { error } = await supabaseAdmin
        .from("companies")
        .update({
          industry,
          onboarding_step: 2,
          onboarding_data: { industry },
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (error) return res.status(500).json({ error: error.message });

      // Aplicar configurações do nicho imediatamente
      const config = INDUSTRY_CONFIG[industry as keyof typeof INDUSTRY_CONFIG];
      if (config) {
        console.log(`[step/1] Aplicando configurações para industry: ${industry}`);
        
        // Salvar configurações do nicho
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
          console.error("[step/1] Erro ao salvar settings:", settingsError);
        } else {
          console.log(`[step/1] ✅ Configurações aplicadas com sucesso para ${industry}`);
        }
      }

      return res.json({ success: true, next_step: 2, industry });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Salvar Step 2: Informações básicas
  app.post("/api/cadastro/step/2", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const parsed = OnboardingStep2Schema.safeParse(req.body);

      if (!parsed.success) {
        console.error("[step/2] Erro de validação:", parsed.error.format());
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }

      const { company_name, city, state, team_size, main_challenge } = parsed.data;

      // Buscar dados anteriores
      const { data: current } = await supabaseAdmin
        .from("companies")
        .select("onboarding_data")
        .eq("id", companyId)
        .single();

      const onboardingData = {
        ...(current?.onboarding_data || {}),
        main_challenge, // Sempre salvar o desafio
      };

      // Preparar update apenas com campos que foram fornecidos
      const updateData: any = {
        main_challenge,
        onboarding_step: 3,
        onboarding_data: onboardingData,
        updated_at: new Date().toISOString(),
      };

      // Adicionar campos opcionais apenas se foram fornecidos
      if (company_name) updateData.name = company_name;
      if (city) updateData.city = city;
      if (state) updateData.state = state;
      if (team_size) updateData.team_size = team_size;

      const { error } = await supabaseAdmin
        .from("companies")
        .update(updateData)
        .eq("id", companyId);

      if (error) return res.status(500).json({ error: error.message });

      return res.json({ success: true, next_step: 3 });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Salvar Step 3: Configurações iniciais
  app.post("/api/cadastro/step/3", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const parsed = OnboardingStep3Schema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }

      const preferences = parsed.data;

      // Buscar dados anteriores
      const { data: current } = await supabaseAdmin
        .from("companies")
        .select("onboarding_data")
        .eq("id", companyId)
        .single();

      const onboardingData = {
        ...(current?.onboarding_data || {}),
        preferences,
      };

      const { error } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_step: 4,
          onboarding_data: onboardingData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (error) return res.status(500).json({ error: error.message });

      return res.json({ success: true, next_step: 4 });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Completar onboarding e aplicar configurações
  app.post("/api/cadastro/complete", requireAuth, async (req: any, res) => {
    try {
      console.log("[onboarding/complete] Iniciando finalização do onboarding...");
      const companyId = await resolveCompanyId(req);
      console.log("[onboarding/complete] Company ID:", companyId);

      // Buscar dados do onboarding
      const { data: company, error: fetchError } = await supabaseAdmin
        .from("companies")
        .select("industry, onboarding_data")
        .eq("id", companyId)
        .single();

      if (fetchError || !company) {
        console.error("[onboarding/complete] ❌ Company not found:", fetchError);
        return res.status(404).json({ error: "Company not found" });
      }

      console.log("[onboarding/complete] Company data:", { industry: company.industry, onboarding_data: company.onboarding_data });

      const { industry, onboarding_data } = company;
      const preferences = onboarding_data?.preferences || {};

      if (!industry) {
        console.error("[onboarding/complete] ❌ Industry not selected");
        return res.status(400).json({ error: "Industry not selected" });
      }

      const config = INDUSTRY_CONFIG[industry as keyof typeof INDUSTRY_CONFIG];
      console.log("[onboarding/complete] Usando config para industry:", industry);

      // 1. Criar agente de IA (se solicitado)
      if (preferences.wants_ai_agent !== false) {
        const { error: agentError } = await supabaseAdmin
          .from("agents")
          .insert({
            company_id: companyId,
            name: config.agent_name,
            instructions: config.agent_instructions,
            is_active: true,
            created_at: new Date().toISOString(),
          });

        if (agentError) console.error("Erro ao criar agente:", agentError);
      }

      // 2. Salvar configurações do nicho
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

      if (settingsError) console.error("Erro ao salvar settings:", settingsError);

      // 3. Marcar onboarding como completo
      console.log("[onboarding/complete] Marcando onboarding como completo...");
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_completed: true,
          onboarding_step: 4,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (updateError) {
        console.error("[onboarding/complete] ❌ Erro ao atualizar:", updateError);
        return res.status(500).json({ error: updateError.message });
      }

      console.log("[onboarding/complete] ✅ Onboarding completado com sucesso!");
      return res.json({
        success: true,
        message: "Onboarding concluído com sucesso!",
        config: {
          industry,
          agent_created: preferences.wants_ai_agent !== false,
          modules_enabled: config.enabled_modules,
        },
      });
    } catch (error: any) {
      console.error("Erro ao completar onboarding:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Obter configurações específicas do nicho
  app.get("/api/cadastro/industry-config/:industry", requireAuth, async (req: any, res) => {
    try {
      const { industry } = req.params;

      if (!IndustryEnum.safeParse(industry).success) {
        return res.status(400).json({ error: "Industry inválida" });
      }

      const config = INDUSTRY_CONFIG[industry as keyof typeof INDUSTRY_CONFIG];

      return res.json({
        industry,
        agent_name: config.agent_name,
        custom_fields: config.custom_fields,
        enabled_modules: config.enabled_modules,
        templates_count: config.templates.length,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  });

  // Salvar plano selecionado (APÓS onboarding completo)
  app.post("/api/cadastro/save-plan", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const { plan_id } = req.body;

      if (!plan_id) {
        return res.status(400).json({ error: "Plan ID é obrigatório" });
      }

      // Mapear plan_id para o ENUM do banco
      const planMap: Record<string, string> = {
        "starter": "STARTER",
        "growth": "GROWTH",
        "professional": "PROFESSIONAL", 
        "business": "BUSINESS"
      };

      const planEnum = planMap[plan_id.toLowerCase()] || "STARTER";

      // Atualizar plano na tabela companies
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          plan: planEnum,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (updateError) {
        console.error("Erro ao salvar plano:", updateError);
        return res.status(500).json({ error: updateError.message });
      }

      // Salvar em company_settings também (trial, etc)
      await supabaseAdmin.from("company_settings").upsert({
        company_id: companyId,
        setting_key: "selected_plan",
        setting_value: { 
          plan_id: planEnum, 
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          selected_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
      }, { onConflict: "company_id,setting_key" });

      return res.json({
        success: true,
        message: "Plano salvo com sucesso!",
        plan: planEnum,
        redirect_url: `${FRONTEND_URL}/dashboard`
      });
    } catch (error: any) {
      console.error("Erro ao salvar plano:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}

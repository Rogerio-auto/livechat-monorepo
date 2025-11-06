import "dotenv/config";
import { db } from "../src/pg";

async function checkAndFixTemplates() {
  console.log("🔍 Verificando templates no banco de dados...\n");
  
  try {
    // Consultar templates existentes
    const { rows: templates } = await db.query<{
      id: string;
      key: string;
      name: string;
      description: string;
      category: string;
      prompt_template: string;
      prompt_preview: string;
    }>(`
      SELECT 
        id, 
        key, 
        name, 
        description, 
        category,
        prompt_template,
        LEFT(prompt_template, 50) as prompt_preview
      FROM public.agent_templates 
      WHERE company_id IS NULL
      ORDER BY created_at
    `);
    
    console.log(`📊 Templates globais encontrados: ${templates.length}\n`);
    
    if (templates.length === 0) {
      console.log("⚠️  Nenhum template global encontrado! Criando templates padrão...\n");
      await createDefaultTemplates();
    } else {
      console.log("✅ Templates existentes:");
      templates.forEach(t => {
        console.log(`   • ${t.name} (${t.key})`);
        console.log(`     Categoria: ${t.category || '(sem categoria)'}`);
        console.log(`     Descrição: ${t.description?.substring(0, 60) || '(sem descrição)'}...`);
        console.log(`     Prompt: ${t.prompt_preview ? 'OK' : '❌ VAZIO'}...\n`);
      });
      
      // Verificar se algum está com dados incompletos
      const incomplete = templates.filter(t => 
        !t.name || !t.description || !t.category || !t.prompt_preview
      );
      
      if (incomplete.length > 0) {
        console.log(`⚠️  ${incomplete.length} template(s) com dados incompletos. Atualizando...\n`);
        await createDefaultTemplates();
      }
    }
    
  } catch (err) {
    console.error("❌ Erro ao verificar templates:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

async function createDefaultTemplates() {
  const templates = [
    {
      key: 'sales',
      name: 'Vendedor',
      description: 'Agente de vendas consultivo, especializado em qualificação de leads, follow-up estratégico e fechamento de negócios. Conduz conversas naturais focadas em entender necessidades do cliente.',
      category: 'Comercial',
      prompt_template: `Você é {{nome_agente}}, um vendedor consultivo da {{empresa}} especializado em {{setor}}.

Seu objetivo é: {{objetivo_vendas}}

Perfil do cliente ideal:
{{perfil_cliente}}

Produtos/Serviços principais:
{{produtos_servicos}}

Tom de comunicação: {{tom_comunicacao}}

DIRETRIZES:
- Seja natural e consultivo, não agressivo
- Faça perguntas para entender necessidades
- Use as ferramentas disponíveis para consultar dados do cliente
- Adicione tags relevantes conforme a conversa evolui
- Ofereça valor antes de pedir a venda`,
      default_model: 'gpt-4o-mini',
      default_model_params: { temperature: 0.7, max_tokens: 500 }
    },
    {
      key: 'reception',
      name: 'Recepcionista',
      description: 'Assistente de atendimento inicial focado em recepção calorosa, coleta de informações básicas e direcionamento inteligente. Primeiro ponto de contato com o cliente.',
      category: 'Marketing',
      prompt_template: `Você é {{nome_agente}}, recepcionista virtual da {{empresa}}.

Sua função: {{funcao_recepcao}}

Horário de atendimento: {{horario_atendimento}}

Informações a coletar:
{{info_coletar}}

Quando direcionar para humano:
{{quando_transferir}}

Tom de comunicação: {{tom_comunicacao}}

DIRETRIZES:
- Seja cordial e eficiente
- Colete dados essenciais antes de transferir
- Atualize informações do cliente quando necessário
- Organize contatos com tags apropriadas
- Informe horários e próximos passos claramente`,
      default_model: 'gpt-4o-mini',
      default_model_params: { temperature: 0.6, max_tokens: 400 }
    },
    {
      key: 'support',
      name: 'Suporte',
      description: 'Especialista em resolver dúvidas técnicas e abrir tickets quando necessário. Focado em diagnóstico rápido e solução eficiente de problemas.',
      category: 'Comercial',
      prompt_template: `Você é {{nome_agente}}, analista de suporte da {{empresa}} especializado em {{area_suporte}}.

Tipo de suporte: {{tipo_suporte}}

Problemas comuns:
{{problemas_comuns}}

Base de conhecimento:
{{base_conhecimento}}

Quando escalar:
{{quando_escalar}}

Tom de comunicação: {{tom_comunicacao}}

DIRETRIZES:
- Seja técnico mas acessível
- Faça diagnóstico antes de sugerir soluções
- Consulte histórico do cliente para contexto
- Documente problemas com tags específicas
- Esclareça prazos e próximos passos`,
      default_model: 'gpt-4o-mini',
      default_model_params: { temperature: 0.5, max_tokens: 600 }
    }
  ];
  
  for (const tpl of templates) {
    try {
      await db.none(`
        INSERT INTO public.agent_templates (
          company_id, key, name, description, category, 
          prompt_template, default_model, default_model_params, default_tools
        ) VALUES (
          NULL, $1, $2, $3, $4, $5, $6, $7::jsonb, '[]'::jsonb
        )
        ON CONFLICT (company_id, key) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          prompt_template = EXCLUDED.prompt_template,
          default_model = EXCLUDED.default_model,
          default_model_params = EXCLUDED.default_model_params
      `, [
        tpl.key,
        tpl.name,
        tpl.description,
        tpl.category,
        tpl.prompt_template,
        tpl.default_model,
        JSON.stringify(tpl.default_model_params)
      ]);
      
      console.log(`  ✅ Template "${tpl.name}" criado/atualizado`);
    } catch (err) {
      console.error(`  ❌ Erro ao criar template ${tpl.key}:`, err);
    }
  }
  
  console.log("\n✅ Todos os templates foram processados!");
}

checkAndFixTemplates();

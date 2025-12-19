// backend/src/seeds/project-templates.seed.ts

import {
  createTemplate,
  addStageToTemplate,
  addCustomFieldToTemplate,
  type TemplateWithDetails,
} from "../repos/project-templates.repo.ts";

// ==================== SEED DATA ====================

type TemplateSeedData = {
  name: string;
  description:  string;
  industry: string;
  icon: string;
  color: string;
  stages: Array<{
    name: string;
    description?:  string;
    color: string;
    order_index: number;
  }>;
  custom_fields: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    field_placeholder?: string;
    field_help_text?: string;
    field_options?: string[];
    is_required?: boolean;
    show_in_card?: boolean;
    order_index: number;
  }>;
};

const TEMPLATE_SEEDS: Record<string, TemplateSeedData> = {
  solar_energy: {
    name: "Projeto de Energia Solar",
    description: "Gestão completa de projetos fotovoltaicos: da prospecção à homologação",
    industry: "solar_energy",
    icon: "☀️",
    color: "#F59E0B",
    stages: [
      { name: "Lead / Interessado", color: "#6B7280", order_index: 1, description: "Cliente demonstrou interesse" },
      { name: "Visita Técnica Agendada", color: "#3B82F6", order_index: 2, description: "Agendamento da visita técnica" },
      { name: "Elaboração de Proposta", color: "#8B5CF6", order_index: 3, description: "Proposta sendo elaborada" },
      { name: "Proposta Enviada", color: "#F59E0B", order_index: 4, description: "Aguardando resposta do cliente" },
      { name: "Contrato Assinado", color: "#10B981", order_index: 5, description: "Contrato fechado" },
      { name: "Projeto Elétrico", color: "#4F46E5", order_index: 6, description: "Desenvolvimento do projeto" },
      { name: "Aprovação Concessionária", color: "#F97316", order_index: 7, description: "Aguardando aprovação" },
      { name: "Compra de Equipamentos", color: "#EC4899", order_index: 8, description: "Aquisição de materiais" },
      { name: "Instalação em Andamento", color: "#14B8A6", order_index: 9, description: "Equipe instalando o sistema" },
      { name: "Vistoria / Homologação", color: "#EF4444", order_index: 10, description: "Vistoria da concessionária" },
      { name: "Sistema Ligado", color: "#059669", order_index: 11, description: "Projeto concluído e operando" },
    ],
    custom_fields: [
      { field_key: "potencia_kwp", field_label: "Potência (kWp)", field_type: "number", is_required: true, show_in_card: true, order_index: 1, field_placeholder: "Ex: 10.5", field_help_text: "Potência total do sistema em kWp" },
      { field_key: "tipo_painel", field_label: "Tipo de Painel", field_type: "select", field_options: ["Monocristalino", "Policristalino", "Filme Fino"], show_in_card: true, order_index: 2 },
      { field_key: "tipo_inversor", field_label: "Tipo de Inversor", field_type: "select", field_options: ["String", "Microinversor", "Híbrido"], order_index: 3 },
      { field_key: "tipo_instalacao", field_label: "Tipo de Instalação", field_type: "select", field_options: ["Telhado", "Solo", "Carport", "Fachada"], order_index: 4 },
      { field_key: "num_paineis", field_label: "Número de Painéis", field_type: "number", order_index: 5, field_placeholder: "Ex: 25" },
      { field_key: "geracao_estimada", field_label: "Geração Estimada (kWh/mês)", field_type: "number", show_in_card: true, order_index: 6 },
      { field_key: "economia_mensal", field_label: "Economia Mensal Estimada", field_type: "currency", show_in_card: true, order_index: 7, field_help_text: "Economia na conta de luz" },
      { field_key: "payback_meses", field_label: "Payback (meses)", field_type: "number", order_index: 8 },
      { field_key: "numero_art", field_label: "Número ART", field_type: "text", order_index: 9, field_placeholder: "Ex: ART123456789" },
      { field_key: "protocolo_concessionaria", field_label: "Protocolo Concessionária", field_type: "text", order_index: 10 },
      { field_key: "modelo_painel", field_label: "Modelo do Painel", field_type: "text", order_index: 11 },
      { field_key: "modelo_inversor", field_label: "Modelo do Inversor", field_type: "text", order_index: 12 },
      { field_key: "responsavel_tecnico", field_label: "Responsável Técnico", field_type: "text", order_index: 13 },
      { field_key: "crea", field_label: "CREA", field_type: "text", order_index: 14 },
    ],
  },

  construction: {
    name: "Obra / Construção Civil",
    description: "Gestão de obras, reformas e construções",
    industry: "construction",
    icon: "🏗️",
    color: "#F97316",
    stages: [
      { name: "Orçamento", color: "#6B7280", order_index: 1 },
      { name: "Projeto Arquitetônico", color: "#3B82F6", order_index: 2 },
      { name: "Aprovação Prefeitura", color: "#F59E0B", order_index: 3 },
      { name: "Fundação", color: "#78350F", order_index: 4 },
      { name: "Estrutura", color: "#F97316", order_index: 5 },
      { name: "Alvenaria", color: "#EF4444", order_index: 6 },
      { name: "Instalações", color: "#8B5CF6", order_index: 7 },
      { name: "Acabamento", color: "#EC4899", order_index: 8 },
      { name: "Entrega", color: "#10B981", order_index: 9 },
    ],
    custom_fields: [
      { field_key: "area_construida", field_label: "Área Construída (m²)", field_type: "number", is_required: true, show_in_card: true, order_index: 1 },
      { field_key: "tipo_obra", field_label: "Tipo de Obra", field_type: "select", field_options: ["Residencial", "Comercial", "Industrial", "Reforma"], is_required: true, order_index: 2 },
      { field_key: "num_pavimentos", field_label: "Número de Pavimentos", field_type: "number", order_index: 3 },
      { field_key: "prazo_dias", field_label: "Prazo Total (dias)", field_type: "number", show_in_card: true, order_index: 4 },
      { field_key: "responsavel_tecnico", field_label: "Responsável Técnico", field_type: "text", order_index: 5 },
      { field_key: "crea_cau", field_label: "CREA/CAU", field_type: "text", order_index: 6 },
      { field_key: "alvara", field_label: "Alvará de Construção", field_type: "text", order_index: 7 },
      { field_key: "tipo_fundacao", field_label: "Tipo de Fundação", field_type: "select", field_options: ["Radier", "Sapata", "Estaca", "Tubulão"], order_index: 8 },
      { field_key: "tipo_estrutura", field_label: "Tipo de Estrutura", field_type: "select", field_options: ["Concreto Armado", "Metálica", "Madeira", "Mista"], order_index: 9 },
    ],
  },

  law: {
    name: "Escritório de Advocacia",
    description: "Gestão de processos judiciais e prazos processuais",
    industry: "law",
    icon: "⚖️",
    color: "#475569",
    stages: [
      { name: "Triagem / Consulta", color: "#6B7280", order_index: 1 },
      { name: "Análise de Documentos", color: "#3B82F6", order_index: 2 },
      { name: "Elaboração de Petição", color: "#8B5CF6", order_index: 3 },
      { name: "Protocolo / Distribuição", color: "#F59E0B", order_index: 4 },
      { name: "Aguardando Citação", color: "#F97316", order_index: 5 },
      { name: "Instrução Processual", color: "#EC4899", order_index: 6 },
      { name: "Sentença / Recurso", color: "#EF4444", order_index: 7 },
      { name: "Execução / Trânsito em Julgado", color: "#10B981", order_index: 8 },
    ],
    custom_fields: [
      { field_key: "numero_processo", field_label: "Número do Processo", field_type: "text", show_in_card: true, order_index: 1 },
      { field_key: "tribunal", field_label: "Tribunal", field_type: "text", order_index: 2 },
      { field_key: "vara", field_label: "Vara / Comarca", field_type: "text", order_index: 3 },
      { field_key: "tipo_acao", field_label: "Tipo de Ação", field_type: "select", field_options: ["Cível", "Trabalhista", "Criminal", "Tributária", "Família"], order_index: 4 },
      { field_key: "valor_causa", field_label: "Valor da Causa", field_type: "currency", show_in_card: true, order_index: 5 },
    ],
  },

  accounting: {
    name: "Escritório de Contabilidade",
    description: "Gestão de obrigações fiscais e contábeis de empresas",
    industry: "accounting",
    icon: "📊",
    color: "#059669",
    stages: [
      { name: "Coleta de Documentos", color: "#6B7280", order_index: 1 },
      { name: "Lançamentos Contábeis", color: "#3B82F6", order_index: 2 },
      { name: "Apuração de Impostos", color: "#F59E0B", order_index: 3 },
      { name: "Folha de Pagamento", color: "#8B5CF6", order_index: 4 },
      { name: "Revisão / Auditoria", color: "#F97316", order_index: 5 },
      { name: "Envio de Guias / Relatórios", color: "#10B981", order_index: 6 },
    ],
    custom_fields: [
      { field_key: "regime_tributario", field_label: "Regime Tributário", field_type: "select", field_options: ["Simples Nacional", "Lucro Presumido", "Lucro Real"], show_in_card: true, order_index: 1 },
      { field_key: "cnpj", field_label: "CNPJ", field_type: "text", show_in_card: true, order_index: 2 },
      { field_key: "faturamento_mensal", field_label: "Faturamento Médio", field_type: "currency", order_index: 3 },
    ],
  },

  clinic: {
    name: "Clínica / Saúde",
    description: "Acompanhamento de tratamentos e procedimentos médicos",
    industry: "clinic",
    icon: "🏥",
    color: "#E11D48",
    stages: [
      { name: "Triagem / Avaliação", color: "#6B7280", order_index: 1 },
      { name: "Exames Solicitados", color: "#3B82F6", order_index: 2 },
      { name: "Análise de Resultados", color: "#8B5CF6", order_index: 3 },
      { name: "Início do Tratamento", color: "#F59E0B", order_index: 4 },
      { name: "Sessões / Acompanhamento", color: "#F97316", order_index: 5 },
      { name: "Alta / Conclusão", color: "#10B981", order_index: 6 },
    ],
    custom_fields: [
      { field_key: "especialidade", field_label: "Especialidade", field_type: "text", show_in_card: true, order_index: 1 },
      { field_key: "convenio", field_label: "Convênio", field_type: "text", order_index: 2 },
      { field_key: "data_nascimento", field_label: "Data de Nascimento", field_type: "date", order_index: 3 },
    ],
  },

  real_estate: {
    name: "Imobiliária",
    description: "Gestão de vendas e locações de imóveis",
    industry: "real_estate",
    icon: "🏠",
    color: "#EA580C",
    stages: [
      { name: "Captação / Cadastro", color: "#6B7280", order_index: 1 },
      { name: "Visitas Agendadas", color: "#3B82F6", order_index: 2 },
      { name: "Proposta Recebida", color: "#F59E0B", order_index: 3 },
      { name: "Análise de Crédito", color: "#8B5CF6", order_index: 4 },
      { name: "Contrato / Escritura", color: "#10B981", order_index: 5 },
      { name: "Entrega de Chaves", color: "#059669", order_index: 6 },
    ],
    custom_fields: [
      { field_key: "tipo_imovel", field_label: "Tipo de Imóvel", field_type: "select", field_options: ["Casa", "Apartamento", "Terreno", "Comercial"], show_in_card: true, order_index: 1 },
      { field_key: "valor_imovel", field_label: "Valor do Imóvel", field_type: "currency", show_in_card: true, order_index: 2 },
      { field_key: "endereco_imovel", field_label: "Endereço", field_type: "text", order_index: 3 },
    ],
  },

  education: {
    name: "Educação / Cursos",
    description: "Gestão de matrículas e progresso de alunos",
    industry: "education",
    icon: "🎓",
    color: "#2563EB",
    stages: [
      { name: "Interesse / Lead", color: "#6B7280", order_index: 1 },
      { name: "Matrícula em Análise", color: "#3B82F6", order_index: 2 },
      { name: "Matrícula Ativa", color: "#10B981", order_index: 3 },
      { name: "Em Curso", color: "#F59E0B", order_index: 4 },
      { name: "Concluído / Certificado", color: "#059669", order_index: 5 },
    ],
    custom_fields: [
      { field_key: "curso", field_label: "Curso / Turma", field_type: "text", show_in_card: true, order_index: 1 },
      { field_key: "nivel", field_label: "Nível", field_type: "select", field_options: ["Básico", "Intermediário", "Avançado"], order_index: 2 },
    ],
  },

  retail: {
    name: "Varejo / Comércio",
    description: "Gestão de pedidos e entregas",
    industry: "retail",
    icon: "🛍️",
    color: "#4F46E5",
    stages: [
      { name: "Pedido Recebido", color: "#6B7280", order_index: 1 },
      { name: "Pagamento Confirmado", color: "#3B82F6", order_index: 2 },
      { name: "Separação / Estoque", color: "#F59E0B", order_index: 3 },
      { name: "Embalagem", color: "#8B5CF6", order_index: 4 },
      { name: "Enviado / Transportadora", color: "#F97316", order_index: 5 },
      { name: "Entregue", color: "#10B981", order_index: 6 },
    ],
    custom_fields: [
      { field_key: "numero_pedido", field_label: "Nº do Pedido", field_type: "text", show_in_card: true, order_index: 1 },
      { field_key: "metodo_pagamento", field_label: "Pagamento", field_type: "select", field_options: ["Cartão", "Pix", "Boleto"], order_index: 2 },
    ],
  },

  events: {
    name: "Eventos / Produção",
    description: "Planejamento e execução de eventos",
    industry: "events",
    icon: "🎉",
    color: "#DB2777",
    stages: [
      { name: "Briefing / Orçamento", color: "#6B7280", order_index: 1 },
      { name: "Reserva de Data", color: "#3B82F6", order_index: 2 },
      { name: "Contratação Fornecedores", color: "#8B5CF6", order_index: 3 },
      { name: "Planejamento Detalhado", color: "#F59E0B", order_index: 4 },
      { name: "Execução / Montagem", color: "#F97316", order_index: 5 },
      { name: "Pós-Evento / Feedback", color: "#10B981", order_index: 6 },
    ],
    custom_fields: [
      { field_key: "tipo_evento", field_label: "Tipo de Evento", field_type: "select", field_options: ["Casamento", "Corporativo", "Aniversário", "Show"], show_in_card: true, order_index: 1 },
      { field_key: "num_convidados", field_label: "Nº Convidados", field_type: "number", order_index: 2 },
    ],
  },

  generic: {
    name: "Projeto Personalizado",
    description: "Template genérico customizável para qualquer tipo de projeto",
    industry: "generic",
    icon: "📋",
    color: "#6B7280",
    stages: [
      { name: "Novo", color: "#6B7280", order_index: 1 },
      { name: "Em Análise", color: "#3B82F6", order_index: 2 },
      { name: "Em Andamento", color: "#F59E0B", order_index: 3 },
      { name: "Em Revisão", color: "#F97316", order_index: 4 },
      { name: "Concluído", color: "#10B981", order_index: 5 },
    ],
    custom_fields: [
      { field_key: "prioridade", field_label: "Prioridade", field_type: "select", field_options: ["Baixa", "Média", "Alta", "Urgente"], is_required: true, show_in_card: true, order_index: 1 },
      { field_key: "categoria", field_label: "Categoria", field_type: "text", order_index: 2 },
      { field_key: "observacoes", field_label: "Observações", field_type: "textarea", order_index: 3 },
    ],
  },
};

// ==================== SEED FUNCTION ====================

/**
 * Cria template completo baseado na indústria
 */
export async function seedTemplateByIndustry(
  companyId: string,
  userId: string,
  industry: string
): Promise<TemplateWithDetails> {
  const seedData = TEMPLATE_SEEDS[industry];
  
  if (!seedData) {
    throw new Error(`Template não encontrado para indústria:  ${industry}`);
  }

  // Criar template
  const template = await createTemplate(companyId, userId, {
    name: seedData.name,
    description: seedData. description,
    industry: seedData.industry,
    icon: seedData.icon,
    color: seedData.color,
    is_default: true,
  });

  // Adicionar estágios
  const stages = [];
  for (const stageData of seedData.stages) {
    const stage = await addStageToTemplate(template.id, stageData);
    stages.push(stage);
  }

  // Adicionar campos customizados
  const custom_fields = [];
  for (const fieldData of seedData.custom_fields) {
    const field = await addCustomFieldToTemplate(template.id, fieldData);
    custom_fields.push(field);
  }

  return {
    ... template,
    stages,
    custom_fields,
  };
}

/**
 * Lista indústrias disponíveis
 */
export function getAvailableIndustries(): string[] {
  return Object.keys(TEMPLATE_SEEDS);
}

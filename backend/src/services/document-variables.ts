/**
 * Serviço de mapeamento de variáveis para templates de documentos
 * Mapeia dados do sistema para as variáveis usadas nos templates DOCX
 */

import extenso from "extenso";

export interface DocumentData {
  company?: any;
  customer?: any;
  lead?: any;
  proposal?: any;
  document?: any;
  powerOfAttorney?: any;
  seller?: any;
}

/**
 * Gera o mapa completo de variáveis substituindo # por vazio
 * Exemplo: #NOME_CLIENTE vira NOME_CLIENTE no objeto
 */
export function mapDocumentVariables(data: DocumentData): Record<string, any> {
  const { company, customer, lead, proposal, document, powerOfAttorney, seller } = data;
  
  console.log("[DocVars] Dados recebidos:", {
    hasCompany: !!company,
    hasCustomer: !!customer,
    hasLead: !!lead,
    hasProposal: !!proposal,
    proposalFields: proposal ? Object.keys(proposal).length : 0
  });
  
  // Helper para formatar datas
  const formatDate = (date: any): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  };

  const formatDateExtended = (date: any): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  };

  const formatMoney = (value: any): string => {
    if (value === null || value === undefined) return "R$ 0,00";
    return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const moneyToText = (value: any): string => {
    if (value === null || value === undefined) return "zero reais";
    try {
      return extenso(String(Math.floor(Number(value))), { mode: "currency" });
    } catch {
      return "zero reais";
    }
  };

  // Dados do cliente (customer ou lead)
  const clientData = customer || lead || {};
  const clientAddress = clientData.address || "";
  const clientStreet = clientData.street || "";
  const clientNeighborhood = clientData.neighborhood || "";
  const clientCity = clientData.city || "";
  const clientState = clientData.state || "";
  const clientZipcode = clientData.zipcode || "";

  // Dados da empresa
  const companyAddress = company?.address || "";
  const companyName = company?.name || "";
  const companyFantasyName = company?.fantasy_name || companyName;
  const companyCnpj = company?.cnpj || "";

  // Dados da proposta
  const proposalNumber = proposal?.number || proposal?.id?.substring(0, 8) || "";
  const proposalTotal = proposal?.total_value || document?.total || 0;

  // Dados do vendedor
  const sellerName = seller?.name || proposal?.seller_name || "";
  const sellerPhone = seller?.phone || proposal?.seller_phone || "";

  // Data atual
  const today = new Date();
  const cityDate = `${company?.city || ""}, ${formatDate(today)}`;

  // Dados de financiamento
  const paymentMethod = proposal?.payment_method || "";
  const financingBank = proposal?.financing_bank || "";
  const financingInstallments = proposal?.financing_installments || 0;
  const financingInstallmentValue = proposal?.financing_installment_value || 0;
  const financingInterestRate = proposal?.financing_interest_rate || 0;
  const financingTotalAmount = proposal?.financing_total_amount || 0;
  const financingEntryValue = proposal?.financing_entry_value || 0;
  const financingCET = proposal?.financing_cet || 0;
  const financingIOF = proposal?.financing_iof || 0;
  const financingType = proposal?.financing_type || "";
  const financingFirstDueDate = proposal?.financing_first_due_date ? formatDate(proposal.financing_first_due_date) : "";

  // Variáveis do sistema
  const variables: Record<string, any> = {
    // Cliente
    NOME_CLIENTE: clientData.name || "",
    CPF_CNPJ_CLIENTE: clientData.cpf_cnpj || clientData.cpf || "",
    RG_CLIENTE: clientData.rg || "",
    ENDE_CLIENTE: clientAddress,
    RUA_CLIENTE: clientStreet,
    BAIRRO_CLIENTE: clientNeighborhood,
    CIDADE_CLIENTE: clientCity,
    UF_CLIENTE: clientState,
    CEP_CLIENTE: clientZipcode,
    CELULAR_CLIENTE: clientData.phone || "",
    EMAIL_CLIENTE: clientData.email || "",

    // Proposta/Orçamento
    NUM_PROPOSTA: proposalNumber,
    DATA_CRIACAO_ORCAMENTO: formatDate(proposal?.created_at),
    DATA_ATUAL: formatDate(today),
    DATA_HOJE: formatDate(today),
    DATA_ATUAL_EXTENSO: formatDateExtended(today),
    CIDADE_DATA: cityDate,

    // Vendedor
    NOME_VENDEDOR: sellerName,
    CELULAR_VENDEDOR: sellerPhone,

    // Empresa
    NOME_EMPRESA_DOC: `${companyName}${companyCnpj ? ` - CNPJ: ${companyCnpj}` : ""}`,
    NOME_FANTASIA: companyFantasyName,
    ENDE_EMPRESA: companyAddress,
    FONE_EMPRESA: company?.phone || "",
    EMAIL_EMPRESA: company?.email || "",
    NOME_COMARCA: company?.county || "",
    LATITUDE: company?.latitude || "",
    LONGITUDE: company?.longitude || "",

    // Valores
    VAL_INVEST: formatMoney(proposalTotal),
    POR_EXTENSO: moneyToText(proposalTotal),
    VALOR_POR_WP: proposal?.solar_value_per_wp ? formatMoney(proposal.solar_value_per_wp) : "",

    // Prazo
    VALID_PROP: proposal?.valid_until ? formatDate(proposal.valid_until) : "",
    PRAZO_ENTR: proposal?.delivery_days ? `${proposal.delivery_days} dias` : "",
    PRAZO_INSTA: proposal?.installation_days ? `${proposal.installation_days} dias` : "",

    // Garantias (energia solar)
    GARAN_PAINEL: proposal?.solar_panel_warranty ? `${proposal.solar_panel_warranty} anos` : "",
    GARAN_ESTRU: proposal?.solar_structure_warranty ? `${proposal.solar_structure_warranty} anos` : "",
    GARAN_SERVI: proposal?.solar_service_warranty ? `${proposal.solar_service_warranty} anos` : "",
    GARAN_INVER: proposal?.solar_inverter_warranty ? `${proposal.solar_inverter_warranty} anos` : "",

    // Projeto solar
    CLASSE_PROJ: proposal?.solar_project_class || "",
    POT_PAINEL: proposal?.solar_panel_power || "",
    POT_TOTAL: proposal?.solar_total_power || "",
    NUM_PAINEL: proposal?.solar_num_panels || "",
    AREA_TOTAL: proposal?.solar_area_needed || "",
    ESPECIFICACAO_PAINEL: proposal?.solar_panel_spec || "",
    ESPECIFICACAO_INVERSOR: proposal?.solar_inverter_spec || "",

    // Produção/Consumo
    PRODU_MEDIA: proposal?.solar_monthly_production || "",
    PRODU_MENSAL: proposal?.solar_monthly_production || "",
    PRODU_ANUAL: proposal?.solar_annual_production || "",
    PRODU_MEDIA_SEM_PERDA: proposal?.solar_monthly_production ? (proposal.solar_monthly_production * 1.05).toFixed(2) : "",
    PRODU_ANUAL_SEM_PERDA: proposal?.solar_annual_production ? (proposal.solar_annual_production * 1.05).toFixed(2) : "",
    CONSU_MEDIO: proposal?.solar_monthly_consumption || "",
    CONSU_ANUAL: proposal?.solar_annual_consumption || "",
    CUSTO_MIN: proposal?.solar_min_cost ? formatMoney(proposal.solar_min_cost) : "",

    // Concessionária
    TARIF_CONCESS: proposal?.solar_energy_tariff || "",
    NOME_CONCESS: proposal?.solar_utility_name || "",
    TAXA_INFLA: proposal?.solar_inflation_rate ? `${proposal.solar_inflation_rate}%` : "",

    // Payback e retorno
    ANO_PAYBACK: proposal?.solar_payback_years || "",
    MES_PAYBACK: proposal?.solar_payback_months || "",
    TIR: proposal?.solar_tir ? `${proposal.solar_tir}%` : "",
    VPL: proposal?.solar_vpl ? formatMoney(proposal.solar_vpl) : "",

    // Sustentabilidade
    CO2_1: proposal?.solar_co2_1year || "",
    CO2_25: proposal?.solar_co2_25years || "",
    CO2_ARVORES: proposal?.solar_co2_trees || "",
    CO2_CARROS: proposal?.solar_co2_cars || "",

    // Geração e economia
    PERC_GERACAO: proposal?.solar_generation_percentage ? `${proposal.solar_generation_percentage}%` : "",
    VALOR_CONTA_ATUAL: proposal?.solar_current_bill_value ? formatMoney(proposal.solar_current_bill_value) : "",
    VALOR_CONTA_SOLAR: proposal?.solar_future_bill_value ? formatMoney(proposal.solar_future_bill_value) : "",
    VALOR_ECONOMIA: proposal?.solar_savings_value ? formatMoney(proposal.solar_savings_value) : "",
    PERCENTUAL_ECONOMIA: proposal?.solar_savings_percentage ? `${proposal.solar_savings_percentage}%` : "",

    // Localização
    LOCAL_INSTA: proposal?.solar_installation_location || clientAddress,
    NUMERO_INSTALACAO: lead?.installation_number || "",
    UNIDADE_CONSUMIDORA: lead?.installation_number || "",

    // Pagamento
    CONDICAO_PAGAMENTO: proposal?.payment_terms || "",
    FORMA_PAGAMENTO: proposal?.payment_method || paymentMethod,
    
    // Financiamento Bancário
    FINANC_BANCO: financingBank,
    FINANC_PARCELAS: financingInstallments,
    FINANC_VALOR_PARCELA: formatMoney(financingInstallmentValue),
    FINANC_TAXA_JUROS: financingInterestRate ? `${financingInterestRate}%` : "",
    FINANC_VALOR_TOTAL: formatMoney(financingTotalAmount),
    FINANC_VALOR_ENTRADA: formatMoney(financingEntryValue),
    FINANC_CET: financingCET ? `${financingCET}%` : "",
    FINANC_IOF: formatMoney(financingIOF),
    FINANC_TIPO: financingType,
    FINANC_PRIMEIRA_PARCELA: financingFirstDueDate,
    FINANC_PARCELA_EXTENSO: moneyToText(financingInstallmentValue),
    FINANC_TOTAL_EXTENSO: moneyToText(financingTotalAmount),

    // Observações
    OBS_PROPOSTA: proposal?.observation || "",

    // Procuração (se aplicável)
    DADOS_OUTORG: powerOfAttorney ? `${powerOfAttorney.grantor_name}, CPF ${powerOfAttorney.grantor_cpf}` : "",

    // Composições úteis
    DADOS_VENDEDOR: `${companyName}${companyAddress ? `, ${companyAddress}` : ""}`,
    DADOS_CLIENTE: `${clientData.name || ""}${clientAddress ? `, ${clientAddress}` : ""}`,

    // Unidades e estados (se empresa tiver essa info)
    NUM_UNID: company?.num_units || "",
    NUM_UF: company?.num_states || "",
  };

  // Adicionar variáveis customizadas do documento
  if (document?.variables && typeof document.variables === "object") {
    Object.assign(variables, document.variables);
  }

  // Adicionar variáveis customizadas da proposta
  if (proposal?.metadata && typeof proposal.metadata === "object") {
    Object.assign(variables, proposal.metadata);
  }

  return variables;
}

/**
 * Valida se todas as variáveis obrigatórias estão presentes
 */
export function validateRequiredVariables(
  variables: Record<string, any>,
  requiredVars: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const value = variables[varName];
    if (value === null || value === undefined || value === "") {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Obtém lista de todas as variáveis disponíveis com descrições
 */
export function getAvailableVariables(): Array<{ key: string; description: string; category: string }> {
  return [
    // Cliente
    { key: "NOME_CLIENTE", description: "Nome do cliente", category: "Cliente" },
    { key: "CPF_CNPJ_CLIENTE", description: "CPF/CNPJ do cliente", category: "Cliente" },
    { key: "RG_CLIENTE", description: "RG do Cliente", category: "Cliente" },
    { key: "ENDE_CLIENTE", description: "Endereço completo do cliente", category: "Cliente" },
    { key: "RUA_CLIENTE", description: "Rua + número do cliente", category: "Cliente" },
    { key: "BAIRRO_CLIENTE", description: "Bairro do cliente", category: "Cliente" },
    { key: "CIDADE_CLIENTE", description: "Cidade do cliente", category: "Cliente" },
    { key: "UF_CLIENTE", description: "UF do cliente", category: "Cliente" },
    { key: "CEP_CLIENTE", description: "CEP do cliente", category: "Cliente" },
    { key: "CELULAR_CLIENTE", description: "Celular do cliente", category: "Cliente" },
    { key: "EMAIL_CLIENTE", description: "E-mail do cliente", category: "Cliente" },

    // Proposta
    { key: "NUM_PROPOSTA", description: "Número da proposta", category: "Proposta" },
    { key: "DATA_CRIACAO_ORCAMENTO", description: "Data de criação do orçamento", category: "Proposta" },
    { key: "DATA_ATUAL", description: "Data atual", category: "Proposta" },
    { key: "DATA_HOJE", description: "Data de hoje", category: "Proposta" },
    { key: "DATA_ATUAL_EXTENSO", description: "Data atual por extenso", category: "Proposta" },
    { key: "VALID_PROP", description: "Validade da proposta", category: "Proposta" },

    // Vendedor
    { key: "NOME_VENDEDOR", description: "Nome do vendedor/consultor", category: "Vendedor" },
    { key: "CELULAR_VENDEDOR", description: "Celular do vendedor", category: "Vendedor" },

    // Empresa
    { key: "NOME_EMPRESA_DOC", description: "Nome empresa + CPF/CNPJ", category: "Empresa" },
    { key: "NOME_FANTASIA", description: "Nome fantasia da empresa", category: "Empresa" },
    { key: "ENDE_EMPRESA", description: "Endereço da empresa", category: "Empresa" },
    { key: "FONE_EMPRESA", description: "Telefone da empresa", category: "Empresa" },
    { key: "EMAIL_EMPRESA", description: "E-mail da empresa", category: "Empresa" },
    { key: "NOME_COMARCA", description: "Comarca da empresa", category: "Empresa" },
    { key: "LATITUDE", description: "Latitude", category: "Empresa" },
    { key: "LONGITUDE", description: "Longitude", category: "Empresa" },

    // Valores
    { key: "VAL_INVEST", description: "Valor do investimento", category: "Valores" },
    { key: "POR_EXTENSO", description: "Valor por extenso", category: "Valores" },
    { key: "VALOR_POR_WP", description: "Valor por Wp", category: "Valores" },

    // Solar - Garantias
    { key: "GARAN_PAINEL", description: "Garantia dos painéis", category: "Solar" },
    { key: "GARAN_ESTRU", description: "Garantia da estrutura", category: "Solar" },
    { key: "GARAN_SERVI", description: "Garantia do serviço", category: "Solar" },
    { key: "GARAN_INVER", description: "Garantia do inversor", category: "Solar" },

    // Solar - Projeto
    { key: "CLASSE_PROJ", description: "Classe do projeto (M, B, T)", category: "Solar" },
    { key: "POT_PAINEL", description: "Potência do painel", category: "Solar" },
    { key: "POT_TOTAL", description: "Potência total do sistema", category: "Solar" },
    { key: "NUM_PAINEL", description: "Número de painéis", category: "Solar" },
    { key: "AREA_TOTAL", description: "Área necessária", category: "Solar" },
    { key: "ESPECIFICACAO_PAINEL", description: "Especificação do painel", category: "Solar" },
    { key: "ESPECIFICACAO_INVERSOR", description: "Especificação do inversor", category: "Solar" },

    // Solar - Produção
    { key: "PRODU_MEDIA", description: "Produção média mensal", category: "Solar" },
    { key: "PRODU_ANUAL", description: "Produção média anual", category: "Solar" },
    { key: "CONSU_MEDIO", description: "Consumo médio mensal", category: "Solar" },
    { key: "CONSU_ANUAL", description: "Consumo médio anual", category: "Solar" },

    // Solar - Retorno
    { key: "ANO_PAYBACK", description: "Payback em anos", category: "Solar" },
    { key: "MES_PAYBACK", description: "Payback em meses", category: "Solar" },
    { key: "TIR", description: "Taxa Interna de Retorno", category: "Solar" },
    { key: "VPL", description: "Valor Presente Líquido", category: "Solar" },

    // Pagamento
    { key: "CONDICAO_PAGAMENTO", description: "Condição de pagamento", category: "Pagamento" },
    { key: "FORMA_PAGAMENTO", description: "Forma de pagamento", category: "Pagamento" },
    
    // Financiamento
    { key: "FINANC_BANCO", description: "Nome do banco financiador", category: "Financiamento" },
    { key: "FINANC_PARCELAS", description: "Número de parcelas", category: "Financiamento" },
    { key: "FINANC_VALOR_PARCELA", description: "Valor da parcela (R$)", category: "Financiamento" },
    { key: "FINANC_TAXA_JUROS", description: "Taxa de juros mensal (%)", category: "Financiamento" },
    { key: "FINANC_VALOR_TOTAL", description: "Valor total financiado (R$)", category: "Financiamento" },
    { key: "FINANC_VALOR_ENTRADA", description: "Valor da entrada (R$)", category: "Financiamento" },
    { key: "FINANC_CET", description: "Custo Efetivo Total (%)", category: "Financiamento" },
    { key: "FINANC_IOF", description: "Valor do IOF (R$)", category: "Financiamento" },
    { key: "FINANC_TIPO", description: "Tipo de financiamento (CDC, etc)", category: "Financiamento" },
    { key: "FINANC_PRIMEIRA_PARCELA", description: "Data primeira parcela", category: "Financiamento" },
    { key: "FINANC_PARCELA_EXTENSO", description: "Valor da parcela por extenso", category: "Financiamento" },
    { key: "FINANC_TOTAL_EXTENSO", description: "Valor total por extenso", category: "Financiamento" },

    // Outros
    { key: "CIDADE_DATA", description: "Cidade e data atual", category: "Outros" },
    { key: "OBS_PROPOSTA", description: "Observação da proposta", category: "Outros" },
    { key: "LOCAL_INSTA", description: "Local da instalação", category: "Outros" },
    { key: "NUMERO_INSTALACAO", description: "Número da instalação (UC)", category: "Outros" },
  ];
}

/**
 * Mapeamento de dados do banco para formato do gerador Python
 */

import { PythonGeneratorData } from "./python-generator.js";

export interface DatabaseData {
  company?: any;
  customer?: any;
  lead?: any;
  proposal?: any;
  seller?: any;
  items?: any[]; // Adicionar items
}

/**
 * Mapeia dados do banco de dados para formato do gerador Python
 */
export function mapDatabaseToPython(data: DatabaseData): PythonGeneratorData {
  const { company, customer, lead, proposal, seller, items } = data;

  // Cliente ou Lead
  const client = customer || lead || {};

  // Formatar valores monetários
  const formatMoney = (value: any): string => {
    if (value === null || value === undefined) return "R$ 0,00";
    return Number(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Formatar data
  const formatDate = (date: any): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  };

  // Montar dados para o Python
  return {
    // === INFORMAÇÕES DO KIT/PROPOSTA ===
    title: proposal?.title || "",
    
    // === DADOS DO CLIENTE ===
    nome: client.name || "",
    doc: client.cpf_cnpj || client.cpf || "",
    email: client.email || "",
    telefone: client.phone || "",
    endereco: [
      client.street || client.address || "",
      client.neighborhood || "",
      client.city || "",
      client.state || "",
      client.zipcode ? `CEP: ${client.zipcode}` : "",
    ]
      .filter(Boolean)
      .join(", "),

    // === DADOS DA EMPRESA ===
    empresa: company?.name || company?.fantasy_name || "",
    empresa_doc: company?.cnpj || "",
    empresa_endereco: company?.address || "",
    empresa_telefone: company?.phone || "",
    empresa_email: company?.email || "",

    // === DADOS DO VENDEDOR ===
    vendedor: seller?.name || proposal?.seller_name || "",
    vendedor_telefone: seller?.phone || proposal?.seller_phone || "",
    
    // Variáveis adicionais do vendedor (para compatibilidade com template)
    NOME_VENDEDOR: seller?.name || proposal?.seller_name || "",
    CELULAR_VENDEDOR: seller?.phone || proposal?.seller_phone || "",

    // === DADOS DO SISTEMA SOLAR ===
    // ⭐ VALOR DO INVESTIMENTO: 
    // Se houver financiamento: entrada + (parcelas × valor_parcela)
    // Senão: valor total do kit
    valor_investimento: proposal?.financing_total_amount 
      ? (proposal.financing_entry_value || 0) + proposal.financing_total_amount
      : proposal?.total_value || 0,
    potencia: proposal?.solar_total_power || 0,
    num_paineis: proposal?.solar_num_panels
      ? String(proposal.solar_num_panels)
      : "0",
    producao_media: proposal?.solar_monthly_production || 0,
    consumo_medio: proposal?.solar_monthly_consumption || 0,
    tarifa: proposal?.solar_energy_tariff || 0.92,
    payback_anos: proposal?.solar_payback_years || 0,
    // Economia formatada para exibição
    economia_mensal: proposal?.solar_savings_value
      ? formatMoney(proposal.solar_savings_value)
      : "R$ 0,00",
    economia_anual: proposal?.solar_annual_savings
      ? formatMoney(proposal.solar_annual_savings)
      : "R$ 0,00",
    // Economia sem formatação para cálculos do Python
    valor_economia_mensal: proposal?.solar_savings_value || 0,
    // Valores da conta de energia
    valor_conta_atual: proposal?.solar_current_bill_value || 0,
    valor_conta_solar: proposal?.solar_future_bill_value || 100,

    // === SIMULAÇÕES DE FINANCIAMENTO ===
    // Valor de entrada (se houver)
    valor_entrada: proposal?.financing_entry_value || 0,
    simulacoes: proposal?.financing_simulations
      ? proposal.financing_simulations.map((sim: any) => ({
          banco: sim.bank || sim.banco || "",
          parcelas: sim.installments
            ? `${sim.installments}x`
            : sim.parcelas || "",
          valor: sim.installment_value
            ? formatMoney(sim.installment_value)
            : sim.valor || "",
        }))
      : proposal?.financing_bank
      ? [
          {
            banco: proposal.financing_bank || "",
            parcelas: proposal.financing_installments
              ? `${proposal.financing_installments}x`
              : "",
            valor: proposal.financing_installment_value
              ? formatMoney(proposal.financing_installment_value)
              : "",
          },
        ]
      : undefined,

    // === DADOS TÉCNICOS ===
    especificacao_painel: proposal?.solar_panel_spec || "",
    especificacao_inversor: proposal?.solar_inverter_spec || "",
    // ⭐ ESPECIFICACAO_KIT - Python script espera essa chave exata
    ESPECIFICACAO_KIT: proposal?.solar_panel_spec || "",
    // ⭐ AREA_TOTAL - Python script espera 'area' (linha 388 do proposal_generator.py)
    area: proposal?.solar_area_needed ? `${proposal.solar_area_needed} m²` : "0 m²",
    area_necessaria: proposal?.solar_area_needed || 0,
    garantia_painel: proposal?.solar_panel_warranty
      ? `${proposal.solar_panel_warranty} anos`
      : "25 anos",
    garantia_inversor: proposal?.solar_inverter_warranty
      ? `${proposal.solar_inverter_warranty} anos`
      : "10 anos",

    // === LOCALIZAÇÃO ===
    latitude: client.latitude || company?.latitude || "",
    longitude: client.longitude || company?.longitude || "",
    cidade: client.city || company?.city || "",
    estado: client.state || company?.state || "",

    // === DADOS AMBIENTAIS ===
    co2_evitado_anual: proposal?.solar_co2_1year || 0,
    co2_evitado_25anos: proposal?.solar_co2_25years || 0,
    arvores_equivalente: proposal?.solar_co2_trees || 0,

    // === DOCUMENTAÇÃO ===
    num_proposta: proposal?.number || proposal?.id?.substring(0, 8) || "",
    data_proposta: formatDate(proposal?.created_at),
    validade: formatDate(proposal?.valid_until),
    prazo_instalacao: proposal?.installation_days
      ? `${proposal.installation_days} dias`
      : "",
  };
}

/**
 * Valida se os dados mínimos necessários estão presentes
 */
export function validateProposalData(
  data: PythonGeneratorData
): { valid: boolean; missing: string[] } {
  const required = [
    { field: "nome", label: "Nome do cliente" },
    { field: "valor_investimento", label: "Valor do investimento" },
    { field: "empresa", label: "Nome da empresa" },
  ];

  const missing: string[] = [];

  for (const req of required) {
    const value = data[req.field as keyof PythonGeneratorData];
    if (!value || value === "" || value === 0) {
      missing.push(req.label);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

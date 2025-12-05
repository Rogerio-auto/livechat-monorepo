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
    valor_investimento: proposal?.total_value || 0,
    potencia: proposal?.solar_total_power || "",
    num_paineis: proposal?.solar_num_panels
      ? String(proposal.solar_num_panels)
      : "",
    producao_media: proposal?.solar_monthly_production || "",
    consumo_medio: proposal?.solar_monthly_consumption || "",
    tarifa: proposal?.solar_energy_tariff || "",
    payback_anos: proposal?.solar_payback_years || "",
    economia_mensal: proposal?.solar_savings_value
      ? formatMoney(proposal.solar_savings_value)
      : "",
    economia_anual: proposal?.solar_annual_savings
      ? formatMoney(proposal.solar_annual_savings)
      : "",

    // === SIMULAÇÕES DE FINANCIAMENTO ===
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
    area_necessaria: proposal?.solar_area_needed || "",
    garantia_painel: proposal?.solar_panel_warranty
      ? `${proposal.solar_panel_warranty} anos`
      : "",
    garantia_inversor: proposal?.solar_inverter_warranty
      ? `${proposal.solar_inverter_warranty} anos`
      : "",

    // === LOCALIZAÇÃO ===
    latitude: client.latitude || company?.latitude || "",
    longitude: client.longitude || company?.longitude || "",
    cidade: client.city || company?.city || "",
    estado: client.state || company?.state || "",

    // === DADOS AMBIENTAIS ===
    co2_evitado_anual: proposal?.solar_co2_1year || "",
    co2_evitado_25anos: proposal?.solar_co2_25years || "",
    arvores_equivalente: proposal?.solar_co2_trees || "",

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

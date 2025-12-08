/**
 * Utilitários para extrair e calcular dados de kits solares
 */

export interface SolarData {
  // Dados técnicos
  solar_total_power: number;
  solar_num_panels: number | null;
  solar_panel_power: string | null;
  solar_panel_spec: string | null; // Especificação completa do kit
  solar_inverter_spec: string | null;
  solar_area_needed: number | null;
  panel_model: string | null;
  inverter_model: string | null;
  
  // Geração e consumo
  solar_monthly_production: number | null;
  solar_monthly_consumption: number | null;
  solar_annual_production: number | null;
  solar_annual_consumption: number | null;
  
  // Valores financeiros
  solar_current_bill_value: number | null;
  solar_future_bill_value: number;
  solar_savings_value: number | null;
  solar_payback_years: number | null;
  solar_payback_months: number | null;
  
  // Garantias
  solar_panel_warranty: number;
  solar_inverter_warranty: number;
  solar_structure_warranty: number;
  solar_service_warranty: number;
  
  // Tarifa
  solar_energy_tariff: number;
  
  // Ambiental
  solar_co2_1year: number | null;
  solar_co2_25years: number | null;
  solar_co2_trees: number | null;
}

export interface KitData {
  name: string;
  power: string;
  size: string;
  specs?: string | null;
  sale_price?: number | null;
}

/**
 * Extrai o número de painéis e potência do painel das especificações
 */
function extractPanelInfo(specs: string): { numPanels: number | null; panelPower: number | null; panelModel: string | null } {
  if (!specs) return { numPanels: null, panelPower: null, panelModel: null };
  
  // Extrair número de painéis e potência
  // Aceita: "23 PAINEIS 610W", "64 MODULO 610W", "23-PAINÉIS 610W"
  const panelMatch = specs.match(/(\d+)\s*[-–]?\s*(?:PAIN[EÉ]IS?|M[OÓ]DULOS?)\s+.*?(\d+)W/is);
  const numPanels = panelMatch ? parseInt(panelMatch[1]) : null;
  const panelPower = panelMatch ? parseInt(panelMatch[2]) : null;
  
  // Extrair modelo do painel - buscar marca após a potência
  // Ex: "610W BIFACIAL SERAPHIM" -> "SERAPHIM"
  // Ex: "450W CANADIAN SOLAR" -> "CANADIAN SOLAR"
  let panelModel: string | null = null;
  
  if (panelPower) {
    // Buscar texto após a potência até encontrar "TIER", número ou quebra de linha
    const afterPowerMatch = specs.match(new RegExp(`${panelPower}W\\s+(?:BIFACIAL\\s+)?([A-Z][A-Z\\s]+?)(?:\\s+TIER|\\s*\\d|\\n|$)`, 'i'));
    if (afterPowerMatch) {
      panelModel = afterPowerMatch[1].trim().replace(/\s{2,}/g, ' ');
    }
  }
  
  return { numPanels, panelPower, panelModel };
}

/**
 * Extrai informações do inversor das especificações
 */
function extractInverterInfo(specs: string): { inverterModel: string | null } {
  if (!specs) return { inverterModel: null };
  
  // Extrair modelo do inversor (ex: "INVERSOR SOLAR NANSEN 10000W")
  const inverterMatch = specs.match(/INVERSOR\s+SOLAR\s+([A-Z]+)\s+(\d+(?:KW|W))/i);
  const inverterModel = inverterMatch ? `${inverterMatch[1]} ${inverterMatch[2]}` : null;
  
  return { inverterModel };
}

/**
 * Extrai a geração mensal estimada do nome do kit
 */
function extractMonthlyGeneration(kitName: string): number | null {
  // Procurar por padrões como "1500KWH", "1500 KWH", "4.200 KWH", "1.500KWH"
  const generationMatch = kitName.match(/(\d+\.?\d*)(?:\s+)?(?:KMH|KWH)/i);
  if (!generationMatch) return null;
  
  // Remover ponto de milhar e converter para número
  const value = generationMatch[1].replace('.', '');
  return parseInt(value);
}

/**
 * Calcula todos os dados solares baseado no kit selecionado
 */
export function calculateSolarData(kit: KitData, totalValue: number, monthlyConsumption?: number): SolarData {
  // Extrair informações das especificações
  const { numPanels, panelPower, panelModel } = extractPanelInfo(kit.specs || "");
  const { inverterModel } = extractInverterInfo(kit.specs || "");
  const monthlyGeneration = extractMonthlyGeneration(kit.name);
  
  // Calcular potência total em kW
  const totalPowerKw = parseFloat(kit.power) / 1000;
  
  // Calcular área necessária
  const areaNeeded = kit.size ? parseFloat(kit.size) : null;
  
  // Usar consumo informado pelo cliente (prioritário) ou estimar se não informado
  const actualConsumption = monthlyConsumption || (monthlyGeneration ? Math.floor(monthlyGeneration * 0.9) : null);
  
  // Calcular valores financeiros
  const energyTariff = 0.92; // R$/kWh (ajustar conforme necessário)
  // ⭐ CONTA ATUAL: usar consumo REAL do cliente (não estimado)
  const currentBillValue = actualConsumption ? actualConsumption * energyTariff : null;
  const futureBillValue = 100; // Custo mínimo da conta (taxa de disponibilidade)
  const savingsValue = currentBillValue ? currentBillValue - futureBillValue : null;
  
  // Calcular payback
  const paybackYears = totalValue && savingsValue ? Math.round(totalValue / (savingsValue * 12)) : null;
  const paybackMonths = paybackYears ? paybackYears * 12 : null;
  
  // Calcular produções anuais
  const annualProduction = monthlyGeneration ? monthlyGeneration * 12 : null;
  const annualConsumption = actualConsumption ? actualConsumption * 12 : null;
  
  // Calcular CO2 evitado (aproximação: 0.6 kg CO2 por kWh)
  const co2_1year = annualProduction ? parseFloat((annualProduction * 0.0006).toFixed(2)) : null;
  const co2_25years = annualProduction ? parseFloat((annualProduction * 25 * 0.0006).toFixed(2)) : null;
  const co2_trees = annualProduction ? Math.floor(annualProduction * 25 * 0.02) : null;
  
  // Criar especificação detalhada do painel a partir do specs completo
  let panelSpecDetail: string | null = null;
  const specsText = kit.specs || "";
  
  if (specsText && numPanels && panelPower) {
    console.log("[solarDataExtractor] 📋 Tentando extrair especificação do painel...");
    console.log("[solarDataExtractor] specs:", specsText);
    console.log("[solarDataExtractor] numPanels:", numPanels);
    console.log("[solarDataExtractor] panelPower:", panelPower);
    
    // Extrair a linha completa do painel (ex: "23 PAINEIS MONOCRISTALINO 610W BIFACIAL SERAPHIM TIER 1")
    const panelLineMatch = specsText.match(/(\d+)\s*[-–]?\s*PAIN[EÉ]IS?\s+[^\n]+/i);
    console.log("[solarDataExtractor] panelLineMatch:", panelLineMatch);
    
    if (panelLineMatch) {
      panelSpecDetail = panelLineMatch[0].trim();
      console.log("[solarDataExtractor] ✅ panelSpecDetail extraído:", panelSpecDetail);
    } else {
      console.log("[solarDataExtractor] ⚠️ Regex não encontrou match");
    }
  } else {
    console.log("[solarDataExtractor] ⚠️ Condições não atendidas:");
    console.log("[solarDataExtractor] specs existe?", !!specsText);
    console.log("[solarDataExtractor] numPanels existe?", !!numPanels);
    console.log("[solarDataExtractor] panelPower existe?", !!panelPower);
  }
  
  // ⭐ USAR solar_panel_spec para armazenar texto COMPLETO do kit
  const fullKitSpec = kit.specs || null;
  console.log("[solarDataExtractor] 📦 solar_panel_spec (texto completo do kit):", fullKitSpec);
  
  return {
    // Dados técnicos
    solar_total_power: totalPowerKw,
    solar_num_panels: numPanels,
    solar_panel_power: panelPower !== null ? String(panelPower) : null, // Converter número para string
    solar_panel_spec: fullKitSpec, // ⭐ Texto completo das especificações
    solar_inverter_spec: inverterModel,
    solar_area_needed: areaNeeded,
    panel_model: panelModel,
    inverter_model: inverterModel,
    
    // Geração e consumo
    solar_monthly_production: monthlyGeneration,
    solar_monthly_consumption: actualConsumption, // ⭐ Consumo REAL do cliente
    solar_annual_production: annualProduction,
    solar_annual_consumption: annualConsumption,
    
    // Valores financeiros
    solar_current_bill_value: currentBillValue,
    solar_future_bill_value: futureBillValue,
    solar_savings_value: savingsValue,
    solar_payback_years: paybackYears,
    solar_payback_months: paybackMonths,
    
    // Garantias padrão
    solar_panel_warranty: 25,
    solar_inverter_warranty: 10,
    solar_structure_warranty: 10,
    solar_service_warranty: 1,
    
    // Tarifa
    solar_energy_tariff: energyTariff,
    
    // Ambiental
    solar_co2_1year: co2_1year,
    solar_co2_25years: co2_25years,
    solar_co2_trees: co2_trees,
  };
}

/**
 * Formata os dados solares para envio à API
 */
export function formatSolarDataForAPI(solarData: SolarData): Record<string, any> {
  return {
    // Dados técnicos
    solar_total_power: solarData.solar_total_power,
    solar_num_panels: solarData.solar_num_panels,
    solar_panel_power: solarData.solar_panel_power,
    solar_panel_spec: solarData.solar_panel_spec, // ⭐ Texto completo do kit
    solar_inverter_spec: solarData.solar_inverter_spec,
    solar_area_needed: solarData.solar_area_needed,
    panel_model: solarData.panel_model,
    inverter_model: solarData.inverter_model,
    
    // Geração e consumo
    solar_monthly_production: solarData.solar_monthly_production,
    solar_monthly_consumption: solarData.solar_monthly_consumption,
    solar_annual_production: solarData.solar_annual_production,
    solar_annual_consumption: solarData.solar_annual_consumption,
    
    // Valores financeiros
    solar_current_bill_value: solarData.solar_current_bill_value,
    solar_future_bill_value: solarData.solar_future_bill_value,
    solar_savings_value: solarData.solar_savings_value,
    solar_payback_years: solarData.solar_payback_years,
    solar_payback_months: solarData.solar_payback_months,
    
    // Garantias
    solar_panel_warranty: solarData.solar_panel_warranty,
    solar_inverter_warranty: solarData.solar_inverter_warranty,
    solar_structure_warranty: solarData.solar_structure_warranty,
    solar_service_warranty: solarData.solar_service_warranty,
    
    // Tarifa
    solar_energy_tariff: solarData.solar_energy_tariff,
    
    // Ambiental
    solar_co2_1year: solarData.solar_co2_1year,
    solar_co2_25years: solarData.solar_co2_25years,
    solar_co2_trees: solarData.solar_co2_trees,
  };
}

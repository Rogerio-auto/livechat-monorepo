/**
 * Utilitários para extrair e calcular dados de kits solares
 */

export interface SolarData {
  // Dados técnicos
  solar_total_power: number;
  solar_num_panels: number | null;
  solar_panel_power: string | null;
  solar_panel_spec: string | null;
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
  
  // Extrair número de painéis e potência (ex: "23 PAINEIS MONOCRISTALINO 610W")
  const panelMatch = specs.match(/(\d+)\s*[-–]\s*PAINÉIS?\s+.*?(\d+)W/is);
  const numPanels = panelMatch ? parseInt(panelMatch[1]) : null;
  const panelPower = panelMatch ? parseInt(panelMatch[2]) : null;
  
  // Extrair modelo do painel (ex: "SERAPHIM", "CANADIAN", "JINKO")
  const panelModelMatch = specs.match(/PAINÉIS?\s+(?:MONOCRISTALINO|POLICRISTALINO)?\s*\d+W\s+.*?([A-Z][A-Z\s]+?)(?:\s+TIER|\s+\d|$)/is);
  const panelModel = panelModelMatch ? panelModelMatch[1].trim().split(/\s{2,}/)[0] : null;
  
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
  // Procurar por padrões como "1500KWH" ou "1500KMH"
  const generationMatch = kitName.match(/(\d+)(?:KMH|KWH)/i);
  return generationMatch ? parseInt(generationMatch[1]) : null;
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
  
  // Calcular consumo estimado (90% da geração)
  const estimatedConsumption = monthlyGeneration ? Math.floor(monthlyGeneration * 0.9) : (monthlyConsumption || null);
  
  // Calcular valores financeiros
  const energyTariff = 0.92; // R$/kWh (ajustar conforme necessário)
  const currentBillValue = estimatedConsumption ? estimatedConsumption * energyTariff : null;
  const futureBillValue = 100; // Custo mínimo da conta
  const savingsValue = currentBillValue ? currentBillValue - futureBillValue : null;
  
  // Calcular payback
  const paybackYears = totalValue && savingsValue ? Math.round(totalValue / (savingsValue * 12)) : null;
  const paybackMonths = paybackYears ? paybackYears * 12 : null;
  
  // Calcular produções anuais
  const annualProduction = monthlyGeneration ? monthlyGeneration * 12 : null;
  const annualConsumption = estimatedConsumption ? estimatedConsumption * 12 : null;
  
  // Calcular CO2 evitado (aproximação: 0.6 kg CO2 por kWh)
  const co2_1year = annualProduction ? parseFloat((annualProduction * 0.0006).toFixed(2)) : null;
  const co2_25years = annualProduction ? parseFloat((annualProduction * 25 * 0.0006).toFixed(2)) : null;
  const co2_trees = annualProduction ? Math.floor(annualProduction * 25 * 0.02) : null;
  
  return {
    // Dados técnicos
    solar_total_power: totalPowerKw,
    solar_num_panels: numPanels,
    solar_panel_power: panelPower ? `${panelPower}W` : null,
    solar_panel_spec: panelPower ? `Painel ${panelModel || 'Genérico'} ${panelPower}W` : null,
    solar_inverter_spec: inverterModel,
    solar_area_needed: areaNeeded,
    panel_model: panelModel,
    inverter_model: inverterModel,
    
    // Geração e consumo
    solar_monthly_production: monthlyGeneration,
    solar_monthly_consumption: estimatedConsumption,
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
    solar_panel_spec: solarData.solar_panel_spec,
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

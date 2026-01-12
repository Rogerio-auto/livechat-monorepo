// Configuração do catálogo de produtos/serviços por nicho de empresa

import { Industry } from "@livechat/shared";

export type CatalogFieldKey = 
  | 'name' | 'description' | 'sku' | 'unit' | 'item_type' | 'image_url'
  | 'cost_price' | 'sale_price' | 'duration_minutes' | 'billing_type'
  | 'brand' | 'grouping' | 'power' | 'size' | 'supplier' 
  | 'status' | 'specs';

export interface CatalogConfig {
  // Campos visíveis no formulário de criação/edição
  visibleFields: CatalogFieldKey[];
  
  // Campos obrigatórios
  requiredFields: CatalogFieldKey[];
  
  // Colunas visíveis na tabela
  tableColumns: CatalogFieldKey[];
  
  // Opções de item_type disponíveis
  itemTypeOptions: Array<{ value: string; label: string }>;
  
  // Features habilitadas/desabilitadas
  features: {
    xlsxImport: boolean;        // Permite importar planilhas
    technicalSpecs: boolean;     // Mostra campos técnicos avançados
    costPrice: boolean;          // Mostra preço de custo
    supplierManagement: boolean; // Gerencia fornecedores
    durationTracking: boolean;   // Rastreia duração (serviços)
    billingConfig: boolean;      // Configuração de cobrança
  };
  
  // Labels customizados por nicho
  labels: {
    pageTitle: string;
    pageDescription: string;
    addButton: string;
    itemName: string;           // "Produto", "Serviço", "Imóvel", etc
    itemNamePlural: string;
  };
  
  // Placeholders customizados
  placeholders: {
    name: string;
    description: string;
    specs: string;
    unit: string;
  };
  
  // Overrides de labels de campos (opcional)
  fieldLabels?: Partial<Record<CatalogFieldKey, string>>;
}

export const CATALOG_CONFIGS: Record<Industry, CatalogConfig> = {
  solar_energy: {
    visibleFields: [
      'image_url', 'name', 'item_type', 'brand', 'power', 'size', 'supplier', 
      'unit', 'sku', 'cost_price', 'sale_price', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type'],
    tableColumns: ['image_url', 'name', 'brand', 'power', 'specs', 'sale_price', 'cost_price'],
    itemTypeOptions: [
      { value: 'PRODUCT', label: 'Produto' }
    ],
    features: {
      xlsxImport: true,
      technicalSpecs: true,
      costPrice: true,
      supplierManagement: true,
      durationTracking: false,
      billingConfig: false
    },
    labels: {
      pageTitle: 'Produtos',
      pageDescription: 'Gerencie equipamentos, painéis, inversores e acessórios de energia solar',
      addButton: '+ Novo Produto',
      itemName: 'Produto',
      itemNamePlural: 'Produtos'
    },
    placeholders: {
      name: 'Ex: Painel Solar 550W Jinko',
      description: 'Descrição detalhada do equipamento',
      specs: 'Tensão, corrente, eficiência, dimensões',
      unit: 'unidade, kit, conjunto'
    },
    fieldLabels: {
      power: 'Potência (Wp)',
      size: 'Dimensões/Área',
      grouping: 'Categoria de Equipamento'
    }
  },
  
  construction: {
    visibleFields: [
      'name', 'item_type', 'brand', 'supplier', 'unit', 
      'sku', 'cost_price', 'sale_price', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'unit'],
    tableColumns: ['name', 'unit', 'brand', 'specs', 'sale_price', 'cost_price'],
    itemTypeOptions: [
      { value: 'PRODUCT', label: 'Material' },
      { value: 'SERVICE', label: 'Mão de Obra' }
    ],
    features: {
      xlsxImport: true,
      technicalSpecs: false,
      costPrice: true,
      supplierManagement: true,
      durationTracking: false,
      billingConfig: false
    },
    labels: {
      pageTitle: 'Materiais e Serviços',
      pageDescription: 'Gerencie materiais de construção e serviços de mão de obra',
      addButton: '+ Novo Item',
      itemName: 'Item',
      itemNamePlural: 'Itens'
    },
    placeholders: {
      name: 'Ex: Cimento CP-II 50kg',
      description: 'Características do material ou serviço',
      specs: 'Especificações técnicas, resistência, aplicação',
      unit: 'kg, m³, m², unidade, diária'
    }
  },
  
  real_estate: {
    visibleFields: [
      'image_url', 'name', 'item_type', 'size', 'billing_type', 
      'sale_price', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'size', 'billing_type', 'sale_price'],
    tableColumns: ['image_url', 'name', 'size', 'billing_type', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'PRODUCT', label: 'Imóvel' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: false,
      billingConfig: true
    },
    labels: {
      pageTitle: 'Catálogo de Imóveis',
      pageDescription: 'Gerencie propriedades para venda e locação',
      addButton: '+ Novo Imóvel',
      itemName: 'Imóvel',
      itemNamePlural: 'Imóveis'
    },
    placeholders: {
      name: 'Ex: Apartamento 2 quartos Centro',
      description: 'Características do imóvel',
      specs: 'Endereço completo, bairro, características (quartos, vagas, área útil)',
      unit: 'unidade'
    }
  },
  
  education: {
    visibleFields: [
      'name', 'item_type', 'duration_minutes', 'billing_type', 
      'sale_price', 'unit', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'sale_price'],
    tableColumns: ['name', 'duration_minutes', 'billing_type', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'SERVICE', label: 'Curso' },
      { value: 'SUBSCRIPTION', label: 'Assinatura' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: true,
      billingConfig: true
    },
    labels: {
      pageTitle: 'Cursos e Serviços',
      pageDescription: 'Gerencie cursos, workshops, mentorias e assinaturas',
      addButton: '+ Novo Curso',
      itemName: 'Curso',
      itemNamePlural: 'Cursos'
    },
    placeholders: {
      name: 'Ex: Curso Python Avançado',
      description: 'Descrição do curso',
      specs: 'Conteúdo programático, pré-requisitos, certificação',
      unit: 'hora-aula, mês, curso completo'
    }
  },
  
  accounting: {
    visibleFields: [
      'name', 'item_type', 'duration_minutes', 'billing_type', 
      'sale_price', 'unit', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'sale_price'],
    tableColumns: ['name', 'billing_type', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'SERVICE', label: 'Serviço Contábil' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: true,
      billingConfig: true
    },
    labels: {
      pageTitle: 'Serviços Contábeis',
      pageDescription: 'Gerencie serviços e pacotes contábeis oferecidos',
      addButton: '+ Novo Serviço',
      itemName: 'Serviço',
      itemNamePlural: 'Serviços'
    },
    placeholders: {
      name: 'Ex: Declaração de Imposto de Renda',
      description: 'Descrição do serviço',
      specs: 'Documentos necessários, prazo de entrega, incluso no serviço',
      unit: 'declaração, mês, ano'
    }
  },
  
  clinic: {
    visibleFields: [
      'name', 'item_type', 'duration_minutes', 
      'sale_price', 'unit', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'sale_price'],
    tableColumns: ['name', 'duration_minutes', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'SERVICE', label: 'Procedimento/Consulta' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: true,
      billingConfig: false
    },
    labels: {
      pageTitle: 'Procedimentos e Consultas',
      pageDescription: 'Gerencie procedimentos médicos, consultas e exames',
      addButton: '+ Novo Procedimento',
      itemName: 'Procedimento',
      itemNamePlural: 'Procedimentos'
    },
    placeholders: {
      name: 'Ex: Consulta Cardiologia',
      description: 'Descrição do procedimento',
      specs: 'Especialidade, preparação necessária, observações',
      unit: 'consulta, sessão, procedimento'
    }
  },
  
  events: {
    visibleFields: [
      'name', 'item_type', 'size', 'duration_minutes', 
      'sale_price', 'unit', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'sale_price'],
    tableColumns: ['name', 'size', 'duration_minutes', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'SERVICE', label: 'Serviço' },
      { value: 'PRODUCT', label: 'Item Alugado' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: true,
      billingConfig: false
    },
    labels: {
      pageTitle: 'Pacotes e Serviços',
      pageDescription: 'Gerencie pacotes de buffet, decoração e entretenimento',
      addButton: '+ Novo Pacote',
      itemName: 'Pacote',
      itemNamePlural: 'Pacotes'
    },
    placeholders: {
      name: 'Ex: Buffet Premium 100 pessoas',
      description: 'Descrição do pacote',
      specs: 'O que está incluso: comidas, bebidas, decoração, staff',
      unit: 'evento, pessoa, hora'
    }
  },
  
  law: {
    visibleFields: [
      'name', 'item_type', 'duration_minutes', 'billing_type', 
      'sale_price', 'unit', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'billing_type', 'sale_price'],
    tableColumns: ['name', 'billing_type', 'specs', 'sale_price'],
    itemTypeOptions: [
      { value: 'SERVICE', label: 'Serviço Jurídico' }
    ],
    features: {
      xlsxImport: false,
      technicalSpecs: false,
      costPrice: false,
      supplierManagement: false,
      durationTracking: true,
      billingConfig: true
    },
    labels: {
      pageTitle: 'Serviços Jurídicos',
      pageDescription: 'Gerencie serviços e honorários advocatícios',
      addButton: '+ Novo Serviço',
      itemName: 'Serviço',
      itemNamePlural: 'Serviços'
    },
    placeholders: {
      name: 'Ex: Ação Trabalhista',
      description: 'Descrição do serviço jurídico',
      specs: 'Etapas do processo, documentos necessários, prazos',
      unit: 'processo, hora, consulta'
    }
  },
  
  retail: {
    visibleFields: [
      'image_url', 'name', 'item_type', 'brand', 'unit', 'sku', 
      'cost_price', 'sale_price', 'grouping', 'status', 'specs'
    ],
    requiredFields: ['name', 'item_type', 'sale_price'],
    tableColumns: ['image_url', 'name', 'brand', 'sku', 'sale_price', 'status'],
    itemTypeOptions: [
      { value: 'PRODUCT', label: 'Produto' }
    ],
    features: {
      xlsxImport: true,
      technicalSpecs: false,
      costPrice: true,
      supplierManagement: true,
      durationTracking: false,
      billingConfig: false
    },
    labels: {
      pageTitle: 'Produtos',
      pageDescription: 'Gerencie seu estoque de produtos e mercadorias',
      addButton: '+ Novo Produto',
      itemName: 'Produto',
      itemNamePlural: 'Produtos'
    },
    placeholders: {
      name: 'Ex: Camiseta Algodão G',
      description: 'Descrição do produto',
      specs: 'Cor, material, dimensões, peso',
      unit: 'unidade, peça, par'
    }
  }
};

// Helper para obter configuração com fallback
export function getCatalogConfig(industry?: Industry): CatalogConfig {
  if (!industry || !CATALOG_CONFIGS[industry]) {
    return CATALOG_CONFIGS.solar_energy; // Fallback para energia solar
  }
  return CATALOG_CONFIGS[industry];
}

// Helper para verificar se um campo está visível
export function isFieldVisible(field: CatalogFieldKey, industry?: Industry): boolean {
  const config = getCatalogConfig(industry);
  return config.visibleFields.includes(field);
}

// Helper para verificar se um campo é obrigatório
export function isFieldRequired(field: CatalogFieldKey, industry?: Industry): boolean {
  const config = getCatalogConfig(industry);
  return config.requiredFields.includes(field);
}

// Helper para obter o label de um campo (com override por nicho)
export function getFieldLabel(field: CatalogFieldKey, industry?: Industry): string {
  const config = getCatalogConfig(industry);
  if (config.fieldLabels && config.fieldLabels[field]) {
    return config.fieldLabels[field]!;
  }
  return FIELD_LABELS[field];
}

// Labels de campos traduzidos (padrão)
export const FIELD_LABELS: Record<CatalogFieldKey, string> = {
  name: 'Nome',
  description: 'Descrição',
  sku: 'Código/SKU',
  unit: 'Unidade',
  item_type: 'Tipo',
  cost_price: 'Preço de Custo',
  sale_price: 'Preço de Venda',
  duration_minutes: 'Duração (minutos)',
  billing_type: 'Tipo de Cobrança',
  brand: 'Marca',
  grouping: 'Agrupamento/Categoria',
  power: 'Potência',
  size: 'Tamanho/Área',
  supplier: 'Fornecedor',
  status: 'Status',
  specs: 'Especificações',
  image_url: 'URL da Imagem'
};

// Tipos para o sistema de onboarding

export type Industry = 
  | "education"    // Educação
  | "accounting"   // Contabilidade
  | "clinic"       // Clínicas
  | "retail"       // Varejo
  | "events"       // Eventos
  | "law";         // Advocacia

export type TeamSize = "1-5" | "6-15" | "16-50" | "50+";

export interface OnboardingStatus {
  industry?: Industry;
  team_size?: TeamSize;
  completed: boolean;
  current_step: number;
  data: Record<string, any>;
}

export interface OnboardingStep1Data {
  industry: Industry;
}

export interface OnboardingStep2Data {
  company_name: string;
  city: string;
  state: string;
  team_size: TeamSize;
  main_challenge: string;
}

export interface OnboardingStep3Data {
  wants_ai_agent: boolean;
  wants_templates: boolean;
  wants_catalog: boolean;
}

export interface IndustryConfig {
  industry: Industry;
  agent_name: string;
  custom_fields: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
  }>;
  enabled_modules: string[];
  templates_count: number;
}

export interface OnboardingCompleteResponse {
  success: boolean;
  message: string;
  config: {
    industry: Industry;
    agent_created: boolean;
    modules_enabled: string[];
  };
}

// Metadata dos nichos
export interface IndustryMetadata {
  id: Industry;
  name: string;
  icon: string; // Nome do ícone do react-icons
  color: string;
  description: string;
  features: string[];
}

export const INDUSTRIES: IndustryMetadata[] = [
  {
    id: "education",
    name: "Educação",
    icon: "FaGraduationCap",
    color: "#3B82F6", // blue-500
    description: "Escolas, cursos e treinamentos",
    features: ["Calendário de aulas", "Catálogo de cursos", "Aulas experimentais"],
  },
  {
    id: "accounting",
    name: "Contabilidade",
    icon: "FaChartLine",
    color: "#10B981", // green-500
    description: "Escritórios contábeis e consultorias",
    features: ["Gestão de documentos", "Prazos fiscais", "Agendamento de consultorias"],
  },
  {
    id: "clinic",
    name: "Clínicas",
    icon: "FaHospital",
    color: "#EF4444", // red-500
    description: "Clínicas médicas e consultórios",
    features: ["Agendamento de consultas", "Cadastro de procedimentos", "Lembretes automáticos"],
  },
  {
    id: "retail",
    name: "Varejo",
    icon: "FaShoppingCart",
    color: "#F59E0B", // amber-500
    description: "Lojas e comércios",
    features: ["Catálogo de produtos", "Controle de estoque", "Geração de orçamentos"],
  },
  {
    id: "events",
    name: "Eventos",
    icon: "FaCalendarAlt",
    color: "#8B5CF6", // violet-500
    description: "Buffets e organizadores de eventos",
    features: ["Calendário de eventos", "Pacotes personalizados", "Orçamentos detalhados"],
  },
  {
    id: "law",
    name: "Advocacia",
    icon: "FaBalanceScale",
    color: "#6366F1", // indigo-500
    description: "Escritórios de advocacia",
    features: ["Gestão de documentos", "Agendamento de consultas", "Acompanhamento de processos"],
  },
];

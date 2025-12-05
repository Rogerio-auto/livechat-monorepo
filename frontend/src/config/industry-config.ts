// Tipos e constantes para gerenciamento de Industry no Admin

import { Industry } from "../types/onboarding";
import { FaSolarPanel, FaHardHat, FaHome, FaGraduationCap, FaCalculator, FaStethoscope, FaGlassCheers, FaBalanceScale } from "react-icons/fa";
import { IconType } from "react-icons";

export interface IndustryConfig {
  value: Industry;
  label: string;
  icon: IconType;
  color: {
    bg: string;
    text: string;
    border: string;
  };
  description: string;
}

export const INDUSTRY_CONFIGS: Record<Industry, IndustryConfig> = {
  solar_energy: {
    value: "solar_energy",
    label: "Energia Solar",
    icon: FaSolarPanel,
    color: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-800 dark:text-amber-200",
      border: "border-amber-300 dark:border-amber-700",
    },
    description: "Empresas de instalação e consultoria em energia solar fotovoltaica",
  },
  construction: {
    value: "construction",
    label: "Construção Civil",
    icon: FaHardHat,
    color: {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      text: "text-orange-800 dark:text-orange-200",
      border: "border-orange-300 dark:border-orange-700",
    },
    description: "Construtoras, reformas e materiais de construção",
  },
  real_estate: {
    value: "real_estate",
    label: "Imobiliário",
    icon: FaHome,
    color: {
      bg: "bg-teal-100 dark:bg-teal-900/30",
      text: "text-teal-800 dark:text-teal-200",
      border: "border-teal-300 dark:border-teal-700",
    },
    description: "Imobiliárias, corretagem e gestão de imóveis",
  },
  education: {
    value: "education",
    label: "Educação",
    icon: FaGraduationCap,
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-800 dark:text-blue-200",
      border: "border-blue-300 dark:border-blue-700",
    },
    description: "Escolas, cursos, treinamentos e educação online",
  },
  accounting: {
    value: "accounting",
    label: "Contabilidade",
    icon: FaCalculator,
    color: {
      bg: "bg-purple-100 dark:bg-purple-900/30",
      text: "text-purple-800 dark:text-purple-200",
      border: "border-purple-300 dark:border-purple-700",
    },
    description: "Escritórios de contabilidade e consultoria fiscal",
  },
  clinic: {
    value: "clinic",
    label: "Clínica/Saúde",
    icon: FaStethoscope,
    color: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-800 dark:text-emerald-200",
      border: "border-emerald-300 dark:border-emerald-700",
    },
    description: "Clínicas médicas, odontológicas e serviços de saúde",
  },
  events: {
    value: "events",
    label: "Eventos",
    icon: FaGlassCheers,
    color: {
      bg: "bg-pink-100 dark:bg-pink-900/30",
      text: "text-pink-800 dark:text-pink-200",
      border: "border-pink-300 dark:border-pink-700",
    },
    description: "Organização de eventos, buffets e decoração",
  },
  law: {
    value: "law",
    label: "Advocacia",
    icon: FaBalanceScale,
    color: {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-800 dark:text-gray-200",
      border: "border-gray-300 dark:border-gray-600",
    },
    description: "Escritórios de advocacia e serviços jurídicos",
  },
};

// Array ordenado para usar em selects
export const INDUSTRY_OPTIONS = Object.values(INDUSTRY_CONFIGS).sort((a, b) => 
  a.label.localeCompare(b.label)
);

// Helper para pegar config de uma industry
export function getIndustryConfig(industry: Industry | null | undefined): IndustryConfig {
  if (!industry) {
    return INDUSTRY_CONFIGS.solar_energy; // fallback
  }
  return INDUSTRY_CONFIGS[industry] || INDUSTRY_CONFIGS.solar_energy;
}

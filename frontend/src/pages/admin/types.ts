import type { Industry } from '../../types/onboarding';

export type AdminCompany = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: Industry | null;
  status?: string | null;
  plan?: string | null;
  created_at: string;
  is_active?: boolean | null;
  _count?: Partial<{
    users: number;
    inboxes: number;
    agents: number;
  }>;
};

export type AdminCompanyDetails = AdminCompany & {
  cnpj?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  logo?: string | null;
  team_size?: number | null;
  updated_at?: string | null;
};

export type CompanyCounts = {
  users: number;
  inboxes: number;
  agents: number;
  chats: number;
};

export type CompanyUsage = {
  messages: number;
  lastMessageAt: string | null;
  storage_used?: string;
  tokens_used?: number;
};

export type CompanyFinance = {
  plan: string | null;
  status: string | null;
  isActive: boolean;
};

export type CompanyAnalytics = {
  counts: CompanyCounts;
  usage: CompanyUsage;
  finance: CompanyFinance;
};

export type CompanyDetailsPayload = {
  company: AdminCompanyDetails;
  analytics: CompanyAnalytics;
};

export type CompanyOutletContext = {
  company: AdminCompanyDetails | null;
  analytics: CompanyAnalytics | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

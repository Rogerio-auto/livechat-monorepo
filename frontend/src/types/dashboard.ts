// Dashboard Types

export interface DashboardOverview {
  activeChats: number;
  activeChatsChange: number;
  newLeads: number;
  newLeadsChange: number;
  conversionRate: number;
  conversionRateChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
}

export interface MessageVolumeData {
  date: string;
  count: number;
  fromCustomer: number;
  fromAgent: number;
}

export interface ResponseTimeData {
  avgSeconds: number;
  medianSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

export interface Alert {
  id: string;
  type: "warning" | "error" | "info" | "success";
  title: string;
  description: string;
  count?: number;
  link?: string;
  createdAt: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  messageCount: number;
  lastMessageAt: string;
  avatar?: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  count: number;
  position: number;
}

export interface CampaignStats {
  total: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
}

export interface InboxStats {
  id: string;
  name: string;
  provider: string;
  stats: {
    total_contacts: number;
    active_contacts: number;
  };
}

export interface AgentMetrics {
  id: string;
  name: string;
  template_name: string | null;
  template_category: string | null;
  is_active: boolean;
  active_chats: number;
  total_chats: number;
  created_at: string;
}

export interface DashboardFilters {
  period: "today" | "yesterday" | "7days" | "30days" | "90days" | "custom";
  startDate?: string;
  endDate?: string;
  inboxId?: string;
  agentId?: string;
  compareWithPrevious: boolean;
}

export type DashboardTab = 
  | "overview" 
  | "attendance" 
  | "tasks"
  | "ai-agents" 
  | "campaigns" 
  | "sales" 
  | "customers";

export interface LeadStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  newLastMonth: number;
  conversionRate: number;
  avgTicket: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

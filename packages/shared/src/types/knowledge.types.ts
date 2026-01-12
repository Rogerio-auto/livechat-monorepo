export type KnowledgeStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface KnowledgeBaseEntry {
  id: string;
  company_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  keywords: string[];
  priority: number;
  language: string;
  status: KnowledgeStatus;
  version: number;
  parent_id: string | null;
  usage_count: number;
  helpful_count: number;
  unhelpful_count: number;
  last_used_at: string | null;
  related_urls: string[];
  attachments: unknown[];
  internal_notes: string | null;
  visible_to_agents: boolean;
  requires_approval: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateKnowledgeDTO {
  company_id: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string[];
  keywords?: string[];
  priority?: number;
  language?: string;
  status?: KnowledgeStatus;
  related_urls?: string[];
  attachments?: unknown[];
  internal_notes?: string | null;
  visible_to_agents?: boolean;
  requires_approval?: boolean;
  created_by?: string | null;
}

export interface UpdateKnowledgeDTO extends Partial<Omit<CreateKnowledgeDTO, "company_id">> {
  usage_count?: number;
  helpful_count?: number;
  unhelpful_count?: number;
  last_used_at?: string | null;
  version?: number;
  updated_by?: string | null;
}

export interface Proposal {
  id: string;
  number: string;
  company_id: string;
  lead_id: string | null;
  created_by_id: string | null;
  status: string;
  total_value: number;
  discount: number;
  net_value: number;
  notes: string | null;
  items: any[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateProposalDTO {
  lead_id?: string | null;
  company_id: string;
  created_by_id?: string | null;
  status?: string;
  total_value?: number;
  discount?: number;
  net_value?: number;
  notes?: string | null;
  items?: any[] | null;
}

export interface UpdateProposalDTO extends Partial<Omit<CreateProposalDTO, "company_id">> {}

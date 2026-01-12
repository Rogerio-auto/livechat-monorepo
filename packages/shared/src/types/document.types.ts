export interface Document {
  id: string;
  customer_id: string | null;
  proposta_id: string | null;
  doc_type: string;
  status: string;
  number: number | null;
  series: number | null;
  full_number: string | null;
  total: number | null;
  issued_at: string | null;
  due_at: string | null;
  pdf_path: string | null;
  company_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateDocumentDTO {
  customer_id?: string | null;
  proposta_id?: string | null;
  doc_type: string;
  status?: string;
  number?: number | null;
  series?: number | null;
  total?: number | null;
  issued_at?: string | null;
  due_at?: string | null;
  pdf_path?: string | null;
  company_id: string;
}

export interface UpdateDocumentDTO extends Partial<Omit<CreateDocumentDTO, "company_id">> {}

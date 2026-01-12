export interface Customer {
  id: string;
  company_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zip_code: string | null;
  cpf_cnpj: string | null;
  birth_date: string | null;
  lead_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateCustomerDTO {
  company_id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  zip_code?: string | null;
  cpf_cnpj?: string | null;
  birth_date?: string | null;
  lead_id?: string | null;
}

export interface UpdateCustomerDTO extends Partial<Omit<CreateCustomerDTO, "company_id">> {}

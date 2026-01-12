export interface Lead {
  id: string;
  name: string | null;
  phone: string;
  msisdn: string | null;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  rgOrgao: string | null;
  birthDate: string | null;
  mother: string | null;
  father: string | null;
  gender: string | null;
  birthPlace: string | null;
  maritalStatus: string | null;
  spouse: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  state: string | null;
  city: string | null;
  cellphone: string | null;
  altCellphone: string | null;
  telephone: string | null;
  altTelephone: string | null;
  site: string | null;
  notes: string | null;
  statusClient: string;
  personType: string | null;
  kanban_column_id: string | null;
  kanban_board_id: string | null;
  company_id: string;
  customer_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateLeadDTO {
  name: string | null;
  phone: string;
  company_id: string;
  email?: string | null;
  personType?: string | null;
  msisdn?: string | null;
  statusClient?: string;
  kanban_column_id?: string | null;
  kanban_board_id?: string | null;
  customer_id?: string | null;
  // ... other fields as optional
}

export interface UpdateLeadDTO extends Partial<Omit<Lead, "id" | "company_id" | "created_at">> {}

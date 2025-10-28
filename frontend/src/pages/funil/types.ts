export type Column = {
  id: string;
  title: string;
  color: string;
  position: number;
};

export type Card = {
  id: string;
  title: string;
  value: number;
  stage: string; // columnId
  position: number;
  contact?: string;
  email?: string;
  owner?: string;
  source?: string;
  notes?: string;
  leadId?: string | null;
};

export type LeadListItem = {
  id: string;
  name: string;
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;
  celularAlternativo?: string | null;
  telefoneAlternativo?: string | null;
  status?: string | null;
};

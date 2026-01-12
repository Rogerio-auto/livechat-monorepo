export type CalendarType = "PERSONAL" | "TEAM" | "COMPANY" | "CUSTOMER" | "PROJECT";

export interface Calendar {
  id: string;
  name: string;
  type: CalendarType;
  color: string;
  description: string | null;
  owner_id: string | null;
  company_id: string;
  is_default: boolean;
  timezone: string;
  created_at: string;
  updated_at: string | null;
}

export interface CreateCalendarDTO {
  name: string;
  type?: CalendarType;
  color?: string;
  description?: string | null;
  owner_id?: string | null;
  company_id: string;
  is_default?: boolean;
  timezone?: string;
}

export interface UpdateCalendarDTO extends Partial<Omit<CreateCalendarDTO, "company_id">> {}

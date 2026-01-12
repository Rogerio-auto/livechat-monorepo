export type MetaProviderConfig = {
  access_token?: string | null;
  refresh_token?: string | null;
  provider_api_key?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  webhook_verify_token?: string | null;
  app_secret?: string | null;
};

export type WahaProviderConfig = {
  api_key?: string | null;
};

export type ProviderConfig = {
  meta?: MetaProviderConfig | null;
  waha?: WahaProviderConfig | null;
};

export interface Inbox {
  id: string;
  name: string;
  phone_number: string;
  is_active: boolean;
  webhook_url: string | null;
  channel: string | null;
  provider: string | null;
  base_url: string | null;
  api_version: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  instance_id: string | null;
  webhook_verify_token: string | null;
  app_secret: string | null;
  company_id: string;
  waha_db_name: string | null;
  provider_config?: ProviderConfig | null;
  created_at: string;
  updated_at: string | null;
}

// Aliases para compatibilidade com o frontend
export type InboxForm = CreateInboxDTO;
export type InboxFormExtended = CreateInboxDTO & {
  base_url?: string;
  api_version?: string;
  instance_id?: string;
  phone_number_id?: string;
  waba_id?: string;
  webhook_verify_token?: string;
  provider_config?: ProviderConfig | null;
};

export type WahaSessionInfo = {
  status?: string | null;
  phone?: string | null;
  number?: string | null;
  connectedPhone?: string | null;
  [key: string]: unknown;
};

export interface CreateInboxDTO {
  name: string;
  phone_number: string;
  company_id?: string;
  is_active?: boolean;
  webhook_url?: string | null;
  channel?: string | null;
  provider?: string | null;
  base_url?: string | null;
  api_version?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
  instance_id?: string | null;
  webhook_verify_token?: string | null;
  app_secret?: string | null;
  waha_db_name?: string | null;
}

export interface UpdateInboxDTO extends Partial<Omit<CreateInboxDTO, "company_id">> {}

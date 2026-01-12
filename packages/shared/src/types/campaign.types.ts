export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: "BROADCAST" | "DRIP" | "TRIGGERED";
  inbox_id: string | null;
  rate_limit_per_minute: number;
  auto_handoff: boolean;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string | null;
  send_windows?: {
    enabled: boolean;
    timezone?: string;
    weekdays?: Record<string, string[]>; // "1": ["09:00-12:00"] etc
  } | null;
  timezone?: string | null;
  segment_id?: string | null;
}

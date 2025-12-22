import { useState, useEffect, useCallback } from "react";
import type {
  DashboardOverview,
  MessageVolumeData,
  ResponseTimeData,
  Alert,
  TopCustomer,
  FunnelStage,
  CampaignStats,
  InboxStats,
  AgentMetrics,
  LeadStats,
  DashboardFilters,
} from "../types/dashboard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Hook para overview (KPIs principais)
export function useDashboardOverview(days = 7, autoRefresh = false) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<DashboardOverview>(`${API_BASE}/api/dashboard/overview?days=${days}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch overview");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para volume de mensagens
export function useMessageVolume(days = 7) {
  const [data, setData] = useState<MessageVolumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchJson<MessageVolumeData[]>(
          `${API_BASE}/api/dashboard/messages/volume?days=${days}`
        );
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch message volume");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook para tempo de resposta
export function useResponseTime(days = 7) {
  const [data, setData] = useState<ResponseTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchJson<ResponseTimeData>(
          `${API_BASE}/api/dashboard/response-time?days=${days}`
        );
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch response time");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook para alertas
export function useDashboardAlerts(autoRefresh = true) {
  const [data, setData] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<Alert[]>(`${API_BASE}/api/dashboard/alerts`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 120000); // Refresh every 2 minutes
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para top customers
export function useTopCustomers(days = 30, limit = 10) {
  const [data, setData] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchJson<TopCustomer[]>(
          `${API_BASE}/api/dashboard/top-customers?days=${days}&limit=${limit}`
        );
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch top customers");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days, limit]);

  return { data, loading, error };
}

// Hook para funil de vendas
export function useFunnelData(days = 30) {
  const [data, setData] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<FunnelStage[]>(`${API_BASE}/api/dashboard/funnel?days=${days}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch funnel data");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para estatísticas de campanhas
export function useCampaignStats(days = 30) {
  const [data, setData] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<CampaignStats>(`${API_BASE}/api/dashboard/campaigns/stats?days=${days}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch campaign stats");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para estatísticas de inboxes
export function useInboxStats() {
  const [data, setData] = useState<InboxStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchJson<InboxStats[]>(`${API_BASE}/livechat/inboxes/stats`);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch inbox stats");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { data, loading, error };
}

// Hook para métricas dos agentes AI
export function useAgentMetrics() {
  const [data, setData] = useState<AgentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<AgentMetrics[]>(`${API_BASE}/api/agents/metrics`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch agent metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Hook para estatísticas de leads
export function useLeadStats(days = 30) {
  const [data, setData] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchJson<LeadStats>(`${API_BASE}/api/leads/stats?days=${days}`);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch lead stats");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days]);

  return { data, loading, error };
}

// Hook para conversas recentes
export function useRecentChats(limit = 10, search = "") {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const searchQuery = search ? `&q=${encodeURIComponent(search)}` : "";
        const result = await fetchJson<{ items: any[] }>(
          `${API_BASE}/livechat/chats?limit=${limit}&sort=last_message_at${searchQuery}`
        );
        setData(result.items || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch recent chats");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [limit, search]);

  return { data, loading, error };
}

// Hook para monitoramento detalhado de agentes AI
export function useAgentMonitoring(days = 7) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchJson<any>(`${API_BASE}/api/agents-monitoring/stats?days=${days}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch agent monitoring stats");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

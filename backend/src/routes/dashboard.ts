import express from "express";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { rGet, rSet } from "../lib/redis.ts";

interface DashboardOverview {
  activeChats: number;
  activeChatsChange: number;
  newLeads: number;
  newLeadsChange: number;
  conversionRate: number;
  conversionRateChange: number;
  avgResponseTime: number;
  avgResponseTimeChange: number;
}

interface MessageVolumeData {
  date: string;
  count: number;
  fromCustomer: number;
  fromAgent: number;
}

interface ResponseTimeData {
  avgSeconds: number;
  medianSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  description: string;
  count?: number;
  link?: string;
  createdAt: string;
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  messageCount: number;
  lastMessageAt: string;
  avatar?: string;
}

export function registerDashboardRoutes(app: express.Application) {
  async function resolveCompanyId(req: any): Promise<string> {
    const authUserId = req.user?.id;
    if (!authUserId) throw new Error("User not authenticated");

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (userError || !userData?.company_id) {
      throw new Error("Company not found for user");
    }

    return userData.company_id;
  }

  // GET /api/dashboard/overview - KPIs consolidados
  app.get("/api/dashboard/overview", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const cacheKey = `dashboard:overview:${companyId}`;

      // Tentar cache (5 minutos)
      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // 1. Active Chats (OPEN or PENDING)
      const { count: activeChatsToday } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["OPEN", "PENDING"]);

      const { count: activeChatsYesterday } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("status", ["OPEN", "PENDING"])
        .lt("created_at", today.toISOString());

      // 2. New Leads (today vs yesterday)
      const { count: newLeadsToday } = await supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", today.toISOString());

      const { count: newLeadsYesterday } = await supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("created_at", yesterday.toISOString())
        .lt("created_at", today.toISOString());

      // 3. Conversion Rate (last 7 days vs previous 7 days)
      const { data: leadsLastWeek } = await supabaseAdmin
        .from("leads")
        .select("id, status_client")
        .eq("company_id", companyId)
        .gte("created_at", lastWeek.toISOString());

      const twoWeeksAgo = new Date(lastWeek);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

      const { data: leadsPrevWeek } = await supabaseAdmin
        .from("leads")
        .select("id, status_client")
        .eq("company_id", companyId)
        .gte("created_at", twoWeeksAgo.toISOString())
        .lt("created_at", lastWeek.toISOString());

      const convertedLastWeek = (leadsLastWeek || []).filter(
        (l: any) => (l.status_client || "").toLowerCase() === "ativo"
      ).length;
      const totalLastWeek = (leadsLastWeek || []).length;
      const conversionRateLastWeek = totalLastWeek > 0 ? (convertedLastWeek / totalLastWeek) * 100 : 0;

      const convertedPrevWeek = (leadsPrevWeek || []).filter(
        (l: any) => (l.status_client || "").toLowerCase() === "ativo"
      ).length;
      const totalPrevWeek = (leadsPrevWeek || []).length;
      const conversionRatePrevWeek = totalPrevWeek > 0 ? (convertedPrevWeek / totalPrevWeek) * 100 : 0;

      // 4. Average Response Time (simplified - first agent response to customer message)
      const { data: recentChats } = await supabaseAdmin
        .from("chats")
        .select("id")
        .eq("company_id", companyId)
        .gte("created_at", lastWeek.toISOString())
        .limit(100);

      let totalResponseTime = 0;
      let responseCount = 0;

      if (recentChats && recentChats.length > 0) {
        const chatIds = recentChats.map((c: any) => c.id);
        
        // Get messages from these chats
        const { data: messages } = await supabaseAdmin
          .from("chat_messages")
          .select("chat_id, is_from_customer, created_at")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: true });

        // Calculate response times per chat
        const chatMessages = new Map<string, any[]>();
        (messages || []).forEach((msg: any) => {
          if (!chatMessages.has(msg.chat_id)) {
            chatMessages.set(msg.chat_id, []);
          }
          chatMessages.get(msg.chat_id)!.push(msg);
        });

        chatMessages.forEach((msgs) => {
          for (let i = 0; i < msgs.length - 1; i++) {
            if (msgs[i].is_from_customer && !msgs[i + 1].is_from_customer) {
              const customerTime = new Date(msgs[i].created_at).getTime();
              const agentTime = new Date(msgs[i + 1].created_at).getTime();
              const diff = (agentTime - customerTime) / 1000; // seconds
              if (diff > 0 && diff < 3600) { // Ignore if > 1 hour (likely not active conversation)
                totalResponseTime += diff;
                responseCount++;
              }
            }
          }
        });
      }

      const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

      // Calculate changes (simplified - using yesterday's data as comparison)
      const activeChatsChange = activeChatsYesterday ? 
        Math.round(((activeChatsToday || 0) - activeChatsYesterday) / activeChatsYesterday * 100) : 0;
      
      const newLeadsChange = newLeadsYesterday ? 
        Math.round(((newLeadsToday || 0) - newLeadsYesterday) / newLeadsYesterday * 100) : 0;
      
      const conversionRateChange = conversionRatePrevWeek ? 
        Math.round((conversionRateLastWeek - conversionRatePrevWeek) * 10) / 10 : 0;

      const overview: DashboardOverview = {
        activeChats: activeChatsToday || 0,
        activeChatsChange,
        newLeads: newLeadsToday || 0,
        newLeadsChange,
        conversionRate: Math.round(conversionRateLastWeek * 10) / 10,
        conversionRateChange,
        avgResponseTime,
        avgResponseTimeChange: 0, // Would need historical data
      };

      // Cache for 5 minutes
      await rSet(cacheKey, overview, 300);

      return res.json(overview);
    } catch (e: any) {
      console.error("[dashboard/overview] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get overview" });
    }
  });

  // GET /api/dashboard/messages/volume - Volume de mensagens por período
  app.get("/api/dashboard/messages/volume", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const days = parseInt(req.query.days as string) || 7;
      const cacheKey = `dashboard:messages:${companyId}:${days}`;

      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: messages, error } = await supabaseAdmin
        .from("chat_messages")
        .select("created_at, is_from_customer, chat_id")
        .eq("company_id", companyId)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by date
      const volumeByDate = new Map<string, { count: number; fromCustomer: number; fromAgent: number }>();

      (messages || []).forEach((msg: any) => {
        const date = new Date(msg.created_at).toISOString().split("T")[0];
        if (!volumeByDate.has(date)) {
          volumeByDate.set(date, { count: 0, fromCustomer: 0, fromAgent: 0 });
        }
        const data = volumeByDate.get(date)!;
        data.count++;
        if (msg.is_from_customer) {
          data.fromCustomer++;
        } else {
          data.fromAgent++;
        }
      });

      const result: MessageVolumeData[] = Array.from(volumeByDate.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      await rSet(cacheKey, result, 300);
      return res.json(result);
    } catch (e: any) {
      console.error("[dashboard/messages/volume] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get message volume" });
    }
  });

  // GET /api/dashboard/response-time - Tempo médio de resposta
  app.get("/api/dashboard/response-time", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const days = parseInt(req.query.days as string) || 7;
      const cacheKey = `dashboard:response-time:${companyId}:${days}`;

      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: chats } = await supabaseAdmin
        .from("chats")
        .select("id")
        .eq("company_id", companyId)
        .gte("created_at", startDate.toISOString());

      if (!chats || chats.length === 0) {
        return res.json({ avgSeconds: 0, medianSeconds: 0, minSeconds: 0, maxSeconds: 0 });
      }

      const chatIds = chats.map((c: any) => c.id);
      const { data: messages } = await supabaseAdmin
        .from("chat_messages")
        .select("chat_id, is_from_customer, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: true });

      const responseTimes: number[] = [];
      const chatMessages = new Map<string, any[]>();

      (messages || []).forEach((msg: any) => {
        if (!chatMessages.has(msg.chat_id)) {
          chatMessages.set(msg.chat_id, []);
        }
        chatMessages.get(msg.chat_id)!.push(msg);
      });

      chatMessages.forEach((msgs) => {
        for (let i = 0; i < msgs.length - 1; i++) {
          if (msgs[i].is_from_customer && !msgs[i + 1].is_from_customer) {
            const customerTime = new Date(msgs[i].created_at).getTime();
            const agentTime = new Date(msgs[i + 1].created_at).getTime();
            const diff = (agentTime - customerTime) / 1000;
            if (diff > 0 && diff < 3600) {
              responseTimes.push(diff);
            }
          }
        }
      });

      if (responseTimes.length === 0) {
        return res.json({ avgSeconds: 0, medianSeconds: 0, minSeconds: 0, maxSeconds: 0 });
      }

      responseTimes.sort((a, b) => a - b);
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const median = responseTimes[Math.floor(responseTimes.length / 2)];
      const min = responseTimes[0];
      const max = responseTimes[responseTimes.length - 1];

      const result: ResponseTimeData = {
        avgSeconds: Math.round(avg),
        medianSeconds: Math.round(median),
        minSeconds: Math.round(min),
        maxSeconds: Math.round(max),
      };

      await rSet(cacheKey, result, 300);
      return res.json(result);
    } catch (e: any) {
      console.error("[dashboard/response-time] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get response time" });
    }
  });

  // GET /api/dashboard/alerts - Alertas e pendências
  app.get("/api/dashboard/alerts", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const alerts: Alert[] = [];

      // 1. Chats sem resposta há mais de 2 horas
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const { count: unrespondedChats } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "OPEN")
        .eq("last_message_from", "CUSTOMER")
        .lt("last_message_at", twoHoursAgo.toISOString());

      if (unrespondedChats && unrespondedChats > 0) {
        alerts.push({
          id: "unresponded-chats",
          type: "warning",
          title: "Conversas sem resposta",
          description: `${unrespondedChats} conversas aguardando resposta há mais de 2 horas`,
          count: unrespondedChats,
          link: "/livechat?filter=unresponded",
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Campanhas com erro
      const { count: failedCampaigns } = await supabaseAdmin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "FAILED");

      if (failedCampaigns && failedCampaigns > 0) {
        alerts.push({
          id: "failed-campaigns",
          type: "error",
          title: "Campanhas com erro",
          description: `${failedCampaigns} campanhas falharam e precisam de atenção`,
          count: failedCampaigns,
          link: "/livechat?section=campaigns",
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Leads sem follow-up há 3+ dias
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { count: staleLeads } = await supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .neq("status_client", "ativo")
        .lt("updated_at", threeDaysAgo.toISOString());

      if (staleLeads && staleLeads > 5) {
        alerts.push({
          id: "stale-leads",
          type: "info",
          title: "Leads sem acompanhamento",
          description: `${staleLeads} leads sem atividade há mais de 3 dias`,
          count: staleLeads,
          link: "/funil-vendas",
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Próximos compromissos (hoje)
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const { count: todayEvents } = await supabaseAdmin
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("start_time", todayStart.toISOString())
        .lt("start_time", todayEnd.toISOString());

      if (todayEvents && todayEvents > 0) {
        alerts.push({
          id: "today-events",
          type: "info",
          title: "Compromissos hoje",
          description: `Você tem ${todayEvents} compromisso(s) agendado(s) para hoje`,
          count: todayEvents,
          link: "/calendar",
          createdAt: new Date().toISOString(),
        });
      }

      return res.json(alerts);
    } catch (e: any) {
      console.error("[dashboard/alerts] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get alerts" });
    }
  });

  // GET /api/dashboard/top-customers - Top clientes por interação
  app.get("/api/dashboard/top-customers", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 10;
      const cacheKey = `dashboard:top-customers:${companyId}:${days}:${limit}`;

      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get message counts grouped by chat
      const { data: messageCounts, error } = await supabaseAdmin
        .from("chat_messages")
        .select("chat_id")
        .eq("company_id", companyId)
        .gte("created_at", startDate.toISOString());

      if (error) throw error;

      // Count messages per chat
      const chatMessageCount = new Map<string, number>();
      (messageCounts || []).forEach((msg: any) => {
        chatMessageCount.set(msg.chat_id, (chatMessageCount.get(msg.chat_id) || 0) + 1);
      });

      // Get top chats
      const topChatIds = Array.from(chatMessageCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([chatId]) => chatId);

      if (topChatIds.length === 0) {
        return res.json([]);
      }

      // Get chat details with customer info
      const { data: chats } = await supabaseAdmin
        .from("chats")
        .select(`
          id,
          customer_id,
          last_message_at,
          customer:customers (
            id,
            name,
            phone,
            avatar
          )
        `)
        .in("id", topChatIds);

      const result: TopCustomer[] = (chats || [])
        .filter((chat: any) => chat.customer)
        .map((chat: any) => ({
          id: chat.customer.id,
          name: chat.customer.name || "Sem nome",
          phone: chat.customer.phone || "",
          messageCount: chatMessageCount.get(chat.id) || 0,
          lastMessageAt: chat.last_message_at || "",
          avatar: chat.customer.avatar,
        }))
        .sort((a, b) => b.messageCount - a.messageCount);

      await rSet(cacheKey, result, 600); // Cache for 10 minutes
      return res.json(result);
    } catch (e: any) {
      console.error("[dashboard/top-customers] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get top customers" });
    }
  });

  // GET /api/dashboard/funnel - Funil de vendas (kanban)
  app.get("/api/dashboard/funnel", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const cacheKey = `dashboard:funnel:${companyId}`;

      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Get all leads with kanban columns
      const { data: leads, error } = await supabaseAdmin
        .from("leads")
        .select("id, kanban_column_id, status_client")
        .eq("company_id", companyId);

      if (error) throw error;

      // Get kanban columns
      const { data: columns } = await supabaseAdmin
        .from("kanban_columns")
        .select("id, name, position")
        .eq("company_id", companyId)
        .order("position", { ascending: true });

      // Count leads per column
      const columnCounts = new Map<string, number>();
      (leads || []).forEach((lead: any) => {
        if (lead.kanban_column_id) {
          columnCounts.set(lead.kanban_column_id, (columnCounts.get(lead.kanban_column_id) || 0) + 1);
        }
      });

      const funnel = (columns || []).map((col: any) => ({
        id: col.id,
        name: col.name,
        count: columnCounts.get(col.id) || 0,
        position: col.position,
      }));

      await rSet(cacheKey, funnel, 300);
      return res.json(funnel);
    } catch (e: any) {
      console.error("[dashboard/funnel] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get funnel data" });
    }
  });

  // GET /api/dashboard/campaigns/stats - Estatísticas de campanhas
  app.get("/api/dashboard/campaigns/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveCompanyId(req);
      const cacheKey = `dashboard:campaigns:${companyId}`;

      const cached = await rGet(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const { data: campaigns, error } = await supabaseAdmin
        .from("campaigns")
        .select("id, status")
        .eq("company_id", companyId);

      if (error) throw error;

      const stats = {
        total: (campaigns || []).length,
        running: (campaigns || []).filter((c: any) => c.status === "RUNNING").length,
        paused: (campaigns || []).filter((c: any) => c.status === "PAUSED").length,
        completed: (campaigns || []).filter((c: any) => c.status === "COMPLETED").length,
        failed: (campaigns || []).filter((c: any) => c.status === "FAILED").length,
      };

      await rSet(cacheKey, stats, 300);
      return res.json(stats);
    } catch (e: any) {
      console.error("[dashboard/campaigns/stats] Error:", e);
      return res.status(500).json({ error: e?.message || "Failed to get campaign stats" });
    }
  });
}

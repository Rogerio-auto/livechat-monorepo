import { useState } from "react";
import { TrialBanner } from "../../components/subscription/TrialBanner";
import { KPICard, formatTime } from "./KPICard";
import { AlertsPanel } from "./AlertsPanel";
import { TasksWidget } from "../../components/tasks/TasksWidget";
import { ChartContainer, LineChartComponent, BarChartComponent, PieChartComponent } from "./Charts";
import {
  useDashboardOverview,
  useMessageVolume,
  useDashboardAlerts,
  useTopCustomers,
  useFunnelData,
  useCampaignStats,
  useInboxStats,
  useAgentMetrics,
  useLeadStats,
  useRecentChats,
} from "../../hooks/useDashboard";
import {
  FiMessageSquare,
  FiUsers,
  FiTrendingUp,
  FiClock,
  FiActivity,
  FiTarget,
  FiSend,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import type { DashboardTab } from "../../types/dashboard";

export function DashboardNew() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const navigate = useNavigate();

  const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Visão Geral", icon: <FiActivity /> },
    { id: "attendance", label: "Atendimento", icon: <FiMessageSquare /> },
    { id: "ai-agents", label: "Agentes AI", icon: <FiUser /> },
    { id: "campaigns", label: "Campanhas", icon: <FiSend /> },
    { id: "sales", label: "Vendas", icon: <FiTarget /> },
    { id: "customers", label: "Clientes", icon: <FiUsers /> },
  ];

  return (
    <div className="livechat-theme w-full min-h-screen pb-12 transition-colors duration-500">
      <div className="mx-auto w-full max-w-[var(--page-max-width)] space-y-6 px-3 pb-8 pt-6 sm:px-6 lg:px-8">
        <TrialBanner />
        <div className="livechat-card rounded-3xl">
          <div className="px-5 py-6 md:px-10 md:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-[var(--color-text)]">Dashboard</h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Acompanhe as métricas e performance do seu negócio
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl livechat-muted-surface p-2 shadow-inner backdrop-blur-md">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-[#2fb463] text-white shadow-[0_18px_48px_-24px_rgba(47,180,99,0.55)]"
                          : "text-[var(--color-text-muted)] hover:bg-[rgba(47,180,99,0.12)] hover:text-[var(--color-primary)] dark:hover:bg-[rgba(116,230,158,0.12)]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/40 transition-all ${
                          isActive
                            ? "bg-white/25 text-white"
                            : "bg-[rgba(47,180,99,0.1)] text-[#1f8b49] dark:bg-[rgba(116,230,158,0.16)] dark:text-[#74e69e]"
                        }`}
                      >
                        {tab.icon}
                      </span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              {activeTab === "overview" && <OverviewTab />}
              {activeTab === "attendance" && <AttendanceTab />}
              {activeTab === "ai-agents" && <AIAgentsTab />}
              {activeTab === "campaigns" && <CampaignsTab />}
              {activeTab === "sales" && <SalesTab />}
              {activeTab === "customers" && <CustomersTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab: Visão Geral
function OverviewTab() {
  const { data: overview, loading: overviewLoading } = useDashboardOverview(true);
  const { data: messageVolume, loading: volumeLoading } = useMessageVolume(7);
  const { data: alerts, loading: alertsLoading } = useDashboardAlerts(true);
  const { data: recentChats, loading: chatsLoading } = useRecentChats(10);
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* KPIs */}
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Conversas Ativas"
          value={overview?.activeChats || 0}
          change={overview?.activeChatsChange}
          icon={<FiMessageSquare size={20} />}
          loading={overviewLoading}
          accentColor="blue"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Novos Leads Hoje"
          value={overview?.newLeads || 0}
          change={overview?.newLeadsChange}
          icon={<FiUsers size={20} />}
          loading={overviewLoading}
          accentColor="purple"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Taxa de Conversão"
          value={overview?.conversionRate || 0}
          change={overview?.conversionRateChange}
          icon={<FiTrendingUp size={20} />}
          suffix="%"
          loading={overviewLoading}
          accentColor="teal"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Tempo Médio Resposta"
          value={formatTime(overview?.avgResponseTime || 0)}
          icon={<FiClock size={20} />}
          loading={overviewLoading}
          accentColor="orange"
        />
      </div>

      {/* Volume de Mensagens */}
      <div className="col-span-12 lg:col-span-8">
        <ChartContainer title="Volume de Mensagens (Últimos 7 Dias)" loading={volumeLoading}>
          <LineChartComponent
            data={messageVolume.map((d) => ({
              name: new Date(d.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              }),
              value: d.count,
              total: d.count,
              clientes: d.fromCustomer,
              agentes: d.fromAgent,
            }))}
            dataKey="total"
            xAxisKey="name"
          />
        </ChartContainer>
      </div>

      {/* Alertas */}
      <div className="col-span-12 lg:col-span-4">
        <div className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-xl flex flex-col max-h-[600px]">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[rgba(47,180,99,0.12)] via-transparent to-transparent" />
          <div className="relative flex-1 overflow-y-auto">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Alertas e Pendências
            </h3>
            <AlertsPanel alerts={alerts} loading={alertsLoading} />
          </div>
        </div>
      </div>

      {/* Tasks Widget */}
      <div className="col-span-12 lg:col-span-4">
        <TasksWidget />
      </div>

      {/* Conversas Recentes */}
      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[rgba(90,211,139,0.12)] via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Conversas Recentes
            </h3>
            {chatsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)]"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Cliente
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Status
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Última Mensagem
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChats.map((chat: any) => (
                      <tr
                        key={chat.id}
                        className="border-b border-[var(--color-border)] transition-colors hover:bg-[rgba(47,180,99,0.08)] dark:hover:bg-[rgba(27,58,41,0.7)]"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(47,180,99,0.16)] text-[#1f8b49] dark:bg-[rgba(116,230,158,0.16)] dark:text-[#74e69e]">
                              <FiUser />
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--color-text)]">
                                {chat.customer_name || "Sem nome"}
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)]">
                                {chat.customer_phone}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              chat.status === "OPEN"
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                : chat.status === "PENDING"
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                : "bg-slate-100 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {chat.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-[var(--color-text)]">
                            {chat.last_message?.substring(0, 50) || "..."}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {chat.last_message_at
                              ? new Date(chat.last_message_at).toLocaleString("pt-BR")
                              : "-"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => navigate(`/livechat?chat=${chat.id}`)}
                            className="text-sm font-semibold text-[#2fb463] hover:underline dark:text-[#74e69e]"
                          >
                            Abrir →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab: Atendimento
function AttendanceTab() {
  const { data: messageVolume, loading: volumeLoading } = useMessageVolume(30);
  const { data: inboxStats, loading: inboxLoading } = useInboxStats();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 lg:col-span-8">
        <ChartContainer title="Volume de Mensagens (Últimos 30 Dias)" loading={volumeLoading}>
          <BarChartComponent
            data={messageVolume.map((d) => ({
              name: new Date(d.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              }),
              value: d.fromCustomer + d.fromAgent,
              clientes: d.fromCustomer,
              agentes: d.fromAgent,
            }))}
            dataKeys={["clientes", "agentes"]}
            colors={["#2fb463", "#74e69e"]}
          />
        </ChartContainer>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <ChartContainer title="Distribuição por Canal" loading={inboxLoading}>
          <PieChartComponent
            data={inboxStats.map((inbox) => ({
              name: inbox.name,
              value: inbox.stats.active_contacts,
            }))}
            dataKey="value"
            nameKey="name"
          />
        </ChartContainer>
      </div>

      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[rgba(47,180,99,0.12)] via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Estatísticas por Inbox
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inboxStats.map((inbox) => (
                <div
                  key={inbox.id}
                  className="livechat-muted-surface rounded-xl p-4 shadow-sm"
                >
                  <div className="mb-2 font-semibold text-[var(--color-text)]">
                    {inbox.name}
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)]">
                    Provider: {inbox.provider}
                  </div>
                  <div className="mt-4 flex justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Total</div>
                      <div className="text-xl font-bold text-[var(--color-text)]">
                        {inbox.stats.total_contacts}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Ativos</div>
                      <div className="text-xl font-bold text-[#2fb463] dark:text-[#74e69e]">
                        {inbox.stats.active_contacts}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab: Agentes AI
function AIAgentsTab() {
  const { data: agents, loading: agentsLoading } = useAgentMetrics();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 lg:col-span-8">
        <ChartContainer title="Performance dos Agentes AI" loading={agentsLoading}>
          <BarChartComponent
            data={agents.map((agent) => ({
              name: agent.name,
              value: agent.total_chats,
              ativos: agent.active_chats,
              total: agent.total_chats,
            }))}
            dataKeys={["ativos", "total"]}
            colors={["#2fb463", "#74e69e"]}
            horizontal
          />
        </ChartContainer>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[rgba(47,180,99,0.12)] via-transparent to-transparent" />
          <div className="relative space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Status dos Agentes
            </h3>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="livechat-muted-surface rounded-xl p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[var(--color-text)]">
                    {agent.name}
                  </span>
                  <span
                    className={`flex h-2.5 w-2.5 rounded-full ${
                      agent.is_active ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {agent.active_chats} chats ativos • {agent.total_chats} total
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab: Campanhas
function CampaignsTab() {
  const { data: campaignStats, loading: campaignsLoading } = useCampaignStats();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Total de Campanhas"
          value={campaignStats?.total || 0}
          icon={<FiSend size={20} />}
          loading={campaignsLoading}
          accentColor="indigo"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Em Execução"
          value={campaignStats?.running || 0}
          icon={<FiActivity size={20} />}
          loading={campaignsLoading}
          accentColor="green"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Concluídas"
          value={campaignStats?.completed || 0}
          icon={<FiTrendingUp size={20} />}
          loading={campaignsLoading}
          accentColor="blue"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Com Erro"
          value={campaignStats?.failed || 0}
          icon={<FiActivity size={20} />}
          loading={campaignsLoading}
          accentColor="red"
        />
      </div>

      <div className="col-span-12 lg:col-span-6">
        <ChartContainer title="Status das Campanhas" loading={campaignsLoading}>
          <PieChartComponent
            data={[
              { name: "Em Execução", value: campaignStats?.running || 0 },
              { name: "Pausadas", value: campaignStats?.paused || 0 },
              { name: "Concluídas", value: campaignStats?.completed || 0 },
              { name: "Com Erro", value: campaignStats?.failed || 0 },
            ]}
            dataKey="value"
            nameKey="name"
            colors={["#2fb463", "#F59E0B", "#74e69e", "#EF4444"]}
          />
        </ChartContainer>
      </div>
    </div>
  );
}

// Tab: Vendas
function SalesTab() {
  const { data: funnel, loading: funnelLoading } = useFunnelData();
  const { data: leadStats, loading: leadsLoading } = useLeadStats();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Total de Leads"
          value={leadStats?.total || 0}
          icon={<FiTarget size={20} />}
          loading={leadsLoading}
          accentColor="indigo"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Leads Ativos"
          value={leadStats?.active || 0}
          icon={<FiTrendingUp size={20} />}
          loading={leadsLoading}
          accentColor="green"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Taxa de Conversão"
          value={leadStats?.conversionRate || 0}
          icon={<FiTarget size={20} />}
          suffix="%"
          loading={leadsLoading}
          accentColor="teal"
        />
      </div>
      <div className="col-span-12 lg:col-span-3">
        <KPICard
          title="Ticket Médio"
          value={`R$ ${(leadStats?.avgTicket || 0).toFixed(2)}`}
          icon={<FiTrendingUp size={20} />}
          loading={leadsLoading}
          accentColor="orange"
        />
      </div>

      <div className="col-span-12">
        <ChartContainer title="Funil de Vendas" loading={funnelLoading}>
          <BarChartComponent
            data={funnel.map((stage) => ({
              name: stage.name,
              value: stage.count,
              leads: stage.count,
            }))}
            dataKeys={["leads"]}
            colors={["#2fb463"]}
            horizontal
            height={Math.max(200, funnel.length * 40)}
          />
        </ChartContainer>
      </div>
    </div>
  );
}

// Tab: Clientes
function CustomersTab() {
  const { data: topCustomers, loading: customersLoading } = useTopCustomers(30, 10);

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl livechat-panel p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[rgba(47,180,99,0.12)] via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Top 10 Clientes por Interação (Últimos 30 Dias)
            </h3>
            {customersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-[rgba(47,180,99,0.12)] dark:bg-[rgba(27,58,41,0.6)]"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 rounded-xl livechat-muted-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(47,180,99,0.16)] font-bold text-[#1f8b49] dark:bg-[rgba(116,230,158,0.16)] dark:text-[#74e69e]">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[var(--color-text)]">
                        {customer.name}
                      </div>
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {customer.phone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#2fb463] dark:text-[#74e69e]">
                        {customer.messageCount}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">mensagens</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import Sidebar from "../Sidbars/sidebar";
import { TrialBanner } from "../../components/subscription/TrialBanner";
import { KPICard, formatTime } from "./KPICard";
import { AlertsPanel } from "./AlertsPanel";
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
    <>
      <div className="ml-16 min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/30 transition-colors duration-300">
        <TrialBanner />
        <div className="h-screen overflow-auto p-6">
          <div className="w-full space-y-6">
            <div className="bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-2xl">
              <div className="px-6 py-6 md:px-10 md:py-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Acompanhe as métricas e performance do seu negócio
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 backdrop-blur-sm p-2 shadow-inner">
                  <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                            isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                              : "text-gray-600 dark:text-gray-300 hover:bg-white/80 hover:text-blue-600 dark:hover:bg-white/10"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 transition-all ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
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
      </div>
    </>
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
    <div className="grid grid-cols-12 gap-6">
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
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent dark:from-blue-400/10" />
          <div className="relative">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Alertas e Pendências
            </h3>
            <AlertsPanel alerts={alerts} loading={alertsLoading} />
          </div>
        </div>
      </div>

      {/* Conversas Recentes */}
      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-500/5 via-transparent to-transparent dark:from-slate-400/10" />
          <div className="relative">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Conversas Recentes
            </h3>
            {chatsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Cliente
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Última Mensagem
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChats.map((chat: any) => (
                      <tr
                        key={chat.id}
                        className="border-b border-gray-100 dark:border-gray-800/70 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                              <FiUser />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {chat.customer_name || "Sem nome"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
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
                          <div className="text-sm text-gray-700 dark:text-gray-200">
                            {chat.last_message?.substring(0, 50) || "..."}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {chat.last_message_at
                              ? new Date(chat.last_message_at).toLocaleString("pt-BR")
                              : "-"}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => navigate(`/livechat?chat=${chat.id}`)}
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
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
    <div className="grid grid-cols-12 gap-6">
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
            colors={["#1D4ED8", "#38BDF8"]}
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
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent dark:from-blue-400/10" />
          <div className="relative">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Estatísticas por Inbox
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inboxStats.map((inbox) => (
                <div
                  key={inbox.id}
                  className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-gray-900/70 p-4 shadow-sm"
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-2">
                    {inbox.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Provider: {inbox.provider}
                  </div>
                  <div className="mt-4 flex justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {inbox.stats.total_contacts}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Ativos</div>
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
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
    <div className="grid grid-cols-12 gap-6">
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
            colors={["#10B981", "#1D4ED8"]}
            horizontal
          />
        </ChartContainer>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/5 via-transparent to-transparent dark:from-indigo-400/10" />
          <div className="relative space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Status dos Agentes
            </h3>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-gray-900/70 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {agent.name}
                  </span>
                  <span
                    className={`flex h-2.5 w-2.5 rounded-full ${
                      agent.is_active ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
    <div className="grid grid-cols-12 gap-6">
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
            colors={["#10B981", "#F59E0B", "#1D4ED8", "#EF4444"]}
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
    <div className="grid grid-cols-12 gap-6">
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
            colors={["#1D4ED8"]}
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
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 backdrop-blur-sm p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-transparent dark:from-blue-400/10" />
          <div className="relative">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
              Top 10 Clientes por Interação (Últimos 30 Dias)
            </h3>
            {customersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 rounded-xl border border-gray-200/70 dark:border-gray-700/70 bg-white/80 dark:bg-gray-900/70 p-4 shadow-sm transition-all hover:border-blue-400/50 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300 font-bold">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {customer.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {customer.phone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {customer.messageCount}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">mensagens</div>
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

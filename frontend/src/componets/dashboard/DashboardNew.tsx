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
  FiCheckSquare,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import Sidebar from "../Sidbars/sidebar";
import type { DashboardTab } from "../../types/dashboard";

import { FloatingNotificationBell } from "../../components/notifications/FloatingNotificationBell";

export function DashboardNew() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const navigate = useNavigate();

  const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Visão Geral", icon: <FiActivity /> },
    { id: "attendance", label: "Atendimento", icon: <FiMessageSquare /> },
    { id: "tasks", label: "Tarefas", icon: <FiCheckSquare /> },
    { id: "ai-agents", label: "Agentes AI", icon: <FiUser /> },
    { id: "campaigns", label: "Campanhas", icon: <FiSend /> },
    { id: "sales", label: "Vendas", icon: <FiTarget /> },
    { id: "customers", label: "Clientes", icon: <FiUsers /> },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[color:var(--color-surface)] text-[color:var(--color-text)]">
      <Sidebar className="peer" />
      <FloatingNotificationBell className="left-20 peer-hover:left-[19rem]" />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:pl-16 transition-all duration-300">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <div className="w-full space-y-6">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0">
              <div className="px-4 md:px-6 py-6 border-b border-[color:var(--color-border)]">
                <h1 className="text-2xl font-bold text-[color:var(--color-heading)]">Dashboard</h1>
                <p className="text-sm text-[color:var(--color-text-muted)]">Acompanhe as métricas e performance do seu negócio</p>
              </div>
              <div className="p-4 md:p-6">
                <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-[color:var(--color-primary)] text-white shadow-lg shadow-[color:var(--color-primary)]/20"
                          : "text-[var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] hover:text-[var(--color-primary)]"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
                          isActive
                            ? "bg-white/20 border-white/20 text-white"
                            : "bg-[color:var(--color-surface-muted)] border-[color:var(--color-border)] text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-primary)] group-hover:border-[color:var(--color-primary)]/30"
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
              {activeTab === "tasks" && <TasksTab />}
              {activeTab === "ai-agents" && <AIAgentsTab />}
              {activeTab === "campaigns" && <CampaignsTab />}
              {activeTab === "sales" && <SalesTab />}
              {activeTab === "customers" && <CustomersTab />}
            </div>
          </div>
        </div>
      </div>
      </main>
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
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm flex flex-col max-h-[600px]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
          <div className="relative flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Alertas e Pendências
            </h3>
            <AlertsPanel alerts={alerts} loading={alertsLoading} />
          </div>
        </div>
      </div>

      {/* Conversas Recentes */}
      <div className="col-span-12">
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Conversas Recentes
            </h3>
            {chatsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-[color:var(--color-surface-muted)]"
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="border-b border-[color:var(--color-border)]">
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Cliente</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Status</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Última Mensagem</th>
                      <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentChats.map((chat: any) => (
                      <tr key={chat.id} className="border-b border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] text-[color:var(--color-primary)]">
                              <FiUser />
                            </div>
                            <div>
                              <div className="font-semibold text-[color:var(--color-heading)]">{chat.customer_name || "Sem nome"}</div>
                              <div className="text-xs text-[color:var(--color-text-muted)]">{chat.customer_phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]">
                            {chat.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-[color:var(--color-text)]">{chat.last_message?.substring(0, 50) || "..."}</div>
                          <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString("pt-BR") : "-"}</div>
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => navigate(`/livechat?chat=${chat.id}`)} className="text-sm font-semibold text-[color:var(--color-primary)] hover:underline">
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
            colors={["var(--color-primary)", "var(--color-primary-muted, #74e69e)"]}
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
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Estatísticas por Inbox
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inboxStats.map((inbox) => (
                <div
                  key={inbox.id}
                  className="bg-[color:var(--color-surface-muted)] rounded-xl p-4 shadow-sm border border-[color:var(--color-border)]"
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
                      <div className="text-xl font-bold text-[color:var(--color-primary)]">
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

// Tab: Tarefas
function TasksTab() {
  return (
    <div className="w-full">
      <TasksWidget />
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
            colors={["var(--color-primary)", "var(--color-primary-muted, #74e69e)"]}
            horizontal
          />
        </ChartContainer>
      </div>

      <div className="col-span-12 lg:col-span-4">
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
          <div className="relative space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Status dos Agentes
            </h3>
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-[color:var(--color-surface-muted)] rounded-xl p-3 shadow-sm border border-[color:var(--color-border)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[var(--color-text)]">
                    {agent.name}
                  </span>
                  <span
                    className={`flex h-2.5 w-2.5 rounded-full ${
                      agent.is_active ? "bg-[color:var(--color-primary)]" : "bg-slate-400"
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
            colors={["var(--color-primary)", "#F59E0B", "var(--color-primary-muted, #74e69e)", "#EF4444"]}
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
            colors={["var(--color-primary)"]}
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
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
          <div className="relative">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Top 10 Clientes por Interação (Últimos 30 Dias)
            </h3>
            {customersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-[color:var(--color-surface-muted)]"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-4 rounded-xl bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-primary)]/10 font-bold text-[color:var(--color-primary)]">
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
                      <div className="text-lg font-bold text-[color:var(--color-primary)]">
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

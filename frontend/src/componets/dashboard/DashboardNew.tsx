import { useState, useEffect } from "react";
import { TrialBanner } from "../../components/subscription/TrialBanner";
import { KPICard, formatTime } from "./KPICard";
import { AlertsPanel } from "./AlertsPanel";
import { TasksWidget } from "../../components/tasks/TasksWidget";
import { ChartContainer, LineChartComponent, BarChartComponent, PieChartComponent } from "./Charts";
import { io } from "socket.io-client";
import {
  useDashboardOverview,
  useMessageVolume,
  useDashboardAlerts,
  useTopCustomers,
  useFunnelData,
  useCampaignStats,
  useInboxStats,
  useAgentMetrics,
  useAgentMonitoring,
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
  FiAlertCircle,
  FiZap,
} from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { DashboardTab } from "../../types/dashboard";

export function DashboardNew() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as DashboardTab) || "overview";
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const navigate = useNavigate();

  const handleTabChange = (tabId: DashboardTab) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

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
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300">
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
                      onClick={() => handleTabChange(tab.id)}
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
      </main>
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
  const navigate = useNavigate();
  const { data: monitoring, loading: monitoringLoading, refetch } = useAgentMonitoring();
  const [liveActivity, setLiveActivity] = useState<any[]>([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      withCredentials: true,
      transports: ["websocket"],
    });

    socket.on("agent:activity", (activity) => {
      setLiveActivity((prev) => [
        { ...activity, timestamp: new Date() },
        ...prev
      ].slice(0, 5));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (monitoringLoading) {
    return (
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-span-12 md:col-span-3 h-32 animate-pulse rounded-2xl bg-[color:var(--color-surface-muted)]" />
        ))}
        <div className="col-span-12 lg:col-span-8 h-80 animate-pulse rounded-2xl bg-[color:var(--color-surface-muted)]" />
        <div className="col-span-12 lg:col-span-4 h-80 animate-pulse rounded-2xl bg-[color:var(--color-surface-muted)]" />
      </div>
    );
  }

  const summary = monitoring?.summary || { totalConversations: 0, totalErrors: 0, activeAgents: 0, totalAgents: 0 };
  const charts = monitoring?.charts || { conversationsOverTime: [] };
  const agents = monitoring?.agents || [];
  const recentErrors = monitoring?.recentErrors || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 md:col-span-3">
          <KPICard
            title="Conversas Totais"
            value={summary.totalConversations}
            icon={<FiMessageSquare size={20} />}
            accentColor="blue"
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <KPICard
            title="Erros Detectados"
            value={summary.totalErrors}
            icon={<FiAlertCircle size={20} />}
            accentColor="red"
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <KPICard
            title="Agentes Ativos"
            value={summary.activeAgents}
            icon={<FiZap size={20} />}
            accentColor="green"
          />
        </div>
        <div className="col-span-12 md:col-span-3">
          <KPICard
            title="Taxa de Sucesso"
            value={summary.totalConversations > 0 ? (((summary.totalConversations - summary.totalErrors) / summary.totalConversations) * 100).toFixed(1) : "100"}
            suffix="%"
            icon={<FiTrendingUp size={20} />}
            accentColor="teal"
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Gráfico de Volume */}
        <div className="col-span-12 lg:col-span-8">
          <ChartContainer title="Volume de Conversas vs Erros">
            <LineChartComponent
              data={charts.conversationsOverTime}
              dataKeys={["total", "errors"]}
              colors={["var(--color-primary)", "#EF4444"]}
            />
          </ChartContainer>
        </div>

        {/* Lista de Agentes e Atividade */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm flex-1">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[color:var(--color-primary)]/5 via-transparent to-transparent" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Status dos Agentes
                </h3>
              </div>
              <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                {agents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className="bg-[color:var(--color-surface-muted)] rounded-xl p-3 border border-[color:var(--color-border)] transition-all hover:border-[color:var(--color-primary)]/30 group/agent"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-[var(--color-text)]">
                        {agent.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => navigate(`/agents/${agent.id}/playground`)}
                          className="opacity-0 group-hover/agent:opacity-100 p-1 hover:bg-[color:var(--color-primary)]/10 rounded text-[color:var(--color-primary)] transition-all"
                          title="Playground"
                        >
                          <FiZap size={14} />
                        </button>
                        <button 
                          onClick={() => navigate(`/agents/${agent.id}`)}
                          className="opacity-0 group-hover/agent:opacity-100 p-1 hover:bg-[color:var(--color-primary)]/10 rounded text-[color:var(--color-primary)] transition-all"
                          title="Detalhes"
                        >
                          <FiActivity size={14} />
                        </button>
                        <span
                          className={`flex h-2 w-2 rounded-full ${
                            agent.status === 'ACTIVE' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-400"
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                      <span>{agent.metrics?.total_conversations || 0} conversas</span>
                      <span className={agent.metrics?.error_count > 0 ? "text-rose-400 font-bold" : ""}>
                        {agent.metrics?.error_count || 0} erros
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
             <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
               <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               Atividade em Tempo Real
             </h3>
             <div className="space-y-3">
               {liveActivity.length === 0 ? (
                 <div className="text-[10px] text-[var(--color-text-muted)] italic">Aguardando atividade...</div>
               ) : (
                 liveActivity.map((act, i) => (
                   <div key={i} className="flex items-start gap-3 text-[10px] animate-in fade-in slide-in-from-left-2 duration-300">
                     <div className="mt-1 p-1 bg-[color:var(--color-primary)]/10 rounded text-[color:var(--color-primary)]">
                       <FiMessageSquare size={10} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="font-bold text-[var(--color-text)] truncate">{act.agentName || 'Agente'}</div>
                       <div className="text-[var(--color-text-muted)] truncate">{act.message || 'Processando mensagem...'}</div>
                     </div>
                     <div className="text-[var(--color-text-muted)] whitespace-nowrap">
                       {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

        {/* Erros Recentes */}
        <div className="col-span-12">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/30 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <FiAlertCircle className="text-rose-500" /> Erros Recentes de Agentes
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[color:var(--color-border)]">
                    <th className="px-6 py-3 font-bold">Data/Hora</th>
                    <th className="px-6 py-3 font-bold">Agente</th>
                    <th className="px-6 py-3 font-bold">Tipo de Erro</th>
                    <th className="px-6 py-3 font-bold">Mensagem</th>
                    <th className="px-6 py-3 font-bold">Gravidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {recentErrors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-[var(--color-text-muted)] italic">
                        Nenhum erro detectado recentemente. Ótimo trabalho!
                      </td>
                    </tr>
                  ) : (
                    recentErrors.map((error: any) => (
                      <tr key={error.id} className="hover:bg-[color:var(--color-surface-muted)]/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-[var(--color-text-muted)]">
                          {new Date(error.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-[var(--color-text)]">
                          {agents.find((a: any) => a.id === error.agent_id)?.name || 'Agente Desconhecido'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-md bg-[color:var(--color-surface-muted)] text-[10px] font-mono text-[var(--color-text-muted)] border border-[color:var(--color-border)]">
                            {error.error_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--color-text-muted)] max-w-xs truncate">
                          {error.error_message}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            error.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' :
                            error.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {error.severity}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

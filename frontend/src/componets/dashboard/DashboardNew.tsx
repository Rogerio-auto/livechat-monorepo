import { useState, useEffect } from "react";
import { TrialBanner } from "../../components/subscription/TrialBanner";
import { KPICard, formatTime } from "./KPICard";
import { AlertsPanel } from "./AlertsPanel";
import { TasksWidget } from "../../components/tasks/TasksWidget";
import { ChartContainer, LineChartComponent, BarChartComponent, PieChartComponent } from "./Charts";
import { DateRangePicker } from "./DateRangePicker";
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
  const [days, setDays] = useState(7);
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
    <div className="flex-1 flex flex-col min-w-0">
      <div className="max-w-[1600px] mx-auto p-8 space-y-8 w-full">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hoje</h1>
              <div className="flex items-center gap-6 mt-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Volume Bruto</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">R$ 0,00</p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Ontem</p>
                  <p className="text-xl font-bold text-slate-400">R$ 0,00</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <DateRangePicker value={days} onChange={setDays} />
            </div>
          </div>

          {/* Tabs - Stripe Style */}
          <div className="border-b border-slate-200 dark:border-slate-800">
            <nav className="flex gap-8">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`pb-4 text-sm font-medium transition-all relative ${
                      isActive
                        ? "text-[#2fb463] dark:text-[#74e69e]"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {tab.icon}
                      {tab.label}
                    </div>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2fb463] dark:bg-[#74e69e]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="animate-in fade-in duration-500">
            {activeTab === "overview" && <OverviewTab days={days} />}
            {activeTab === "attendance" && <AttendanceTab days={days} />}
            {activeTab === "tasks" && <TasksTab />}
            {activeTab === "ai-agents" && <AIAgentsTab days={days} />}
            {activeTab === "campaigns" && <CampaignsTab days={days} />}
            {activeTab === "sales" && <SalesTab days={days} />}
            {activeTab === "customers" && <CustomersTab days={days} />}
          </div>
        </div>
      </div>
  );
}

// Tab: Visão Geral
function OverviewTab({ days = 7 }: { days?: number }) {
  const { data: overview, loading: overviewLoading } = useDashboardOverview(days, true);
  const { data: messageVolume, loading: volumeLoading } = useMessageVolume(days);
  const { data: alerts, loading: alertsLoading } = useDashboardAlerts(true);
  const { data: recentChats, loading: chatsLoading } = useRecentChats(10);
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Sua visão geral</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard
            title="Conversas Ativas"
            value={overview?.activeChats || 0}
            change={overview?.activeChatsChange}
            icon={<FiMessageSquare size={18} />}
            loading={overviewLoading}
            accentColor="blue"
          />
          <KPICard
            title="Novos Leads"
            value={overview?.newLeads || 0}
            change={overview?.newLeadsChange}
            icon={<FiUsers size={18} />}
            loading={overviewLoading}
            accentColor="purple"
          />
          <KPICard
            title="Taxa de Conversão"
            value={overview?.conversionRate || 0}
            change={overview?.conversionRateChange}
            icon={<FiTrendingUp size={18} />}
            suffix="%"
            loading={overviewLoading}
            accentColor="teal"
          />
          <KPICard
            title="Tempo Médio Resposta"
            value={formatTime(overview?.avgResponseTime || 0)}
            icon={<FiClock size={18} />}
            loading={overviewLoading}
            accentColor="orange"
          />
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* Volume de Mensagens */}
        <div className="col-span-12 lg:col-span-8">
          <ChartContainer title={`Volume de Mensagens (Últimos ${days} Dias)`} loading={volumeLoading}>
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
              color="#2fb463" // livechat green
            />
          </ChartContainer>
        </div>

        {/* Alertas */}
        <div className="col-span-12 lg:col-span-4">
          <div className="h-full flex flex-col overflow-hidden">
            <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Alertas e Pendências
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-4">
              <AlertsPanel alerts={alerts} loading={alertsLoading} />
            </div>
          </div>
        </div>
      </div>

      {/* Conversas Recentes */}
      <section>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Conversas Recentes</h3>
            <button 
              onClick={() => navigate("/livechat")}
              className="text-xs font-medium text-[#2fb463] hover:text-[#1f8b49] dark:text-[#74e69e]"
            >
              Ver todas
            </button>
          </div>
          <div className="overflow-x-auto">
            {chatsLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-3">Cliente</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Última Mensagem</th>
                    <th className="px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentChats.map((chat: any) => (
                    <tr key={chat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <FiUser size={14} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">{chat.display_name || chat.customer_name || "Sem nome"}</div>
                            <div className="text-[10px] text-slate-500">{chat.customer_phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {chat.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{chat.last_message || "..."}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString("pt-BR") : "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/livechat/${chat.id}`)} 
                          className="text-xs font-bold text-[#2fb463] hover:text-[#1f8b49] dark:text-[#74e69e] uppercase tracking-wider"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// Tab: Atendimento
function AttendanceTab({ days = 7 }: { days?: number }) {
  const { data: messageVolume, loading: volumeLoading } = useMessageVolume(days);
  const { data: inboxStats, loading: inboxLoading } = useInboxStats();

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8">
        <ChartContainer title={`Volume de Mensagens (Últimos ${days} Dias)`} loading={volumeLoading}>
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
            colors={["#4f46e5", "#818cf8"]}
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
        <div className="overflow-hidden">
          <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Estatísticas por Inbox
            </h3>
          </div>
          <div className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inboxStats.map((inbox) => (
                <div
                  key={inbox.id}
                  className="p-5 border-b border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {inbox.name}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {inbox.provider}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Total</div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {inbox.stats.total_contacts}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Ativos</div>
                      <div className="text-2xl font-bold text-[#2fb463] dark:text-[#74e69e]">
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
function AIAgentsTab({ days = 7 }: { days?: number }) {
  const navigate = useNavigate();
  const { data: monitoring, loading: monitoringLoading, refetch } = useAgentMonitoring(days);
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
      <div className="grid grid-cols-12 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-span-12 md:col-span-3 h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
        <div className="col-span-12 lg:col-span-8 h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="col-span-12 lg:col-span-4 h-80 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const summary = monitoring?.summary || { totalConversations: 0, totalErrors: 0, activeAgents: 0, totalAgents: 0 };
  const charts = monitoring?.charts || { conversationsOverTime: [] };
  const agents = monitoring?.agents || [];
  const recentErrors = monitoring?.recentErrors || [];

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Conversas Totais"
          value={summary.totalConversations}
          icon={<FiMessageSquare size={18} />}
          accentColor="blue"
        />
        <KPICard
          title="Erros Detectados"
          value={summary.totalErrors}
          icon={<FiAlertCircle size={18} />}
          accentColor="red"
        />
        <KPICard
          title="Agentes Ativos"
          value={summary.activeAgents}
          icon={<FiZap size={18} />}
          accentColor="green"
        />
        <KPICard
          title="Taxa de Sucesso"
          value={summary.totalConversations > 0 ? (((summary.totalConversations - summary.totalErrors) / summary.totalConversations) * 100).toFixed(1) : "100"}
          suffix="%"
          icon={<FiTrendingUp size={18} />}
          accentColor="teal"
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Gráfico de Volume */}
        <div className="col-span-12 lg:col-span-8">
          <ChartContainer title="Volume de Conversas vs Erros">
            <LineChartComponent
              data={charts.conversationsOverTime}
              dataKeys={["total", "errors"]}
              colors={["#4f46e5", "#ef4444"]}
            />
          </ChartContainer>
        </div>

        {/* Lista de Agentes e Atividade */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="flex-1 overflow-hidden">
            <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Status dos Agentes
              </h3>
            </div>
            <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {agents.map((agent: any) => (
                <div
                  key={agent.id}
                  className="p-3 border-b border-slate-100 dark:border-slate-800 transition-all hover:border-[#2fb463]/30 group/agent"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {agent.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => navigate(`/agents/${agent.id}/playground`)}
                        className="opacity-0 group-hover/agent:opacity-100 p-1 hover:bg-[#2fb463]/10 rounded text-[#2fb463] transition-all"
                        title="Playground"
                      >
                        <FiZap size={14} />
                      </button>
                      <span
                        className={`flex h-2 w-2 rounded-full ${
                          agent.status === 'ACTIVE' ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span>{agent.metrics?.total_conversations || 0} conversas</span>
                    <span className={agent.metrics?.error_count > 0 ? "text-rose-500" : ""}>
                      {agent.metrics?.error_count || 0} erros
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-0">
             <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
               <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               Atividade em Tempo Real
             </h3>
             <div className="space-y-4">
               {liveActivity.length === 0 ? (
                 <div className="text-xs text-slate-500 italic">Aguardando atividade...</div>
               ) : (
                 liveActivity.map((act, i) => (
                   <div key={i} className="flex items-start gap-3 text-xs animate-in fade-in slide-in-from-left-2 duration-300">
                     <div className="mt-0.5 p-1 bg-[#2fb463]/10 rounded text-[#2fb463]">
                       <FiMessageSquare size={12} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="font-bold text-slate-900 dark:text-white truncate">{act.agentName || 'Agente'}</div>
                       <div className="text-slate-500 truncate">{act.message || 'Processando mensagem...'}</div>
                     </div>
                     <div className="text-slate-400 whitespace-nowrap text-[10px]">
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
          <div className="overflow-hidden">
            <div className="py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FiAlertCircle className="text-rose-500" /> Erros Recentes de Agentes
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-3">Data/Hora</th>
                    <th className="px-6 py-3">Agente</th>
                    <th className="px-6 py-3">Tipo de Erro</th>
                    <th className="px-6 py-3">Mensagem</th>
                    <th className="px-6 py-3">Gravidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentErrors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500 italic">
                        Nenhum erro detectado recentemente.
                      </td>
                    </tr>
                  ) : (
                    recentErrors.map((error: any) => (
                      <tr key={error.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(error.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-900 dark:text-white">
                          {agents.find((a: any) => a.id === error.agent_id)?.name || 'Agente Desconhecido'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {error.error_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
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
function CampaignsTab({ days = 7 }: { days?: number }) {
  const { data: campaignStats, loading: campaignsLoading } = useCampaignStats(days);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard
        title="Total de Campanhas"
        value={campaignStats?.total || 0}
        icon={<FiSend size={18} />}
        loading={campaignsLoading}
        accentColor="green"
      />
      <KPICard
        title="Em Execução"
        value={campaignStats?.running || 0}
        icon={<FiActivity size={18} />}
        loading={campaignsLoading}
        accentColor="green"
      />
      <KPICard
        title="Concluídas"
        value={campaignStats?.completed || 0}
        icon={<FiTrendingUp size={18} />}
        loading={campaignsLoading}
        accentColor="blue"
      />
      <KPICard
        title="Com Erro"
        value={campaignStats?.failed || 0}
        icon={<FiActivity size={18} />}
        loading={campaignsLoading}
        accentColor="red"
      />

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
            colors={["#4f46e5", "#f59e0b", "#10b981", "#ef4444"]}
          />
        </ChartContainer>
      </div>
    </div>
  );
}

// Tab: Vendas
function SalesTab({ days = 7 }: { days?: number }) {
  const { data: funnel, loading: funnelLoading } = useFunnelData(days);
  const { data: leadStats, loading: leadsLoading } = useLeadStats(days);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard
        title="Total de Leads"
        value={leadStats?.total || 0}
        icon={<FiTarget size={18} />}
        loading={leadsLoading}
        accentColor="green"
      />
      <KPICard
        title="Leads Ativos"
        value={leadStats?.active || 0}
        icon={<FiTrendingUp size={18} />}
        loading={leadsLoading}
        accentColor="green"
      />
      <KPICard
        title="Taxa de Conversão"
        value={leadStats?.conversionRate || 0}
        icon={<FiTarget size={18} />}
        suffix="%"
        loading={leadsLoading}
        accentColor="teal"
      />
      <KPICard
        title="Ticket Médio"
        value={`R$ ${(leadStats?.avgTicket || 0).toFixed(2)}`}
        icon={<FiTrendingUp size={18} />}
        loading={leadsLoading}
        accentColor="orange"
      />

      <div className="col-span-12">
        <ChartContainer title="Funil de Vendas" loading={funnelLoading}>
          <BarChartComponent
            data={funnel.map((stage) => ({
              name: stage.name,
              value: stage.count,
              leads: stage.count,
            }))}
            dataKeys={["leads"]}
            colors={["#4f46e5"]}
            horizontal
            height={Math.max(200, funnel.length * 40)}
          />
        </ChartContainer>
      </div>
    </div>
  );
}

// Tab: Clientes
function CustomersTab({ days = 7 }: { days?: number }) {
  const { data: topCustomers, loading: customersLoading } = useTopCustomers(days, 10);

  return (
    <div className="space-y-8">
      <div className="overflow-hidden">
        <div className="pb-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top 10 Clientes por Interação (Últimos {days} Dias)</h3>
        </div>
        <div className="py-6">
          {customersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topCustomers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 p-4 transition-all hover:border-[#2fb463]/30"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2fb463]/10 dark:bg-[#2fb463]/20 font-bold text-[#2fb463] dark:text-[#74e69e]">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {customer.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {customer.phone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#2fb463] dark:text-[#74e69e]">
                      {customer.messageCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">mensagens</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

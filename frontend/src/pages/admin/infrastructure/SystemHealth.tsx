// frontend/src/pages/admin/infrastructure/SystemHealth.tsx

import React, { useState, useEffect } from 'react';
import { 
  FiServer, FiZap, FiDatabase, FiCpu, FiRefreshCw, FiActivity, FiLayers
} from 'react-icons/fi';
import { api } from '@/lib/api';
import { showToast } from '../../../hooks/useToast';

import OverviewTab from './tabs/OverviewTab';
import RedisTab from './tabs/RedisTab';
import RabbitTab from './tabs/RabbitTab';
import DatabaseTab from './tabs/DatabaseTab';
import WorkersTab from './tabs/WorkersTab';

export function SystemHealth() {
  const [activeTab, setActiveTab] = useState<'overview' | 'redis' | 'rabbit' | 'db' | 'workers'>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Auto refresh cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/api/admin/infrastructure/summary');
      setData(res.data);
    } catch (error) {
      showToast('Erro ao carregar dados de infraestrutura', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Geral', icon: FiActivity },
    { id: 'redis', label: 'Redis (Cache)', icon: FiZap },
    { id: 'rabbit', label: 'RabbitMQ (Filas)', icon: FiLayers },
    { id: 'db', label: 'Banco (PG)', icon: FiDatabase },
    { id: 'workers', label: 'Workers', icon: FiCpu },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Monitoramento</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Infraestrutura do Sistema</h2>
          <p className="text-sm text-slate-400">
            Acompanhe a saúde, latência e carga dos serviços base.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all disabled:opacity-50"
        >
          <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Atualizando...' : 'Atualizar agora'}
        </button>
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm font-medium
                ${activeTab === tab.id 
                  ? 'bg-slate-800 border-white/10 text-white shadow-lg' 
                  : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}
              `}
            >
              <tab.icon className={activeTab === tab.id ? 'text-indigo-400' : ''} />
              {tab.label}
            </button>
          ))}
          
          <div className="mt-8 p-4 rounded-xl border border-white/5 bg-slate-900/50">
            <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Última leitura</h4>
            <p className="text-xs text-slate-400">
              {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--:--:--'}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-4 min-h-[500px]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <FiRefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="text-sm text-slate-400 italic">Carregando métricas em tempo real...</p>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'redis' && <RedisTab stats={data?.redis} />}
              {activeTab === 'rabbit' && <RabbitTab stats={data?.rabbit} />}
              {activeTab === 'db' && <DatabaseTab stats={data?.db} />}
              {activeTab === 'workers' && <WorkersTab workers={data?.workers} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



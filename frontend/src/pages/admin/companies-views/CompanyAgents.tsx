import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FiArrowLeft, FiEdit2, FiEye, FiEyeOff, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { CompanyOutletContext } from '../types';
import type { AgentTool, Tool } from '../../../types/types';

export type AdminAgent = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  model: string | null;
  integration_openai_id: string | null;
  aggregation_enabled: boolean;
  aggregation_window_sec: number | null;
  max_batch_messages: number | null;
  reply_if_idle_sec: number | null;
  allow_handoff: boolean;
  ignore_group_messages: boolean;
  enabled_inbox_ids: string[];
  created_at: string;
  updated_at: string | null;
};

export type AgentFormState = {
  name: string;
  description: string;
  status: AdminAgent['status'];
  model: string;
  integration_openai_id: string;
  aggregation_enabled: boolean;
  aggregation_window_sec: string;
  max_batch_messages: string;
  reply_if_idle_sec: string;
  allow_handoff: boolean;
  ignore_group_messages: boolean;
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

export function CompanyAgents() {
  const { company, analytics, refresh } = useOutletContext<CompanyOutletContext>();
  const companyId = company?.id;
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionAgentId, setActionAgentId] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    if (!companyId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/admin/companies/${companyId}/agents`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data: AdminAgent[] = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      return;
    }
    loadAgents();
  }, [companyId, loadAgents]);

  const mutateAgent = useCallback(
    async (agentIdToUpdate: string, payload: Partial<AdminAgent>) => {
      if (!companyId) {
        throw new Error('Empresa inválida');
      }

      const response = await fetch(`${API_BASE}/api/admin/companies/${companyId}/agents/${agentIdToUpdate}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await parseError(response));
      }

      const updated: AdminAgent = await response.json();
      setAgents((prev) => prev.map((agent) => (agent.id === updated.id ? updated : agent)));
      refresh?.().catch(() => {});
      return updated;
    },
    [companyId, refresh]
  );

  const selectedAgent = useMemo(() => {
    if (!agentId) {
      return null;
    }
    return agents.find((agent) => agent.id === agentId) ?? null;
  }, [agentId, agents]);

  const handleToggleStatus = async (agent: AdminAgent) => {
    try {
      setActionAgentId(agent.id);
      const nextStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await mutateAgent(agent.id, { status: nextStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar agente');
    } finally {
      setActionAgentId(null);
    }
  };

  const handleRefresh = async () => {
    if (loading) {
      return;
    }
    await loadAgents();
  };

  const handleEditorSave = async (payload: Partial<AdminAgent>) => {
    if (!selectedAgent) {
      return;
    }
    try {
      setEditorSaving(true);
      setEditorError(null);
      await mutateAgent(selectedAgent.id, payload);
      navigate(`/admin/companies/${companyId}/agents`);
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Erro ao salvar agente');
    } finally {
      setEditorSaving(false);
    }
  };

  const handleCloseEditor = () => {
    setEditorError(null);
    if (companyId) {
      navigate(`/admin/companies/${companyId}/agents`);
    } else {
      navigate('/admin/companies');
    }
  };

  const headerStats = useMemo(() => {
    const total = analytics?.counts.agents ?? agents.length;
    const active = agents.filter((agent) => agent.status === 'ACTIVE').length;
    return { total, active };
  }, [agents, analytics?.counts.agents]);

  if (!companyId) {
    return (
      <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
        <p className="text-sm text-slate-400">Selecione uma empresa para visualizar os agentes.</p>
      </div>
    );
  }

  if (agentId) {
    if (loading && !selectedAgent) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />
        </div>
      );
    }

    if (!selectedAgent) {
      return (
        <div className="space-y-4 rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
          <button
            type="button"
            onClick={handleCloseEditor}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <FiArrowLeft />
            Voltar para Agentes
          </button>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
            {error ?? 'Agente não encontrado para esta empresa.'}
          </div>
        </div>
      );
    }

    return (
      <AgentEditorPanel
        companyId={companyId!}
        agent={selectedAgent}
        saving={editorSaving}
        errorMessage={editorError}
        onSubmit={handleEditorSave}
        onCancel={handleCloseEditor}
        onToggleStatus={() => handleToggleStatus(selectedAgent)}
        toggleLoading={actionAgentId === selectedAgent.id}
      />
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Agentes</h3>
          <p className="mt-2 text-sm text-slate-400">
            Controle completo dos bots conectados à conta {company?.name ?? ''}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {headerStats.active} ativo(s) / {headerStats.total} total
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            {loading ? 'Atualizando...' : 'Recarregar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">{error}</div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-white" />
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          Nenhum agente encontrado para esta empresa.
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggleStatus={() => handleToggleStatus(agent)}
              onEdit={() => navigate(`/admin/companies/${companyId}/agents/${agent.id}`)}
              loading={actionAgentId === agent.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onToggleStatus,
  onEdit,
  loading,
}: {
  agent: AdminAgent;
  onToggleStatus: () => void;
  onEdit: () => void;
  loading: boolean;
}) {
  const isActive = agent.status === 'ACTIVE';

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-lg font-semibold text-white">{agent.name}</h4>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700/60 text-slate-300'
              }`}
            >
              {agent.status}
            </span>
            {agent.model && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">{agent.model}</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-400 line-clamp-2">
            {agent.description || 'Sem descrição definida.'}
          </p>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>
              ID: <span className="font-mono text-slate-300">{agent.id}</span>
            </p>
            <p>Atualizado: {agent.updated_at ? new Date(agent.updated_at).toLocaleString('pt-BR') : 'Nunca'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
              loading
                ? 'cursor-not-allowed opacity-60'
                : isActive
                ? 'bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/30'
                : 'bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
            }`}
          >
            {loading ? <FiRefreshCw className="animate-spin" /> : isActive ? <FiEyeOff /> : <FiEye />}
            {isActive ? 'Desativar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
          >
            <FiEdit2 />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentEditorPanel({
  companyId,
  agent,
  saving,
  errorMessage,
  onSubmit,
  onCancel,
  onToggleStatus,
  toggleLoading,
}: {
  companyId: string;
  agent: AdminAgent;
  saving: boolean;
  errorMessage: string | null;
  onSubmit: (payload: Partial<AdminAgent>) => Promise<void>;
  onCancel: () => void;
  onToggleStatus: () => void;
  toggleLoading: boolean;
}) {
  const [form, setForm] = useState<AgentFormState>(() => buildFormState(agent));
  const [localError, setLocalError] = useState<string | null>(null);
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsSaving, setToolsSaving] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);

  useEffect(() => {
    setForm(buildFormState(agent));
    setLocalError(null);
  }, [agent]);

  const loadAgentTools = useCallback(async () => {
    setToolsError(null);
    setToolsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/companies/${companyId}/agents/${agent.id}/tools`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data: AgentTool[] = await response.json();
      setAgentTools(data);
    } catch (err) {
      setAgentTools([]);
      setToolsError(err instanceof Error ? err.message : 'Erro ao carregar ferramentas');
    } finally {
      setToolsLoading(false);
    }
  }, [agent.id, companyId]);

  const loadAvailableTools = useCallback(async () => {
    setToolsError(null);
    setAvailableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('is_active', 'true');
      const response = await fetch(
        `${API_BASE}/api/admin/companies/${companyId}/tools?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data: Tool[] = await response.json();
      const usedTools = new Set(agentTools.map((tool) => tool.tool_id));
      setAvailableTools(data.filter((tool) => !usedTools.has(tool.id)));
    } catch (err) {
      setAvailableTools([]);
      setToolsError(err instanceof Error ? err.message : 'Erro ao carregar ferramentas disponíveis');
    } finally {
      setAvailableLoading(false);
    }
  }, [agentTools, companyId]);

  useEffect(() => {
    loadAgentTools();
    setToolsModalOpen(false);
    setAvailableTools([]);
  }, [loadAgentTools]);

  const updateField = (field: keyof AgentFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTool = async (toolId: string) => {
    try {
      setToolsSaving(true);
      setToolsError(null);
      const response = await fetch(
        `${API_BASE}/api/admin/companies/${companyId}/agents/${agent.id}/tools`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_id: toolId, is_enabled: true }),
        }
      );
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      await loadAgentTools();
      setToolsModalOpen(false);
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : 'Erro ao adicionar ferramenta');
    } finally {
      setToolsSaving(false);
    }
  };

  const handleRemoveTool = async (toolId: string) => {
    const confirmed = window.confirm('Remover esta ferramenta do agente?');
    if (!confirmed) {
      return;
    }
    try {
      setToolsSaving(true);
      setToolsError(null);
      const response = await fetch(
        `${API_BASE}/api/admin/companies/${companyId}/agents/${agent.id}/tools/${toolId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      await loadAgentTools();
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : 'Erro ao remover ferramenta');
    } finally {
      setToolsSaving(false);
    }
  };

  const openAddToolModal = async () => {
    setToolsModalOpen(true);
    await loadAvailableTools();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.description && form.description.length > 40000) {
      setLocalError(`Descrição muito longa (${form.description.length} caracteres). Limite: 40000.`);
      return;
    }
    setLocalError(null);

    const payload: Partial<AdminAgent> = {
      name: form.name.trim(),
      description: form.description.trim() ? form.description : null,
      status: form.status,
      model: form.model.trim() || null,
      integration_openai_id: form.integration_openai_id.trim() || null,
      aggregation_enabled: form.aggregation_enabled,
      aggregation_window_sec: toNumberOrNull(form.aggregation_window_sec),
      max_batch_messages: toNumberOrNull(form.max_batch_messages),
      reply_if_idle_sec: toNumberOrNull(form.reply_if_idle_sec),
      allow_handoff: form.allow_handoff,
      ignore_group_messages: form.ignore_group_messages,
    };

    await onSubmit(payload);
  };

  const isActive = agent.status === 'ACTIVE';
  const lastUpdateLabel = agent.updated_at ? new Date(agent.updated_at).toLocaleString('pt-BR') : 'Nunca atualizado';

  return (
    <div className="space-y-6 rounded-3xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
      >
        <FiArrowLeft />
        Voltar para Agentes
      </button>

      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Agente</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{agent.name}</h2>
            <p className="mt-2 text-sm text-slate-400">ID: {agent.id}</p>
            <p className="text-xs text-slate-500">Última atualização: {lastUpdateLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700/60 text-slate-300'
              }`}
            >
              {agent.status}
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              disabled={toggleLoading}
              className={`inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium transition ${
                toggleLoading ? 'opacity-60' : 'hover:bg-white/10'
              }`}
            >
              {toggleLoading ? <FiRefreshCw className="animate-spin" /> : isActive ? <FiEyeOff /> : <FiEye />}
              {isActive ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        </div>

        {(localError || errorMessage) && (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {localError ?? errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Nome</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                required
              />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Status</span>
              <select
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as AdminAgent['status'])}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col text-sm text-slate-300">
            <span className="mb-1 font-medium text-slate-100">Descrição</span>
            <textarea
              rows={5}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Modelo (LLM)</span>
              <input
                type="text"
                value={form.model}
                onChange={(event) => updateField('model', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                placeholder="gpt-4o-mini"
              />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Integration ID</span>
              <input
                type="text"
                value={form.integration_openai_id}
                onChange={(event) => updateField('integration_openai_id', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                placeholder="file-abc123"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Janela de agregação (seg)</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.aggregation_window_sec}
                disabled={!form.aggregation_enabled}
                onChange={(event) => updateField('aggregation_window_sec', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none disabled:opacity-50"
                min="0"
              />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Máx. mensagens por lote</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.max_batch_messages}
                onChange={(event) => updateField('max_batch_messages', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                min="0"
              />
            </label>
            <label className="flex flex-col text-sm text-slate-300">
              <span className="mb-1 font-medium text-slate-100">Responder após inatividade (seg)</span>
              <input
                type="number"
                inputMode="numeric"
                value={form.reply_if_idle_sec}
                onChange={(event) => updateField('reply_if_idle_sec', event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-white focus:border-white/30 focus:outline-none"
                min="0"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="inline-flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.aggregation_enabled}
                onChange={(event) => updateField('aggregation_enabled', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>
                <span className="block font-semibold text-white">Agregação automática</span>
                <span className="text-slate-400">Combina mensagens próximas para reduzir custo.</span>
              </span>
            </label>
            <label className="inline-flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.allow_handoff}
                onChange={(event) => updateField('allow_handoff', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>
                <span className="block font-semibold text-white">Permitir handoff humano</span>
                <span className="text-slate-400">Autoriza enviar conversas para operadores.</span>
              </span>
            </label>
            <label className="inline-flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.ignore_group_messages}
                onChange={(event) => updateField('ignore_group_messages', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>
                <span className="block font-semibold text-white">Ignorar grupos</span>
                <span className="text-slate-400">Desabilita respostas automáticas em discussões em grupo.</span>
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <FiRefreshCw className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </form>

        <section className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Ferramentas conectadas</h3>
              <p className="text-sm text-slate-400">
                Gerencie as integrações que este agente pode chamar via tool-calling.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddToolModal}
              disabled={toolsSaving || toolsLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus />
              Adicionar ferramenta
            </button>
          </div>

          {toolsError && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              {toolsError}
            </div>
          )}

          <div className="min-h-[120px]">
            {toolsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-white" />
              </div>
            ) : agentTools.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                Nenhuma ferramenta atribuída ao agente.
              </div>
            ) : (
              <div className="space-y-3">
                {agentTools.map((agentTool) => (
                  <div
                    key={agentTool.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{agentTool.tool?.name ?? 'Ferramenta'}</p>
                      {agentTool.tool?.description && (
                        <p className="mt-1 text-xs text-slate-400">{agentTool.tool.description}</p>
                      )}
                      <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                        {agentTool.tool?.key || agentTool.tool_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          agentTool.is_enabled
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-slate-700/60 text-slate-300'
                        }`}
                      >
                        {agentTool.is_enabled ? 'Habilitada' : 'Desabilitada'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTool(agentTool.tool_id)}
                        disabled={toolsSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiTrash2 />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {toolsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-white">Adicionar ferramenta</h4>
                  <p className="text-sm text-slate-400">Selecione uma ferramenta ativa para vincular ao agente.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setToolsModalOpen(false);
                    setAvailableTools([]);
                  }}
                  className="rounded-full border border-white/10 p-2 text-white transition hover:bg-white/10"
                  aria-label="Fechar"
                >
                  <FiX />
                </button>
              </div>

              <div className="mt-6 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {availableLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />
                  </div>
                ) : availableTools.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                    Todas as ferramentas disponíveis já foram atribuídas a este agente.
                  </div>
                ) : (
                  availableTools.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handleAddTool(tool.id)}
                      disabled={toolsSaving}
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left transition hover:border-white/30 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <p className="text-sm font-semibold text-white">{tool.name}</p>
                      {tool.description && <p className="mt-1 text-xs text-slate-400">{tool.description}</p>}
                      <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">{tool.key}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildFormState(agent: AdminAgent): AgentFormState {
  return {
    name: agent.name ?? '',
    description: agent.description ?? '',
    status: agent.status,
    model: agent.model ?? '',
    integration_openai_id: agent.integration_openai_id ?? '',
    aggregation_enabled: agent.aggregation_enabled,
    aggregation_window_sec: agent.aggregation_window_sec?.toString() ?? '',
    max_batch_messages: agent.max_batch_messages?.toString() ?? '',
    reply_if_idle_sec: agent.reply_if_idle_sec?.toString() ?? '',
    allow_handoff: agent.allow_handoff,
    ignore_group_messages: agent.ignore_group_messages,
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload?.error) {
      return payload.error;
    }
    if (payload?.message) {
      return payload.message;
    }
  } catch {
    // Ignora falhas ao converter o corpo em JSON
  }
  return `${response.status} ${response.statusText}`.trim();
}

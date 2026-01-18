import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  FiAlertCircle, 
  FiCheckCircle, 
  FiSave, 
  FiPlus, 
  FiX, 
  FiInfo,
  FiCalendar,
  FiBox,
  FiZap,
  FiCreditCard,
  FiPlusCircle,
  FiSettings,
  FiActivity
} from "react-icons/fi";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminCompany {
  id: string;
  name: string;
  status: string;
  plan_id: string;
  plan?: {
    display_name: string;
    limits: Record<string, number>;
    features: Record<string, boolean>;
  };
}

interface SubscriptionDetails {
  id: string;
  status: string;
  plan_id: string;
  current_period_start: string;
  current_period_end: string;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  notes: string | null;
  custom_limits: Record<string, number> | null;
  custom_features: Record<string, boolean> | null;
  plan: {
    display_name: string;
    limits: Record<string, number>;
    features: Record<string, boolean>;
  };
}

const LIMITS_LABELS: Record<string, string> = {
  users: "Usuários",
  inboxes: "Canais (Inboxes)",
  ai_agents: "Agentes de IA",
  messages_per_month: "Mensagens/Mês",
  campaigns_per_month: "Campanhas/Mês",
  contacts: "Contatos (CRM)",
};

const FEATURES_LABELS: Record<string, string> = {
  white_label: "White Label",
  api_access: "Acesso à API",
  custom_templates: "Templates Personalizados",
  automation_module: "Módulo de Automação",
  calendar_module: "Módulo de Calendário",
  tasks_module: "Módulo de Tarefas",
  document_generation: "Geração de Documentos",
};

export const CompanySubscription = () => {
  const context = useOutletContext<any>();
  const company = context?.company as AdminCompany;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sub, setSub] = useState<SubscriptionDetails | null>(null);

  // Form states
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});
  const [customFeatures, setCustomFeatures] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");

  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000';

  useEffect(() => {
    if (company?.id) {
      fetchSubscription();
    }
  }, [company?.id]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/api/admin/companies/${company.id}/subscription`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao carregar assinatura");
      const data = await res.json();
      setSub(data);
      setCustomLimits(data.custom_limits || {});
      setCustomFeatures(data.custom_features || {});
      setNotes(data.notes || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch(`${API}/api/admin/companies/${company.id}/subscription/overrides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_limits: customLimits,
          custom_features: customFeatures,
          notes: notes,
        }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Falha ao salvar alterações");
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!confirm(`Tem certeza que deseja mudar o status para ${newStatus}?`)) return;
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/admin/companies/${company.id}/subscription/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      await fetchSubscription();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExtend = async () => {
    const days = prompt("Quantos dias deseja adicionar?", "7");
    if (!days || isNaN(parseInt(days))) return;
    try {
      setSaving(true);
      const res = await fetch(`${API}/api/admin/companies/${company.id}/subscription/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(days) }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao estender assinatura");
      await fetchSubscription();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleLimit = (key: string) => {
    const newLimits = { ...customLimits };
    if (newLimits[key] !== undefined) {
      delete newLimits[key];
    } else {
      newLimits[key] = (sub?.plan?.limits?.[key] || 0) + 1;
    }
    setCustomLimits(newLimits);
  };

  const updateLimitValue = (key: string, val: number) => {
    setCustomLimits({ ...customLimits, [key]: val });
  };

  const toggleFeature = (key: string) => {
    const newFeatures = { ...customFeatures };
    if (newFeatures[key] !== undefined) {
      delete newFeatures[key];
    } else {
      newFeatures[key] = !(sub?.plan?.features?.[key] || false);
    }
    setCustomFeatures(newFeatures);
  };

  const updateFeatureValue = (key: string, val: boolean) => {
    setCustomFeatures({ ...customFeatures, [key]: val });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/10 border-t-white" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="rounded-xl border border-white/5 bg-slate-900/50 p-12 text-center">
        <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-500" />
        <h3 className="text-lg font-medium text-white">Nenhuma assinatura ativa</h3>
        <p className="mt-2 text-slate-400">Esta empresa não possui uma assinatura ou período de trial configurado.</p>
      </div>
    );
  }

  const isExpired = sub.status === 'past_due' || sub.status === 'canceled' || sub.status === 'unpaid';

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3 text-slate-400">
            <FiCreditCard />
            <span className="text-xs uppercase tracking-wider">Status</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              sub.status === 'active' || sub.status === 'trial' 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {sub.status.toUpperCase()}
            </span>
            {sub.cancel_at_period_end && (
              <span className="text-[10px] text-orange-400">Cancela em breve</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3 text-slate-400">
            <FiBox />
            <span className="text-xs uppercase tracking-wider">Plano Atual</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-white">{sub.plan.display_name}</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/70 p-5">
          <div className="flex items-center gap-3 text-slate-400">
            <FiCalendar />
            <span className="text-xs uppercase tracking-wider">Período Atual</span>
          </div>
          <p className="mt-2 text-sm text-slate-200">
            {format(new Date(sub.current_period_start), "dd 'de' MMM", { locale: ptBR })} - {format(new Date(sub.current_period_end), "dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>

        {sub.status === 'trial' && sub.trial_end && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-3 text-amber-500/70">
              <FiZap />
              <span className="text-xs uppercase tracking-wider">Trial Expira em</span>
            </div>
            <p className="mt-2 text-sm font-medium text-amber-200">
              {format(new Date(sub.trial_end), "dd/MM/yyyy")}
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="col-span-full rounded-xl border border-white/5 bg-slate-900/70 p-6">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
            <FiActivity className="text-blue-400" /> Ações Rápidas de Gestão
          </h3>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleExtend}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <FiPlusCircle /> Adicionar Dias
            </button>
            <button
              onClick={() => handleUpdateStatus('active')}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
            >
              Ativar Manualmente
            </button>
            <button
              onClick={() => handleUpdateStatus('expired')}
              className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              Expirar Manualmente
            </button>
            <button
              onClick={() => handleUpdateStatus('trial')}
              className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10"
            >
              Voltar para Trial
            </button>
          </div>
        </div>

        {/* Custom Limits */}
        <div className="rounded-xl border border-white/5 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Limites Customizados</h3>
            <span className="text-xs text-slate-500">Sobrescreve o padrão do plano</span>
          </div>

          <div className="space-y-4">
            {Object.entries(LIMITS_LABELS).map(([key, label]) => {
              const hasOverride = customLimits[key] !== undefined;
              const currentValue = hasOverride ? customLimits[key] : sub.plan.limits[key];
              
              return (
                <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                    <span className="text-[10px] text-slate-500">
                      Padrão do plano: {sub.plan.limits[key] === -1 ? 'Ilimitado' : sub.plan.limits[key]}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasOverride ? (
                      <div className="flex items-center gap-2">
                         <input
                          type="number"
                          value={currentValue}
                          onChange={(e) => updateLimitValue(key, parseInt(e.target.value))}
                          className="w-20 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-center text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button 
                          onClick={() => toggleLimit(key)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"
                          title="Remover override"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleLimit(key)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white"
                      >
                        <FiPlus size={12} /> Personalizar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Features */}
        <div className="rounded-xl border border-white/5 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Recursos Customizados</h3>
            <span className="text-xs text-slate-500">Sobrescreve o padrão do plano</span>
          </div>

          <div className="space-y-4">
            {Object.entries(FEATURES_LABELS).map(([key, label]) => {
              const hasOverride = customFeatures[key] !== undefined;
              const isEnabled = hasOverride ? customFeatures[key] : sub.plan.features[key];

              return (
                <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">{label}</span>
                    <span className="text-[10px] text-slate-500">
                      Padrão: {sub.plan.features[key] ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {hasOverride ? (
                       <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateFeatureValue(key, !isEnabled)}
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition ${
                            isEnabled 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {isEnabled ? 'Ativado' : 'Desativado'}
                        </button>
                        <button 
                          onClick={() => toggleFeature(key)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"
                          title="Remover override"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => toggleFeature(key)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white"
                      >
                        <FiPlus size={12} /> Personalizar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      <div className="rounded-xl border border-white/5 bg-slate-900/70 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Notas Internas</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Adicione observações sobre esta assinatura (visível apenas para admins)..."
          className="h-32 w-full rounded-xl border border-white/10 bg-slate-800 p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          {error && <span className="text-sm text-red-400">{error}</span>}
          {success && <span className="flex items-center gap-2 text-sm text-emerald-400"><FiCheckCircle /> Alterações salvas com sucesso!</span>}
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : (
            <>
              <FiSave />
              Salvar Alterações
            </>
          )}
        </button>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex gap-3">
          <FiInfo className="mt-0.5 shrink-0 text-blue-400" />
          <div className="text-xs leading-relaxed text-blue-200/70">
            <p className="font-medium text-blue-200">Como funcionam as sobrescritas?</p>
            <p className="mt-1">
              Os limites e recursos configurados aqui têm prioridade sobre as definições do plano Stripe. 
              Isso permite oferecer bônus ou tratar casos especiais sem precisar criar um novo plano no Stripe. 
              Remover uma personalização fará com que o sistema volte a usar o valor padrão do plano assinado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

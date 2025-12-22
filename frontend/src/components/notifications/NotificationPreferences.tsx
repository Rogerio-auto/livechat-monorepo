import { useState, useEffect, type ReactNode } from "react";
import { API, fetchJson } from "../../utils/api";
import type { NotificationPreferences } from "../../types/notifications";
import { Loader2, Save, Bell, Mail, MessageSquare, CheckCircle2, AlertCircle, Layout, CheckSquare, Settings } from "lucide-react";

const Field = ({ label, children, description }: { label: string; children: ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-50 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
      {description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<NotificationPreferences>(`${API}/api/notifications/preferences`);
      setPreferences(data);
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    setSaved(false);
    try {
      await fetchJson(`${API}/api/notifications/preferences`, {
        method: "PUT",
        body: JSON.stringify(preferences),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert("Erro ao salvar preferências");
    } finally {
      setSaving(false);
    }
  };

  const updateGlobalPreference = (key: string, value: boolean) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  const updateTypePreference = (type: string, value: boolean) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      preferences: {
        ...preferences.preferences,
        [type]: value,
      },
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-8 text-red-500 flex items-center gap-2">
        <AlertCircle size={20} />
        Erro ao carregar preferências
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Preferências de Notificações</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure como e quando deseja receber alertas do sistema.</p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {saved && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span className="text-sm font-medium">Preferências salvas com sucesso!</span>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Canais de Notificação</h3>
        
        <Field 
          label="E-mail" 
          description="Receber alertas e resumos diários por e-mail."
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <Mail size={18} />
              <span className="text-sm">Habilitar notificações por e-mail</span>
            </div>
            <Switch 
              checked={preferences.email_enabled} 
              onChange={(val) => updateGlobalPreference('email_enabled', val)} 
            />
          </div>
        </Field>

        <Field 
          label="WhatsApp" 
          description="Receber notificações importantes diretamente no seu WhatsApp."
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <MessageSquare size={18} />
              <span className="text-sm">Habilitar notificações por WhatsApp</span>
            </div>
            <Switch 
              checked={preferences.whatsapp_enabled} 
              onChange={(val) => updateGlobalPreference('whatsapp_enabled', val)} 
            />
          </div>
        </Field>

        <div className="pt-10 pb-4">
          <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tipos de Alerta</h3>
        </div>

        <Field 
          label="Projetos" 
          description="Alertas relacionados a prazos e atualizações de projetos."
        >
          <div className="space-y-4">
            <NotificationTypeItem
              label="Prazos de Projetos"
              type="project_deadline"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<Layout size={16} />}
            />
          </div>
        </Field>

        <Field 
          label="Tarefas" 
          description="Notificações sobre atribuições e conclusões de tarefas."
        >
          <div className="space-y-4">
            <NotificationTypeItem
              label="Tarefa atribuída a mim"
              type="task_assigned"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<CheckSquare size={16} />}
            />
            <NotificationTypeItem
              label="Tarefa concluída"
              type="task_completed"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<CheckCircle2 size={16} />}
            />
          </div>
        </Field>

        <Field 
          label="Comentários" 
          description="Alertas de menções em chats e comentários."
        >
          <div className="space-y-4">
            <NotificationTypeItem
              label="Fui mencionado"
              type="mention"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<MessageSquare size={16} />}
            />
          </div>
        </Field>

        <Field 
          label="Sistema" 
          description="Alertas críticos de sistema e status de campanhas."
        >
          <div className="space-y-4">
            <NotificationTypeItem
              label="Alertas do Sistema"
              type="system_alert"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<Settings size={16} />}
            />
            <NotificationTypeItem
              label="Status de Campanhas"
              type="campaign_status"
              preferences={preferences}
              onChange={updateTypePreference}
              icon={<Bell size={16} />}
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-all relative ${
        checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-800"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function NotificationTypeItem({
  label,
  type,
  preferences,
  onChange,
  icon
}: {
  label: string;
  type: string;
  preferences: NotificationPreferences;
  onChange: (type: string, value: boolean) => void;
  icon: ReactNode;
}) {
  const isEnabled = preferences.preferences?.[type] ?? true;

  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
        <span className="text-gray-400 group-hover:text-blue-500 transition-colors">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <Switch 
        checked={isEnabled} 
        onChange={(val) => onChange(type, val)} 
      />
    </div>
  );
}


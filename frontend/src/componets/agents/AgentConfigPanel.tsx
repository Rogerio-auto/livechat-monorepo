// AgentConfigPanel.tsx
// Painel de configuração avançada do agente com seleção de modelos por função

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import { InboxMultiSelect } from "./InboxMultiSelect";

type AgentConfig = {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  integration_openai_id: string | null;
  model: string | null;
  model_params: {
    temperature?: number;
    max_tokens?: number;
  } | null;
  media_config: {
    transcription_model?: string;
    vision_model?: string;
    tts_model?: string;
    tts_voice?: string;
  } | null;
  allow_handoff: boolean;
  reply_if_idle_sec?: number;
  ignore_group_messages: boolean;
  enabled_inbox_ids: string[];
};

type ModelOption = {
  id: string;
  name: string;
  description: string;
  provider: string;
};

const CHAT_MODELS: ModelOption[] = [
  { id: "gpt-4o", name: "GPT-4o", description: "Modelo mais avançado e versátil", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Rápido e econômico", provider: "OpenAI" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Alto desempenho", provider: "OpenAI" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Econômico e rápido", provider: "OpenAI" },
];

const TRANSCRIPTION_MODELS: ModelOption[] = [
  { id: "whisper-1", name: "Whisper v1", description: "Transcrição de áudio para texto", provider: "OpenAI" },
];

const VISION_MODELS: ModelOption[] = [
  { id: "gpt-4o", name: "GPT-4o Vision", description: "Análise avançada de imagens", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini Vision", description: "Análise rápida de imagens", provider: "OpenAI" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo Vision", description: "Visão de alta qualidade", provider: "OpenAI" },
];

const TTS_MODELS: ModelOption[] = [
  { id: "tts-1", name: "TTS Standard", description: "Texto para voz padrão", provider: "OpenAI" },
  { id: "tts-1-hd", name: "TTS HD", description: "Texto para voz alta qualidade", provider: "OpenAI" },
];

const TTS_VOICES = [
  { id: "alloy", name: "Alloy", description: "Voz neutra e clara" },
  { id: "echo", name: "Echo", description: "Voz masculina marcante" },
  { id: "fable", name: "Fable", description: "Voz narrativa" },
  { id: "onyx", name: "Onyx", description: "Voz grave e profunda" },
  { id: "nova", name: "Nova", description: "Voz feminina energética" },
  { id: "shimmer", name: "Shimmer", description: "Voz suave e agradável" },
];

type OpenAIIntegration = {
  id: string;
  company_id: string;
  name: string;
  api_key_encrypted: string;
};

type Props = {
  agentId: string;
  onBack: () => void;
  onSaved: () => void;
};

export function AgentConfigPanel({ agentId, onBack, onSaved }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [openAIIntegrations, setOpenAIIntegrations] = useState<OpenAIIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [agentId]);

  async function loadData() {
    try {
      setLoading(true);
      // Carregar config do agente e integrações em paralelo
      const [agentData, integrationsData] = await Promise.all([
        fetchJson<AgentConfig>(`${API}/api/agents/${agentId}`),
        fetchJson<OpenAIIntegration[]>(`${API}/integrations/openai`),
      ]);
      setConfig(agentData);
      setOpenAIIntegrations(integrationsData);
    } catch (err) {
      console.error("Erro ao carregar configuração:", err);
      setError("Erro ao carregar configuração do agente");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;

    try {
      setSaving(true);
      setError("");

      // Preparar payload removendo nulls de campos numéricos (Zod espera undefined, não null)
      const payload: any = {
        integration_openai_id: config.integration_openai_id || undefined,
        model: config.model || undefined,
        model_params: config.model_params || undefined,
        media_config: config.media_config || undefined,
        allow_handoff: config.allow_handoff,
          ignore_group_messages: config.ignore_group_messages,
          enabled_inbox_ids: config.enabled_inbox_ids,
      };

      // Adicionar campos numéricos apenas se tiverem valores definidos
      if (config.reply_if_idle_sec !== undefined) {
        payload.reply_if_idle_sec = config.reply_if_idle_sec;
      }

      await fetchJson(`${API}/api/agents/${agentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      onSaved();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Agente não encontrado</p>
        <button onClick={onBack} className="mt-4 text-blue-400 hover:text-blue-300">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white mb-4 flex items-center gap-2 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h2 className="text-3xl font-bold text-white mb-2">Configurar Agente</h2>
        <p className="text-gray-400">{config.name}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-4">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Integração OpenAI */}
        <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Integração OpenAI</h3>
              <p className="text-sm text-gray-400">Selecione a chave de API que o agente usará</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Integração OpenAI <span className="text-red-400">*</span>
              </label>
              <select
                value={config.integration_openai_id || ""}
                onChange={(e) => setConfig({ ...config, integration_openai_id: e.target.value || null })}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Selecione uma integração...</option>
                {openAIIntegrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>
              {!config.integration_openai_id && (
                <p className="mt-2 text-sm text-yellow-400">
                  ⚠️ O agente não responderá sem uma integração OpenAI configurada
                </p>
              )}
              {openAIIntegrations.length === 0 && (
                <p className="mt-2 text-sm text-red-400">
                  Nenhuma integração OpenAI encontrada. Configure uma integração primeiro.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Modelo de Atendimento (Chat) */}
        <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Modelo de Atendimento</h3>
              <p className="text-sm text-gray-400">Modelo usado para conversas e respostas</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Modelo Principal</label>
              <select
                value={config.model || ""}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecione um modelo</option>
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Temperatura (Criatividade)
                </label>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={config.model_params?.temperature ?? 0.7}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model_params: {
                        ...config.model_params,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">0 = Preciso, 2 = Criativo</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tokens Máximos</label>
                <input
                  type="number"
                  min="100"
                  max="4096"
                  step="100"
                  value={config.model_params?.max_tokens ?? 500}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model_params: {
                        ...config.model_params,
                        max_tokens: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Tamanho máximo da resposta</p>
              </div>
            </div>
          </div>
        </section>

        {/* Modelos de Mídia */}
        <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Modelos de Mídia</h3>
              <p className="text-sm text-gray-400">Processamento de áudio, imagem e voz</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Transcrição */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Modelo de Transcrição (Áudio → Texto)
              </label>
              <select
                value={config.media_config?.transcription_model || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    media_config: {
                      ...config.media_config,
                      transcription_model: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500"
              >
                <option value="">Nenhum (desabilitado)</option>
                {TRANSCRIPTION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Visão */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Modelo de Visão (Análise de Imagens)
              </label>
              <select
                value={config.media_config?.vision_model || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    media_config: {
                      ...config.media_config,
                      vision_model: e.target.value,
                    },
                  })
                }
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500"
              >
                <option value="">Nenhum (desabilitado)</option>
                {VISION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* TTS */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Modelo TTS (Texto → Voz)
                </label>
                <select
                  value={config.media_config?.tts_model || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      media_config: {
                        ...config.media_config,
                        tts_model: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Nenhum (desabilitado)</option>
                  {TTS_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} - {m.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Voz TTS</label>
                <select
                  value={config.media_config?.tts_voice || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      media_config: {
                        ...config.media_config,
                        tts_voice: e.target.value,
                      },
                    })
                  }
                  disabled={!config.media_config?.tts_model}
                  className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                >
                  <option value="">Selecione uma voz</option>
                  {TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} - {v.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Comportamento */}
        <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Comportamento do Agente</h3>
              <p className="text-sm text-gray-400">Configurações de timing e agregação</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="font-medium text-white">Permitir Transferência para Humano</p>
                <p className="text-sm text-gray-400">Agente pode transferir atendimento</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, allow_handoff: !config.allow_handoff })}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  config.allow_handoff ? "bg-green-600" : "bg-gray-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.allow_handoff ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Responder se Ocioso (segundos)
              </label>
              <input
                type="number"
                min="0"
                max="300"
                value={config.reply_if_idle_sec ?? 0}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  setConfig({ ...config, reply_if_idle_sec: val });
                }}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">0 = desabilitado, aguarda cliente enviar mensagem</p>
            </div>
          </div>
        </section>

          {/* Inboxes e Grupos */}
          <section className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Inboxes e Grupos</h3>
                <p className="text-sm text-gray-400">Controle onde o agente responde</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Toggle: Ignorar Grupos */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                <div>
                  <p className="font-medium text-white">Ignorar Mensagens de Grupos</p>
                  <p className="text-sm text-gray-400">Agente não responde em grupos do WhatsApp</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, ignore_group_messages: !config.ignore_group_messages })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    config.ignore_group_messages ? "bg-green-600" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      config.ignore_group_messages ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Seletor de Inboxes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Inboxes Habilitadas
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  {config.enabled_inbox_ids.length === 0 
                    ? "Agente responde em todas as inboxes" 
                    : `Agente responde em ${config.enabled_inbox_ids.length} inbox(es) selecionada(s)`}
                </p>
                <InboxMultiSelect
                  selectedIds={config.enabled_inbox_ids}
                  onChange={(ids) => setConfig({ ...config, enabled_inbox_ids: ids })}
                />
              </div>
            </div>
          </section>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-xl transition"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>
    </div>
  );
}

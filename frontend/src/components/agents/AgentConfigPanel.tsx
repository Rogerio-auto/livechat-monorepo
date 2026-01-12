// AgentConfigPanel.tsx
// Painel de configuração avançada do agente com seleção de modelos por função

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";
import { InboxMultiSelect } from "./InboxMultiSelect";
import { showToast } from "../../hooks/useToast";
import { 
  ArrowLeft, 
  Save, 
  Cpu, 
  MessageSquare, 
  Video, 
  Settings2, 
  Inbox,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus
} from "lucide-react";

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
  { id: "o1-preview", name: "o1 Preview", description: "Novo modelo de raciocínio avançado", provider: "OpenAI" },
  { id: "o1-mini", name: "o1 Mini", description: "Raciocínio rápido e eficiente", provider: "OpenAI" },
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
  const [generatingIntegration, setGeneratingIntegration] = useState(false);
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

      // Auto-selecionar se houver apenas uma integração e nenhuma estiver selecionada
      if (integrationsData.length === 1 && !agentData.integration_openai_id) {
        setConfig(prev => prev ? { ...prev, integration_openai_id: integrationsData[0].id } : null);
      }

      // Se não houver nenhuma integração, disparar a criação automática silenciosamente
      if (integrationsData.length === 0) {
        console.log("Nenhuma integração OpenAI encontrada. Iniciando criação automática...");
        handleAutoGenerateIntegration();
      }
    } catch (err) {
      console.error("Erro ao carregar configuração:", err);
      setError("Erro ao carregar configuração do agente");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoGenerateIntegration() {
    try {
      setGeneratingIntegration(true);
      setError("");
      
      const res = await fetchJson<OpenAIIntegration>(`${API}/integrations/openai`, {
        method: "POST",
        body: JSON.stringify({
          name: "OpenAI Produção",
          auto_generate: true,
          default_model: "gpt-4o-mini"
        })
      });

      // Recarregar integrações e selecionar a nova
      const integrationsData = await fetchJson<OpenAIIntegration[]>(`${API}/integrations/openai`);
      setOpenAIIntegrations(integrationsData);
      
      if (config) {
        setConfig({ ...config, integration_openai_id: res.id });
      }
      
      showToast("Integração gerada com sucesso!", "success");
    } catch (err: any) {
      console.error("Erro ao gerar integração:", err);
      setError(err.message || "Erro ao gerar integração automática");
      showToast("Falha ao gerar integração automática", "error");
    } finally {
      setGeneratingIntegration(false);
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
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-gray-500 animate-pulse">Carregando configurações...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-900 font-medium">Agente não encontrado</p>
        <button 
          onClick={onBack} 
          className="mt-4 text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a lista
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4 flex items-center gap-2 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar para Agentes
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configurar Agente</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Ajuste o comportamento e modelos de {config.name}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-12 pb-12">
        {/* Integração OpenAI - ESCONDIDA (AUTOMÁTICA) */}
        {(!config.integration_openai_id || error.includes("OpenAI")) && (
          <section className="overflow-hidden">
            <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Integração OpenAI</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configuração automática da inteligência artificial</p>
                </div>
              </div>
            </div>

            <div className="py-6 space-y-4">
              {generatingIntegration ? (
                <div className="flex items-center gap-3 text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="font-medium">Configurando inteligência artificial para sua empresa...</p>
                </div>
              ) : (
                <div>
                  {openAIIntegrations.length === 0 ? (
                    <div className="flex flex-col gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle className="w-4 h-4" />
                        A IA ainda não foi configurada.
                      </div>
                      <button
                        onClick={handleAutoGenerateIntegration}
                        className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Configurar IA Agora
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800">
                      <CheckCircle2 className="w-5 h-5" />
                      <p className="font-medium">IA configurada e pronta para uso.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Modelo de Atendimento (Chat) */}
        <section className="overflow-hidden">
          <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modelo de Atendimento</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Modelo usado para conversas e respostas</p>
              </div>
            </div>
          </div>

          <div className="py-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Modelo Principal</label>
              <div className="relative">
                <select
                  value={config.model || ""}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none dark:[color-scheme:dark]"
                >
                  <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Selecione um modelo</option>
                  {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {m.name} - {m.description}
                    </option>
                  ))}
                  <option value="custom" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Outro (Digitar manualmente)</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                  <Settings2 className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              
              {(!CHAT_MODELS.find(m => m.id === config.model) && config.model) && (
                 <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Nome do modelo personalizado:</label>
                    <input 
                      type="text"
                      value={config.model || ""}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                      placeholder="Ex: gpt-4-32k"
                    />
                 </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Preciso (0)</span>
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">Criativo (2)</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tokens Máximos</label>
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase mt-2">Tamanho máximo da resposta</p>
              </div>
            </div>
          </div>
        </section>

        {/* Modelos de Mídia */}
        <section className="overflow-hidden">
          <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Modelos de Mídia</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Processamento de áudio, imagem e voz</p>
              </div>
            </div>
          </div>

          <div className="py-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Transcrição (Áudio → Texto)
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none dark:[color-scheme:dark]"
                >
                  <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Nenhum (desabilitado)</option>
                  {TRANSCRIPTION_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Visão (Análise de Imagens)
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none dark:[color-scheme:dark]"
                >
                  <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Nenhum (desabilitado)</option>
                  {VISION_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none dark:[color-scheme:dark]"
                >
                  <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Nenhum (desabilitado)</option>
                  {TTS_MODELS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Voz TTS</label>
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
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800 dark:[color-scheme:dark]"
                >
                  <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">Selecione uma voz</option>
                  {TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Comportamento */}
        <section className="overflow-hidden">
          <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <Settings2 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Comportamento</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configurações de timing e automação</p>
              </div>
            </div>
          </div>

          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Permitir Transferência para Humano</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">O agente pode transferir o atendimento para um atendente real</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, allow_handoff: !config.allow_handoff })}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  config.allow_handoff ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    config.allow_handoff ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Responder se Ocioso (segundos)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={config.reply_if_idle_sec ?? 0}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : undefined;
                    setConfig({ ...config, reply_if_idle_sec: val });
                  }}
                  className="w-32 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {config.reply_if_idle_sec && config.reply_if_idle_sec > 0 
                    ? `O agente enviará uma mensagem após ${config.reply_if_idle_sec}s de inatividade.`
                    : "Desabilitado. O agente aguardará o cliente enviar uma mensagem."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Inboxes e Grupos */}
        <section className="overflow-hidden">
          <div className="pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                <Inbox className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Inboxes e Grupos</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Controle onde o agente deve atuar</p>
              </div>
            </div>
          </div>

          <div className="py-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Ignorar Mensagens de Grupos</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">O agente não responderá em grupos do WhatsApp</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, ignore_group_messages: !config.ignore_group_messages })}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  config.ignore_group_messages ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    config.ignore_group_messages ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Inboxes Habilitadas
              </label>
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {config.enabled_inbox_ids.length === 0 
                    ? "Atualmente o agente responde em todas as inboxes disponíveis." 
                    : `O agente está restrito a ${config.enabled_inbox_ids.length} inbox(es) específica(s).`}
                </p>
                <InboxMultiSelect
                  selectedIds={config.enabled_inbox_ids}
                  onChange={(ids) => setConfig({ ...config, enabled_inbox_ids: ids })}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


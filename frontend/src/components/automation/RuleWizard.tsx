import { useState } from "react";
import { X, ArrowRight, ArrowLeft, Sparkles, Zap, Calendar, Target, Check } from "lucide-react";
import { useAutomationRules } from "../../hooks/useAutomationRules";
import type { TriggerType } from "../../types/automationRules";

interface RuleWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface RuleTemplate {
  id: string;
  icon: React.ReactNode;
  name: string;
  shortDesc: string;
  longDesc: string;
  value: string;
  triggerType: TriggerType;
  config: any;
  taskTemplate: any;
}

const TEMPLATES: RuleTemplate[] = [
  {
    id: "follow-up-3d",
    icon: <Zap className="w-8 h-8 text-orange-500" />,
    name: "Follow-up Rápido",
    shortDesc: "Recupere leads que pararam de responder",
    longDesc: "Cria uma tarefa urgente quando o lead fica 3 dias sem responder. Você nunca mais perde uma oportunidade por esquecimento!",
    value: "Recupera 20-30% dos leads que seriam perdidos",
    triggerType: "LEAD_INACTIVE",
    config: { days: 3 },
    taskTemplate: {
      title: "🔥 Follow-up: {{lead.name}}",
      description: "Lead sem resposta há {{config.days}} dias!\n\n💬 Sugestões:\n• Enviar mensagem perguntando se ainda tem interesse\n• Oferecer agendamento de call\n• Compartilhar case de sucesso",
      priority: "HIGH",
      due_date_offset: "+2h",
    },
  },
  {
    id: "new-lead",
    icon: <Sparkles className="w-8 h-8 text-purple-500" />,
    name: "Primeiro Contato",
    shortDesc: "Responda novos leads em até 30 minutos",
    longDesc: "Quando um novo lead entra no sistema, cria uma tarefa urgente para você responder rapidinho. Velocidade = mais vendas!",
    value: "Aumenta taxa de conversão em até 40%",
    triggerType: "LEAD_CREATED",
    config: {},
    taskTemplate: {
      title: "⚡ Novo lead: {{lead.name}}",
      description: "Lead acabou de entrar!\n\n📞 Fazer agora:\n1. Enviar mensagem de boas-vindas\n2. Perguntar como pode ajudar\n3. Qualificar interesse",
      priority: "HIGH",
      due_date_offset: "+30m",
    },
  },
  {
    id: "meeting-prep",
    icon: <Calendar className="w-8 h-8 text-blue-500" />,
    name: "Preparar Reunião",
    shortDesc: "Lembrete 1 dia antes de eventos",
    longDesc: "Cria uma tarefa de preparação 24h antes de cada reunião agendada. Entre preparado e impressione o cliente!",
    value: "Reuniões 3x mais produtivas",
    triggerType: "EVENT_UPCOMING",
    config: { hours_before: 24 },
    taskTemplate: {
      title: "📅 Preparar: {{event.title}}",
      description: "Reunião amanhã!\n\n✅ Checklist:\n1. Revisar histórico do cliente\n2. Preparar apresentação\n3. Confirmar horário",
      priority: "HIGH",
      due_date_offset: "+3h",
    },
  },
  {
    id: "follow-up-7d",
    icon: <Target className="w-8 h-8 text-green-500" />,
    name: "Follow-up Semanal",
    shortDesc: "Leads inativos há 1 semana",
    longDesc: "Para leads menos urgentes, cria tarefa de follow-up após 7 dias sem interação. Mantém relacionamento ativo!",
    value: "Mantém pipeline sempre aquecido",
    triggerType: "LEAD_INACTIVE",
    config: { days: 7 },
    taskTemplate: {
      title: "📞 Reativar: {{lead.name}}",
      description: "Lead sem contato há 1 semana.\n\n💡 Sugestões:\n• Compartilhar novidade/promoção\n• Perguntar se precisa de ajuda\n• Agendar conversa",
      priority: "MEDIUM",
      due_date_offset: "+1d",
    },
  },
];

export function RuleWizard({ onClose, onSuccess }: RuleWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createRule } = useAutomationRules();

  const handleSelectTemplate = (template: RuleTemplate) => {
    setSelectedTemplate(template);
    setRuleName(template.name);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    setLoading(true);
    setError(null);

    try {
      await createRule({
        name: ruleName,
        description: selectedTemplate.longDesc,
        is_active: isActive,
        trigger_type: selectedTemplate.triggerType,
        trigger_config: selectedTemplate.config,
        conditions: [],
        task_template: selectedTemplate.taskTemplate,
        check_existing_tasks: true,
        duplicate_prevention_window_hours: 48,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-md">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Criar Automação</h2>
          </div>
          <p className="text-blue-100 text-lg">
            Deixe o sistema trabalhar por você! Escolha uma automação e nunca mais perca oportunidades.
          </p>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-6">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? "bg-white" : "bg-white/30"}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? "bg-white" : "bg-white/30"}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 3 ? "bg-white" : "bg-white/30"}`} />
          </div>
        </div>

        {/* Step 1: Choose Template */}
        {step === 1 && (
          <div className="p-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Escolha o tipo de automação
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Clique na automação que faz mais sentido para o seu negócio
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="text-left p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform">
                      {template.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {template.shortDesc}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                        <Check className="w-4 h-4" />
                        {template.value}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Confirm & Customize */}
        {step === 2 && selectedTemplate && (
          <div className="p-8">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800 shadow">
                  {selectedTemplate.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    {selectedTemplate.longDesc}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg w-fit">
                    <Check className="w-4 h-4" />
                    {selectedTemplate.value}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da automação (pode personalizar se quiser)
                </label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
                  placeholder="Ex: Follow-up Rápido"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <label htmlFor="isActive" className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Ativar agora</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    (recomendado - pode desativar depois)
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !ruleName.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Criar Automação
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


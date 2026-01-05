import { useState, useEffect } from "react";
import { FaRobot, FaMagic, FaCheckCircle, FaSpinner, FaChevronRight, FaChevronLeft } from "react-icons/fa";
import { API, fetchJson } from "../../../utils/api";
import type { AgentTemplate, AgentTemplateQuestion } from "../../../types/types";

interface Props {
  onSave: (aiConfig: { template: string; training: string; answers?: Record<string, any>; isComplete?: boolean }) => void;
}

export function AIStep({ onSave }: Props) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [questions, setQuestions] = useState<AgentTemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(-1); // -1 significa seleção de template
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!selectedTemplate) return;

    const trainingText = Object.entries(answers)
      .map(([k, v]) => {
        const q = questions.find(q => q.key === k);
        return `${q?.label || k}: ${v}`;
      })
      .join("\n");

    onSave({
      template: selectedTemplate.id,
      training: trainingText,
      answers,
      isComplete: isFinished || (questions.length === 0 && selectedTemplate !== null)
    });
  }, [selectedTemplate, answers, isFinished, questions]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      setLoading(true);
      const data = await fetchJson<AgentTemplate[]>(`${API}/api/agent-templates`);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar templates de IA:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectTemplate(template: AgentTemplate) {
    setSelectedTemplate(template);
    setLoadingQuestions(true);
    try {
      const data = await fetchJson<AgentTemplateQuestion[]>(`${API}/api/agent-templates/${template.id}/questions`);
      const sorted = Array.isArray(data) ? data.sort((a, b) => a.order_index - b.order_index) : [];
      setQuestions(sorted);
      if (sorted.length > 0) {
        setCurrentQuestionIdx(0);
      } else {
        setCurrentQuestionIdx(-1);
      }
    } catch (err) {
      console.error("Erro ao carregar perguntas do template:", err);
    } finally {
      setLoadingQuestions(false);
      setIsFinished(false);
    }
  }

  const handleAnswer = (key: string, value: any) => {
    const newAnswers = { ...answers, [key]: value };
    setAnswers(newAnswers);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FaSpinner className="animate-spin text-[#2fb463] mb-4" size={40} />
        <p className="text-slate-500 font-medium">Carregando modelos de IA...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="space-y-10 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#2fb463]/10 text-[#2fb463]">
          <FaCheckCircle size={48} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-slate-900">Agente Configurado!</h2>
          <p className="text-slate-500">O template <strong>{selectedTemplate?.name}</strong> foi personalizado com sucesso.</p>
        </div>
        <button
          onClick={() => {
            setIsFinished(false);
            setSelectedTemplate(null);
            setQuestions([]);
            setAnswers({});
            setCurrentQuestionIdx(-1);
          }}
          className="text-sm font-bold text-[#2fb463] hover:underline"
        >
          Escolher outro modelo
        </button>
      </div>
    );
  }

  // Tela de Seleção de Template
  if (currentQuestionIdx === -1) {
    return (
      <div className="space-y-10">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Seu Agente de IA</h2>
          <p className="text-slate-500">Escolha um modelo base para sua inteligência artificial.</p>
        </div>
        
        <div className="mx-auto max-w-4xl grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <button 
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              disabled={loadingQuestions}
              className={`group relative flex flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all ${
                selectedTemplate?.id === template.id 
                  ? "border-[#2fb463] bg-[#2fb463]/5 shadow-lg shadow-[#2fb463]/10" 
                  : "border-slate-100 bg-white hover:border-slate-200 hover:shadow-md"
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-colors ${
                selectedTemplate?.id === template.id ? "bg-[#2fb463] text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
              }`}>
                {template.category === "sales" ? "💰" : template.category === "support" ? "🛠️" : "🤖"}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{template.name}</h3>
                <p className="text-xs leading-relaxed text-slate-500 mt-1">{template.description}</p>
              </div>
              {loadingQuestions && selectedTemplate?.id === template.id && (
                <div className="absolute top-4 right-4">
                  <FaSpinner className="animate-spin text-[#2fb463]" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Tela de Perguntas do Wizard
  const currentQuestion = questions[currentQuestionIdx];

  return (
    <div className="space-y-10">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-[#2fb463] font-bold text-sm uppercase tracking-widest mb-2">
          <FaRobot /> {selectedTemplate?.name}
        </div>
        <h2 className="text-3xl font-bold text-slate-900">{currentQuestion.label}</h2>
        {currentQuestion.description && (
          <p className="text-slate-500">{currentQuestion.description}</p>
        )}
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          {currentQuestion.type === "textarea" ? (
            <textarea
              autoFocus
              value={answers[currentQuestion.key] || ""}
              onChange={(e) => handleAnswer(currentQuestion.key, e.target.value)}
              placeholder={currentQuestion.placeholder || "Digite aqui..."}
              className="h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-lg outline-none focus:border-[#2fb463] focus:ring-4 focus:ring-[#2fb463]/10 transition-all resize-none"
            />
          ) : currentQuestion.type === "select" ? (
            <div className="grid grid-cols-1 gap-3">
              {(currentQuestion.options as any[])?.map((opt: any) => (
                <button
                  key={opt.value || opt}
                  onClick={() => handleAnswer(currentQuestion.key, opt.value || opt)}
                  className={`flex items-center justify-between rounded-2xl border-2 p-5 text-left font-bold transition-all ${
                    answers[currentQuestion.key] === (opt.value || opt)
                      ? "border-[#2fb463] bg-[#2fb463]/5 text-[#2fb463]"
                      : "border-slate-100 hover:border-slate-200 text-slate-600"
                  }`}
                >
                  {opt.label || opt}
                  {answers[currentQuestion.key] === (opt.value || opt) && <FaCheckCircle />}
                </button>
              ))}
            </div>
          ) : (
            <input
              autoFocus
              type={currentQuestion.type === "number" ? "number" : "text"}
              value={answers[currentQuestion.key] || ""}
              onChange={(e) => handleAnswer(currentQuestion.key, e.target.value)}
              placeholder={currentQuestion.placeholder || "Digite aqui..."}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-lg outline-none focus:border-[#2fb463] focus:ring-4 focus:ring-[#2fb463]/10 transition-all"
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <button
              onClick={() => {
                if (currentQuestionIdx === 0) setCurrentQuestionIdx(-1);
                else setCurrentQuestionIdx(prev => prev - 1);
              }}
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-all"
            >
              <FaChevronLeft /> Voltar
            </button>

            <div className="flex gap-1">
              {questions.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentQuestionIdx ? "w-8 bg-[#2fb463]" : "w-2 bg-slate-100"
                  }`} 
                />
              ))}
            </div>

            <button
              disabled={currentQuestion.required && !answers[currentQuestion.key]}
              onClick={() => {
                if (currentQuestionIdx < questions.length - 1) {
                  setCurrentQuestionIdx(prev => prev + 1);
                } else {
                  setIsFinished(true);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-all disabled:opacity-30"
            >
              {currentQuestionIdx === questions.length - 1 ? "Concluir Agente" : "Próxima"} <FaChevronRight />
            </button>
          </div>
        </div>
        
        {currentQuestion.help && (
          <p className="mt-6 text-center text-xs text-slate-400 italic">
            💡 {currentQuestion.help}
          </p>
        )}
      </div>
    </div>
  );
}

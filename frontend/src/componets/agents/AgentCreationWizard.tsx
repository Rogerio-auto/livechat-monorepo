// AgentCreationWizard.tsx
// Wizard passo-a-passo para criar agente (uma pergunta por vez)

import { useState, useEffect } from "react";
import type { AgentTemplate, AgentTemplateQuestion } from "../../types/types";

type Props = {
  template: AgentTemplate;
  questions: AgentTemplateQuestion[];
  onComplete: (answers: Record<string, any>) => void;
  onBack: () => void;
};

export function AgentCreationWizard({ template, questions, onComplete, onBack }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showReview, setShowReview] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);

  const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);
  const totalSteps = sortedQuestions.length;
  const currentQuestion = sortedQuestions[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;

  function handleAnswer(value: any) {
    const newAnswers = { ...answers, [currentQuestion.key]: value };
    setAnswers(newAnswers);
    // Se o usuário veio da tela de revisão para editar uma pergunta específica,
    // após responder voltamos para a revisão, sem obrigar passar por todas as próximas perguntas
    if (returnToReview) {
      setReturnToReview(false);
      setTimeout(() => setShowReview(true), 200);
      return;
    }

    if (currentStep < totalSteps - 1) {
      // Próxima pergunta
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
    } else {
      // Última pergunta - mostrar review
      setTimeout(() => setShowReview(true), 300);
    }
  }

  function handlePrevious() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setShowReview(false);
    }
  }

  function handleEdit(questionKey: string) {
    const questionIndex = sortedQuestions.findIndex((q) => q.key === questionKey);
    setCurrentStep(questionIndex);
    setShowReview(false);
    setReturnToReview(true);
  }

  if (showReview) {
    return (
      <ReviewScreen
        template={template}
        questions={sortedQuestions}
        answers={answers}
        onEdit={handleEdit}
        onBack={() => setShowReview(false)}
        onConfirm={() => onComplete(answers)}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header with Progress */}
      <div className="mb-8">
        <button
          onClick={currentStep === 0 ? onBack : handlePrevious}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {currentStep === 0 ? "Escolher outro modelo" : "Pergunta anterior"}
        </button>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">
              Pergunta {currentStep + 1} de {totalSteps}
            </span>
            <span className="text-blue-400 font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-linear-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Navigation Pills - Navegação entre perguntas */}
        <div className="mb-4 -mx-6 px-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {sortedQuestions.map((q, idx) => {
              const isAnswered = answers[q.key] !== undefined && answers[q.key] !== "";
              const isCurrent = idx === currentStep;
              const canNavigate = idx < currentStep || isAnswered;
              
              return (
                <button
                  key={q.key}
                  onClick={() => canNavigate && setCurrentStep(idx)}
                  disabled={!canNavigate}
                  className={`
                    flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${isCurrent 
                      ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900" 
                      : isAnswered 
                        ? "bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700" 
                        : "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-50"
                    }
                  `}
                  title={q.label}
                >
                  <span className="font-bold">{idx + 1}</span>
                  {isAnswered && !isCurrent && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
            
            {/* Botão para ir direto à revisão */}
            {sortedQuestions.every((q) => answers[q.key] !== undefined && answers[q.key] !== "") && (
              <button
                onClick={() => setShowReview(true)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-linear-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Revisar
              </button>
            )}
          </div>
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="px-3 py-1 bg-gray-800 rounded-full">{template.name}</span>
          <span>→</span>
          <span>Configuração</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-700 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-3">{currentQuestion.label}</h2>
          {currentQuestion.help && (
            <p className="text-gray-400 text-sm flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{currentQuestion.help}</span>
            </p>
          )}
        </div>

        <QuestionInput
          key={currentQuestion.key}
          question={currentQuestion}
          value={answers[currentQuestion.key]}
          onChange={handleAnswer}
        />
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: AgentTemplateQuestion;
  value: any;
  onChange: (value: any) => void;
}) {
  const [inputValue, setInputValue] = useState(value || "");

  // Sincroniza quando a pergunta muda ou quando o valor vindo de fora muda
  // evita que a resposta anterior "vaze" para a próxima pergunta
  useEffect(() => {
    setInputValue(value || "");
  }, [question.key, value]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (question.required && !inputValue) {
      alert("Este campo é obrigatório!");
      return;
    }
    onChange(inputValue);
  }

  if (question.type === "textarea") {
    return (
      <form onSubmit={handleSubmit}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          maxLength={5000}
          placeholder="Digite sua resposta..."
          className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-700"
          autoFocus
        />
        <div className="mt-1 text-xs text-gray-400 text-right">{String(inputValue).length}/5000</div>
      <button
        type="submit"
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
      >
        Próximo
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  );
}  if (question.type === "select" && question.options) {
    return (
      <div className="space-y-3">
        {question.options.map((option: any) => {
          const optValue = typeof option === "string" ? option : option.value;
          const optLabel = typeof option === "string" ? option : option.label;

          return (
            <button
              key={optValue}
              onClick={() => onChange(optValue)}
              className="w-full text-left bg-gray-900 hover:bg-blue-900 border-2 border-gray-700 hover:border-blue-500 rounded-xl px-6 py-4 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">{optLabel}</span>
                <svg
                  className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onChange(true)}
          className="bg-gray-900 hover:bg-green-900 border-2 border-gray-700 hover:border-green-500 rounded-xl px-6 py-6 transition-all text-center"
        >
          <div className="text-white font-medium">Sim</div>
        </button>
        <button
          onClick={() => onChange(false)}
          className="bg-gray-900 hover:bg-red-900 border-2 border-gray-700 hover:border-red-500 rounded-xl px-6 py-6 transition-all text-center"
        >
          <div className="text-white font-medium">Não</div>
        </button>
      </div>
    );
  }

  // Default: text input
  return (
    <form onSubmit={handleSubmit}>
      <input
        type={question.type === "number" ? "number" : "text"}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        maxLength={5000}
        placeholder="Digite sua resposta..."
        className="w-full bg-gray-900 text-white rounded-xl px-4 py-4 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-700"
        autoFocus
      />
      <div className="mt-1 text-xs text-gray-400 text-right">{String(inputValue).length}/5000</div>
      <button
        type="submit"
        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
      >
        Próximo
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </form>
  );
}

function ReviewScreen({
  template,
  questions,
  answers,
  onEdit,
  onBack,
  onConfirm,
}: {
  template: AgentTemplate;
  questions: AgentTemplateQuestion[];
  answers: Record<string, any>;
  onEdit: (key: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={onBack}
        className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Quase lá!</h2>
        <p className="text-gray-400">Revise as informações antes de criar seu agente</p>
      </div>

      <div className="bg-linear-to-br from-gray-800 to-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-700 mb-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-white">{template.name}</h3>
            <p className="text-sm text-gray-400">{template.category}</p>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.key}
              className="bg-gray-900/50 rounded-xl p-4 hover:bg-gray-900 transition group"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-1">{q.label}</div>
                  <div className="text-white font-medium">
                    {String(answers[q.key] || "—")}
                  </div>
                </div>
                <button
                  onClick={() => onEdit(q.key)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onConfirm}
        className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Criar Agente
      </button>
    </div>
  );
}

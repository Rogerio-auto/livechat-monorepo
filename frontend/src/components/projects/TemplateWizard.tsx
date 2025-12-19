// frontend/src/components/projects/TemplateWizard.tsx

import { useState } from "react";
import { fetchJson } from "../../lib/fetch";
import { 
  Sun, 
  Hammer, 
  GraduationCap, 
  Calculator, 
  Stethoscope, 
  ShoppingBag, 
  PartyPopper, 
  Scale, 
  Home,
  ArrowRight, 
  CheckCircle2,
  Rocket
} from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const INDUSTRIES = [
  {
    id: 'solar_energy',
    name: 'Energia Solar',
    description: 'Fluxo completo desde visita técnica até homologação.',
    icon: Sun,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20'
  },
  {
    id: 'construction',
    name: 'Construção Civil',
    description: 'Gestão de obras, materiais e cronograma físico-financeiro.',
    icon: Hammer,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20'
  },
  {
    id: 'law',
    name: 'Advocacia',
    description: 'Gestão de processos, prazos e documentos jurídicos.',
    icon: Scale,
    color: 'text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-900/20'
  },
  {
    id: 'accounting',
    name: 'Contabilidade',
    description: 'Fluxo de obrigações fiscais, contábeis e folha.',
    icon: Calculator,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20'
  },
  {
    id: 'clinic',
    name: 'Clínica / Saúde',
    description: 'Acompanhamento de pacientes e procedimentos médicos.',
    icon: Stethoscope,
    color: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-900/20'
  },
  {
    id: 'real_estate',
    name: 'Imobiliária',
    description: 'Gestão de vendas, locação e vistorias.',
    icon: Home,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20'
  },
  {
    id: 'education',
    name: 'Educação',
    description: 'Gestão de cursos, turmas e matrículas.',
    icon: GraduationCap,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20'
  },
  {
    id: 'retail',
    name: 'Varejo',
    description: 'Gestão de estoque, pedidos e entregas.',
    icon: ShoppingBag,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20'
  },
  {
    id: 'events',
    name: 'Eventos',
    description: 'Planejamento, fornecedores e execução de eventos.',
    icon: PartyPopper,
    color: 'text-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-900/20'
  }
];

export default function TemplateWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!selectedIndustry) return;
    
    setLoading(true);
    try {
      await fetchJson(`${API}/projects/templates/seed/${selectedIndustry}`, {
        method: 'POST'
      });
      setStep(3);
    } catch (err) {
      console.error('Erro ao configurar templates:', err);
      alert('Erro ao configurar templates. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {step === 1 && (
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="inline-flex p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
            <Rocket size={48} />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Bem-vindo ao Gestor de Projetos
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Vamos configurar seu ambiente de trabalho. Escolha seu segmento para começarmos com os templates ideais.
            </p>
          </div>
          <button
            onClick={() => setStep(2)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center gap-2 mx-auto"
          >
            Começar Configuração <ArrowRight size={20} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Qual seu segmento?
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Isso criará automaticamente etapas, campos personalizados e automações para você.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind.id}
                onClick={() => setSelectedIndustry(ind.id)}
                className={`p-6 rounded-2xl border-2 text-left transition-all ${
                  selectedIndustry === ind.id
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10'
                    : 'border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-900'
                }`}
              >
                <div className={`p-3 rounded-xl w-fit mb-4 ${ind.bg} ${ind.color}`}>
                  <ind.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{ind.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{ind.description}</p>
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-8">
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-700 font-medium">
              Voltar
            </button>
            <button
              disabled={!selectedIndustry || loading}
              onClick={handleStart}
              className="bg-indigo-600 disabled:opacity-50 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              {loading ? 'Configurando...' : 'Finalizar Configuração'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-8 animate-in zoom-in">
          <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600">
            <CheckCircle2 size={64} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Tudo pronto!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Seu ambiente foi configurado com sucesso. Agora você já pode criar seu primeiro projeto.
            </p>
          </div>
          <button
            onClick={onComplete}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-xl font-bold text-lg transition-all mx-auto"
          >
            Ir para o Painel
          </button>
        </div>
      )}
    </div>
  );
}

import { FaCheckCircle, FaCheck } from "react-icons/fa";
import { INDUSTRIES, Industry } from "../../../types/cadastro";
import {
	FaGraduationCap,
	FaChartLine,
	FaHospital,
	FaSolarPanel,
	FaHardHat,
	FaHome,
	FaBalanceScale,
  FaCalendarAlt
} from "react-icons/fa";

const ICONS: Record<string, any> = {
	FaGraduationCap,
	FaChartLine,
	FaHospital,
	FaSolarPanel,
	FaHardHat,
	FaHome,
	FaCalendarAlt,
	FaBalanceScale,
};

interface Props {
  selected: Industry | null;
  onSelect: (id: Industry) => void;
}

export function IndustryStep({ selected, onSelect }: Props) {
  return (
    <div className="space-y-10">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Qual o nicho do seu negócio?</h2>
        <p className="text-slate-500">Usaremos essa informação para liberar agentes, fluxos e templates já configurados.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRIES.map((industry) => {
          const Icon = ICONS[industry.icon];
          const isSelected = selected === industry.id;
          
          return (
            <button
              key={industry.id}
              onClick={() => onSelect(industry.id)}
              className={`group relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all hover:shadow-md ${
                isSelected 
                  ? "border-[#2fb463] bg-white shadow-lg shadow-[#2fb463]/5" 
                  : "border-slate-200 bg-white/50 hover:border-slate-300"
              }`}
            >
              <div 
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? "bg-[#2fb463] text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                }`}
              >
                {Icon && <Icon size={24} />}
              </div>
              <h3 className="mb-2 font-bold text-slate-900">{industry.name}</h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-500">{industry.description}</p>
              
              <ul className="mt-auto space-y-2">
                {industry.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <FaCheckCircle className={isSelected ? "text-[#2fb463]" : "text-slate-200"} />
                    {feature}
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="absolute right-4 top-4 text-[#2fb463]">
                  <FaCheckCircle size={20} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

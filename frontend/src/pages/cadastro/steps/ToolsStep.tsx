import { useState, useEffect } from "react";
import { FaCalendarAlt, FaColumns, FaCheckCircle } from "react-icons/fa";

interface Props {
  onSave: (tools: { calendar: boolean; pipeline: boolean }) => void;
}

export function ToolsStep({ onSave }: Props) {
  const [tools, setTools] = useState({
    calendar: true,
    pipeline: true
  });

  useEffect(() => {
    onSave(tools);
  }, [tools]);

  const toggleTool = (tool: 'calendar' | 'pipeline') => {
    setTools(prev => ({ ...prev, [tool]: !prev[tool] }));
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Ferramentas de Gestão</h2>
        <p className="text-slate-500">Ative as ferramentas que você deseja utilizar no seu dia a dia.</p>
      </div>
      
      <div className="mx-auto max-w-2xl grid grid-cols-1 gap-6 sm:grid-cols-2">
        <button 
          onClick={() => toggleTool('calendar')}
          className={`relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all ${
            tools.calendar 
              ? "border-[#2fb463] bg-[#2fb463]/5 shadow-lg shadow-[#2fb463]/10" 
              : "border-slate-100 bg-white hover:border-slate-200"
          }`}
        >
          {tools.calendar && (
            <div className="absolute top-4 right-4 text-[#2fb463]">
              <FaCheckCircle size={20} />
            </div>
          )}
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
            tools.calendar ? "bg-[#2fb463] text-white" : "bg-slate-100 text-slate-400"
          }`}>
            <FaCalendarAlt size={32} />
          </div>
          <div className="text-center">
            <h3 className={`text-lg font-bold ${tools.calendar ? "text-slate-900" : "text-slate-500"}`}>Calendário</h3>
            <p className="mt-1 text-sm text-slate-500">Agendamentos e compromissos integrados.</p>
          </div>
        </button>

        <button 
          onClick={() => toggleTool('pipeline')}
          className={`relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all ${
            tools.pipeline 
              ? "border-[#2fb463] bg-[#2fb463]/5 shadow-lg shadow-[#2fb463]/10" 
              : "border-slate-100 bg-white hover:border-slate-200"
          }`}
        >
          {tools.pipeline && (
            <div className="absolute top-4 right-4 text-[#2fb463]">
              <FaCheckCircle size={20} />
            </div>
          )}
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
            tools.pipeline ? "bg-[#2fb463] text-white" : "bg-slate-100 text-slate-400"
          }`}>
            <FaColumns size={32} />
          </div>
          <div className="text-center">
            <h3 className={`text-lg font-bold ${tools.pipeline ? "text-slate-900" : "text-slate-500"}`}>Pipeline (CRM)</h3>
            <p className="mt-1 text-sm text-slate-500">Gestão de funil de vendas e processos.</p>
          </div>
        </button>
      </div>
    </div>
  );
}

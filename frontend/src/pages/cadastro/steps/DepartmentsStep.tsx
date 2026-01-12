import { useState, useEffect } from "react";
import { FaUsers, FaPlus, FaTrash, FaCheckCircle } from "react-icons/fa";
import { Industry } from "@livechat/shared";

interface Props {
  industry: Industry | null;
  onSave: (departments: string[]) => void;
}

const DEFAULT_DEPARTMENTS: Record<string, string[]> = {
  education: ["Secretaria", "Financeiro", "Pedagógico", "Comercial"],
  accounting: ["Fiscal", "Contábil", "DP / RH", "Comercial"],
  clinic: ["Recepção", "Financeiro", "Médico", "Agendamentos"],
  solar_energy: ["Vendas", "Engenharia", "Pós-Venda", "Financeiro"],
  construction: ["Obras", "Orçamentos", "Financeiro", "Comercial"],
  real_estate: ["Vendas", "Locação", "Administrativo", "Financeiro"],
  events: ["Comercial", "Operacional", "Financeiro", "Atendimento"],
  law: ["Jurídico", "Administrativo", "Financeiro", "Comercial"],
  retail: ["Vendas", "Suporte", "Financeiro", "Logística"],
};

export function DepartmentsStep({ industry, onSave }: Props) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDept, setNewDept] = useState("");

  useEffect(() => {
    if (industry && DEFAULT_DEPARTMENTS[industry]) {
      setDepartments(DEFAULT_DEPARTMENTS[industry]);
    } else {
      setDepartments(["Comercial", "Suporte", "Financeiro"]);
    }
  }, [industry]);

  useEffect(() => {
    onSave(departments);
  }, [departments]);

  const addDept = () => {
    if (newDept.trim() && !departments.includes(newDept.trim())) {
      setDepartments([...departments, newDept.trim()]);
      setNewDept("");
    }
  };

  const removeDept = (name: string) => {
    setDepartments(departments.filter(d => d !== name));
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Estrutura da sua Empresa</h2>
        <p className="text-slate-500">Quais departamentos você deseja criar para organizar seus atendimentos?</p>
      </div>
      
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex gap-2">
          <input 
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addDept()}
            placeholder="Ex: Suporte Técnico, Vendas..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2fb463] focus:ring-2 focus:ring-[#2fb463]/10 transition-all"
          />
          <button 
            onClick={addDept}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-all"
          >
            <FaPlus /> Adicionar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {departments.map((dept) => (
            <div 
              key={dept}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#2fb463]/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2fb463]/10 text-[#2fb463]">
                  <FaUsers size={14} />
                </div>
                <span className="text-sm font-bold text-slate-700">{dept}</span>
              </div>
              <button 
                onClick={() => removeDept(dept)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <FaTrash size={12} />
              </button>
            </div>
          ))}
        </div>

        {departments.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 italic">Nenhum departamento adicionado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

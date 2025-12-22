import { FaTimes } from "react-icons/fa";
import { ClienteTasksSection } from "./ClienteTasksSection";
import { OptInManagement } from "../campaigns/OptInManagement";

type Cliente = {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  status: string;
  kanban_column_id?: string;
  createdAt?: string;
  customer_id?: string;
};

interface ClienteDetailsModalProps {
  cliente: Cliente;
  onClose: () => void;
}

export function ClienteDetailsModal({ cliente, onClose }: ClienteDetailsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-[#151b23] shadow-md border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-8 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#2fb463]/10 text-[#2fb463] text-xl font-bold">
              {cliente.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{cliente.name}</h2>
              <p className="text-sm text-slate-500 mt-1">
                Cliente desde {cliente.createdAt ? new Date(cliente.createdAt).toLocaleDateString("pt-BR") : "-"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
          >
            <FaTimes className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-8 custom-scrollbar" style={{ maxHeight: "calc(90vh - 120px)" }}>
          {/* Info Básica Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Email
              </label>
              <p className="text-base font-medium text-slate-900 dark:text-white break-all">
                {cliente.email || "Não informado"}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                CPF
              </label>
              <p className="text-base font-medium text-slate-900 dark:text-white">
                {cliente.cpf || "Não informado"}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Status
              </label>
              <div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                  cliente.status === "ATIVO"
                    ? "bg-[#2fb463]/10 text-[#2fb463] dark:bg-[#2fb463]/20 dark:text-[#74e69e]"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  {cliente.status}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            {/* Opt-in Management */}
            {cliente.customer_id && (
              <section className="rounded-xl border border-slate-100 dark:border-slate-800 p-6 bg-slate-50/30 dark:bg-slate-800/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Consentimento (LGPD)
                  </h3>
                </div>
                <OptInManagement 
                  customer={{
                    id: cliente.customer_id,
                    name: cliente.name,
                    phone: cliente.email || ""
                  }}
                />
              </section>
            )}

            {/* Tarefas */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tarefas e Acompanhamento
                </h3>
              </div>
              <ClienteTasksSection 
                leadId={cliente.id} 
                customerId={cliente.customer_id}
                customerName={cliente.name} 
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


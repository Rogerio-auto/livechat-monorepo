import { FaTimes } from "react-icons/fa";
import { ClienteTasksSection } from "./ClienteTasksSection";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{cliente.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Cliente desde {cliente.createdAt ? new Date(cliente.createdAt).toLocaleDateString("pt-BR") : "-"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 88px)" }}>
          {/* Info Básica */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {cliente.email && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Email
                </label>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{cliente.email}</p>
              </div>
            )}
            {cliente.cpf && (
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  CPF
                </label>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{cliente.cpf}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Status
              </label>
              <p className="mt-1">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  cliente.status === "ATIVO"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  {cliente.status}
                </span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200 dark:border-gray-700" />

          {/* Tarefas */}
          <ClienteTasksSection 
            leadId={cliente.id} 
            customerId={cliente.customer_id}
            customerName={cliente.name} 
          />
        </div>
      </div>
    </div>
  );
}

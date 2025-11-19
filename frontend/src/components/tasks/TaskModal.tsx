import { useState, useEffect, FormEvent } from "react";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  CreateTaskInput,
  UpdateTaskInput,
  ReminderChannel,
} from "../../types/tasks";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

type User = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
};

type Cliente = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customer_id?: string; // Campo que indica se o lead tem customer vinculado
};

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  initialData?: Task | null;
  prefilledData?: Partial<CreateTaskInput>;
}

export function TaskModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  prefilledData,
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("PENDING");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [type, setType] = useState<TaskType>("GENERAL");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("");
  const [reminderChannels, setReminderChannels] = useState<ReminderChannel[]>(["IN_APP"]);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState("");
  const [showClienteModal, setShowClienteModal] = useState(false);

  // Fetch users and clientes on mount
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          setLoadingUsers(true);
          const response = await fetch(`${API}/settings/users`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setUsers(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("[TaskModal] Error fetching users:", error);
          setUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      };

      const fetchClientes = async () => {
        try {
          setLoadingClientes(true);
          const response = await fetch(`${API}/leads`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setClientes(Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error("[TaskModal] Error fetching clientes:", error);
          setClientes([]);
        } finally {
          setLoadingClientes(false);
        }
      };

      fetchUsers();
      fetchClientes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setStatus(initialData.status || "PENDING");
      setPriority(initialData.priority || "MEDIUM");
      setType(initialData.type || "GENERAL");
      setDueDate(initialData.due_date ? initialData.due_date.slice(0, 16) : "");
      setAssignedTo(initialData.assigned_to || "");
      // Se tem related_customer_id, usa ele. Se não, tenta usar related_lead_id (porque são leads)
      setCustomerId(initialData.related_customer_id || initialData.related_lead_id || "");
      setReminderEnabled(initialData.reminder_enabled || false);
      setReminderTime(initialData.reminder_time ? initialData.reminder_time.slice(0, 16) : "");
      setReminderChannels(initialData.reminder_channels || ["IN_APP"]);
    } else if (prefilledData) {
      setTitle(prefilledData.title || "");
      setDescription(prefilledData.description || "");
      setStatus(prefilledData.status || "PENDING");
      setPriority(prefilledData.priority || "MEDIUM");
      setType(prefilledData.type || "GENERAL");
      setDueDate(prefilledData.due_date ? prefilledData.due_date.slice(0, 16) : "");
      setAssignedTo(prefilledData.assigned_to || "");
      // Se tem related_customer_id, usa ele. Se não, tenta usar related_lead_id
      setCustomerId(prefilledData.related_customer_id || prefilledData.related_lead_id || "");
      setReminderEnabled(prefilledData.reminder_enabled || false);
      setReminderTime(prefilledData.reminder_time ? prefilledData.reminder_time.slice(0, 16) : "");
      setReminderChannels(prefilledData.reminder_channels || ["IN_APP"]);
    } else {
      // Reset form
      setTitle("");
      setDescription("");
      setStatus("PENDING");
      setPriority("MEDIUM");
      setType("GENERAL");
      setDueDate("");
      setAssignedTo("");
      setCustomerId("");
      setReminderEnabled(false);
      setReminderTime("");
      setReminderChannels(["IN_APP"]);
    }
  }, [initialData, prefilledData, isOpen]);

  // Auto-preencher nome do cliente quando customer_id é setado (via prefill ou initialData)
  useEffect(() => {
    if (customerId && clientes.length > 0) {
      const selectedCliente = clientes.find(c => c.id === customerId);
      if (selectedCliente && !clienteSearchTerm) {
        console.log('[TaskModal] 🔍 Auto-preenchendo cliente:', {
          customerId,
          clienteName: selectedCliente.name,
          fromInitialData: !!initialData,
          fromPrefilledData: !!prefilledData
        });
        setClienteSearchTerm(selectedCliente.name || "");
      } else if (!selectedCliente) {
        console.log('[TaskModal] ⚠️ Cliente não encontrado na lista:', {
          customerId,
          totalClientes: clientes.length,
          clientesIds: clientes.slice(0, 3).map(c => c.id)
        });
      }
    }
  }, [customerId, clientes, clienteSearchTerm, initialData, prefilledData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert("Título é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateTaskInput | UpdateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        type,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigned_to: assignedTo || undefined,
        // Se selecionou um cliente, verifica se tem customer_id válido
        // Se tiver, usa related_customer_id, senão usa related_lead_id (porque são leads da tabela leads)
        ...(customerId ? (() => {
          const selectedCliente = clientes.find(c => c.id === customerId);
          const hasValidCustomerId = selectedCliente?.customer_id && selectedCliente.customer_id.trim() !== '';
          return hasValidCustomerId 
            ? { related_customer_id: selectedCliente.customer_id }
            : { related_lead_id: customerId };
        })() : {}),
        reminder_enabled: reminderEnabled,
        reminder_time: reminderEnabled && reminderTime ? new Date(reminderTime).toISOString() : undefined,
        reminder_channels: reminderEnabled ? reminderChannels : undefined,
        ...(prefilledData || {}),
      };

      await onSubmit(data);
      onClose();
    } catch (error: any) {
      alert(error.message || "Erro ao salvar tarefa");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleReminderChannel = (channel: ReminderChannel) => {
    setReminderChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-8 py-5">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {initialData ? "Editar Tarefa" : "Nova Tarefa"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {initialData ? "Atualize os dados da tarefa" : "Preencha os dados para criar uma nova tarefa"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Fechar
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-88px)] px-8 py-6">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite o título da tarefa"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Detalhes sobre a tarefa..."
              />
            </div>

            {/* Row: Status, Priority, Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="IN_PROGRESS">Em Progresso</option>
                  <option value="COMPLETED">Concluída</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prioridade
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GENERAL">Geral</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="CALL">Ligação</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="MEETING">Reunião</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PROPOSAL">Proposta</option>
                  <option value="VISIT">Visita</option>
                </select>
              </div>
            </div>

            {/* Row: Due Date, Assigned To, Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data de vencimento
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Responsável
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={loadingUsers}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Nenhum responsável</option>
                  {loadingUsers ? (
                    <option value="">Carregando usuários...</option>
                  ) : (
                    users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cliente
                </label>
                <button
                  type="button"
                  onClick={() => setShowClienteModal(true)}
                  disabled={loadingClientes}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left flex items-center justify-between hover:border-blue-500 dark:hover:border-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    {customerId ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                          {clientes.find(c => c.id === customerId)?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span className="text-gray-900 dark:text-white">
                          {clientes.find(c => c.id === customerId)?.name || "Cliente selecionado"}
                        </span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-500 dark:text-gray-400">
                          {loadingClientes ? "Carregando..." : "Selecionar cliente (opcional)"}
                        </span>
                      </>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reminder Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="reminder-enabled"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="reminder-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ativar lembrete
                </label>
              </div>

              {reminderEnabled && (
                <div className="space-y-4 pl-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data/Hora do lembrete
                    </label>
                    <input
                      type="datetime-local"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Canais de notificação
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reminderChannels.includes("IN_APP")}
                          onChange={() => toggleReminderChannel("IN_APP")}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">In-App</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reminderChannels.includes("EMAIL")}
                          onChange={() => toggleReminderChannel("EMAIL")}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">E-mail</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reminderChannels.includes("WHATSAPP")}
                          onChange={() => toggleReminderChannel("WHATSAPP")}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all duration-200 hover:text-gray-900 dark:hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Salvando..." : initialData ? "Atualizar" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>

      {/* Submodal de seleção de cliente */}
      {showClienteModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
          onClick={() => setShowClienteModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do submodal */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Selecionar Cliente
              </h3>
              <button
                type="button"
                onClick={() => setShowClienteModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Campo de busca */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={clienteSearchTerm}
                  onChange={(e) => setClienteSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="flex-1 overflow-y-auto">
              {loadingClientes ? (
                <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <p>Carregando clientes...</p>
                </div>
              ) : clientes.filter((cliente) => {
                if (!clienteSearchTerm.trim()) return true;
                const searchLower = clienteSearchTerm.toLowerCase();
                return (
                  cliente.name?.toLowerCase().includes(searchLower) ||
                  cliente.phone?.toLowerCase().includes(searchLower) ||
                  cliente.email?.toLowerCase().includes(searchLower)
                );
              }).length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>{clienteSearchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente disponível"}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId("");
                      setClienteSearchTerm("");
                      setShowClienteModal(false);
                    }}
                    className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !customerId ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          !customerId ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                        }`}>
                          Nenhum cliente
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Tarefa sem vinculação
                        </div>
                      </div>
                      {!customerId && (
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </div>
                  </button>
                  {clientes
                    .filter((cliente) => {
                      if (!clienteSearchTerm.trim()) return true;
                      const searchLower = clienteSearchTerm.toLowerCase();
                      return (
                        cliente.name?.toLowerCase().includes(searchLower) ||
                        cliente.phone?.toLowerCase().includes(searchLower) ||
                        cliente.email?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(cliente.id);
                          setClienteSearchTerm(cliente.name || "");
                          setShowClienteModal(false);
                        }}
                        className={`w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          customerId === cliente.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold shrink-0">
                            {cliente.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium ${
                              customerId === cliente.id ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-white"
                            }`}>
                              {cliente.name}
                            </div>
                            {(cliente.phone || cliente.email) && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {cliente.phone || cliente.email}
                              </div>
                            )}
                          </div>
                          {customerId === cliente.id && (
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

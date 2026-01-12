import { useState, useEffect, FormEvent } from "react";
import { ArrowLeft, ChevronRight, Calendar, User as UserIcon, Tag, Bell, Info } from "lucide-react";
import { showToast } from "../../hooks/useToast";
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
  CreateTaskDTO as CreateTaskInput,
  UpdateTaskDTO as UpdateTaskInput,
  ReminderChannel,
} from "@livechat/shared";

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
  customer_id?: string;
};

interface TaskFormProps {
  onSubmit: (data: CreateTaskInput | UpdateTaskInput) => Promise<void>;
  onClose: () => void;
  initialData?: Task | null;
  prefilledData?: Partial<CreateTaskInput>;
  isModal?: boolean;
  formTitle?: string;
  breadcrumb?: string;
}

export function TaskForm({
  onSubmit,
  onClose,
  initialData,
  prefilledData,
  isModal = true,
  formTitle,
  breadcrumb,
}: TaskFormProps) {
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

  useEffect(() => {
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
        console.error("[TaskForm] Error fetching users:", error);
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
        console.error("[TaskForm] Error fetching clientes:", error);
        setClientes([]);
      } finally {
        setLoadingClientes(false);
      }
    };

    fetchUsers();
    fetchClientes();
  }, []);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setStatus(initialData.status || "PENDING");
      setPriority(initialData.priority || "MEDIUM");
      setType(initialData.type || "GENERAL");
      setDueDate(initialData.due_date ? initialData.due_date.slice(0, 16) : "");
      setAssignedTo(initialData.assigned_to || "");
      setCustomerId(initialData.related_customer_id || initialData.related_lead_id || "");
      setReminderEnabled(initialData.reminder_enabled || false);
      setReminderTime(initialData.reminder_time ? initialData.reminder_time.slice(0, 16) : "");
      setReminderChannels((initialData.reminder_channels as ReminderChannel[]) || ["IN_APP"]);
    } else if (prefilledData) {
      setTitle(prefilledData.title || "");
      setDescription(prefilledData.description || "");
      setStatus(prefilledData.status || "PENDING");
      setPriority(prefilledData.priority || "MEDIUM");
      setType(prefilledData.type || "GENERAL");
      setDueDate(prefilledData.due_date ? prefilledData.due_date.slice(0, 16) : "");
      setAssignedTo(prefilledData.assigned_to || "");
      setCustomerId(prefilledData.related_customer_id || prefilledData.related_lead_id || "");
      setReminderEnabled(prefilledData.reminder_enabled || false);
      setReminderTime(prefilledData.reminder_time ? prefilledData.reminder_time.slice(0, 16) : "");
      setReminderChannels((prefilledData.reminder_channels as ReminderChannel[]) || ["IN_APP"]);
    }
  }, [initialData, prefilledData]);

  useEffect(() => {
    if (customerId && clientes.length > 0) {
      const selectedCliente = clientes.find(c => c.id === customerId);
      if (selectedCliente && !clienteSearchTerm) {
        setClienteSearchTerm(selectedCliente.name || "");
      }
    }
  }, [customerId, clientes, clienteSearchTerm]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      showToast("Título é obrigatório", "warning");
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
      showToast("Tarefa salva com sucesso!", "success");
      onClose();
    } catch (error: any) {
      showToast(error.message || "Erro ao salvar tarefa", "error");
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

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2fb463]/30 transition-all";
  const labelClass = "block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2";

  const formContent = (
    <form onSubmit={handleSubmit} className={`${isModal ? "overflow-y-auto max-h-[calc(90vh-88px)] px-8 py-6" : "space-y-8"}`}>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className={labelClass}>
            Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Digite o título da tarefa"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>
            Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="Detalhes sobre a tarefa..."
          />
        </div>

        {/* Row: Status, Priority, Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={inputClass}
            >
              <option value="PENDING">Pendente</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Prioridade
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={inputClass}
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskType)}
              className={inputClass}
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
            <label className={labelClass}>
              Data de vencimento
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Responsável
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={loadingUsers}
              className={inputClass}
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
            <label className={labelClass}>
              Cliente
            </label>
            <button
              type="button"
              onClick={() => setShowClienteModal(true)}
              disabled={loadingClientes}
              className={`${inputClass} text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
            >
              <div className="flex items-center gap-2">
                {customerId ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-[#2fb463] to-[#1f8b49] flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {clientes.find(c => c.id === customerId)?.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {clientes.find(c => c.id === customerId)?.name || "Cliente selecionado"}
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-slate-500">
                      {loadingClientes ? "Carregando..." : "Selecionar cliente (opcional)"}
                    </span>
                  </>
                )}
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Reminder Section */}
        <div className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="reminder-enabled"
              checked={reminderEnabled}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-none bg-slate-100 dark:bg-slate-800 text-[#2fb463] focus:ring-[#2fb463]"
            />
            <label htmlFor="reminder-enabled" className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Ativar lembrete
            </label>
          </div>

          {reminderEnabled && (
            <div className="space-y-4 pl-8">
              <div>
                <label className={labelClass}>
                  Data/Hora do lembrete
                </label>
                <input
                  type="datetime-local"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Canais de notificação
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderChannels.includes("IN_APP")}
                      onChange={() => toggleReminderChannel("IN_APP")}
                      className="h-4 w-4 rounded border-none bg-slate-100 dark:bg-slate-800 text-[#2fb463] focus:ring-[#2fb463]"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">In-App</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderChannels.includes("EMAIL")}
                      onChange={() => toggleReminderChannel("EMAIL")}
                      className="h-4 w-4 rounded border-none bg-slate-100 dark:bg-slate-800 text-[#2fb463] focus:ring-[#2fb463]"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reminderChannels.includes("WHATSAPP")}
                      onChange={() => toggleReminderChannel("WHATSAPP")}
                      className="h-4 w-4 rounded border-none bg-slate-100 dark:bg-slate-800 text-[#2fb463] focus:ring-[#2fb463]"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-end gap-3 mt-8 pt-6`}>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-sm font-bold text-slate-500 transition-all duration-200 hover:text-slate-900 dark:hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#2fb463] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#2fb463]/20 transition-all duration-200  hover:bg-[#1f8b49] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Salvando..." : initialData ? "Atualizar" : "Criar Tarefa"}
        </button>
      </div>

      {/* Submodal de seleção de cliente */}
      {showClienteModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4"
          onClick={() => setShowClienteModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#0b1015] rounded-xl shadow-md w-full max-w-lg max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do submodal */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Selecionar Cliente
              </h3>
              <button
                type="button"
                onClick={() => setShowClienteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Campo de busca */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone ou email..."
                  value={clienteSearchTerm}
                  onChange={(e) => setClienteSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b23] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2fb463]/50 focus:border-[#2fb463]"
                />
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="flex-1 overflow-y-auto p-2">
              {loadingClientes ? (
                <div className="px-6 py-12 text-center text-slate-500">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2fb463] border-t-transparent mx-auto mb-3" />
                  <p className="font-medium">Carregando clientes...</p>
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
                <div className="px-6 py-12 text-center text-slate-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="font-medium">{clienteSearchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente disponível"}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId("");
                      setClienteSearchTerm("");
                      setShowClienteModal(false);
                    }}
                    className={`w-full px-4 py-3 text-left rounded-xl transition-all ${
                      !customerId ? "bg-[#2fb463]/10 text-[#2fb463]" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">Nenhum cliente</div>
                        <div className="text-xs opacity-70">Tarefa sem vinculação</div>
                      </div>
                      {!customerId && (
                        <svg className="w-5 h-5 text-[#2fb463] shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
                        className={`w-full px-4 py-3 text-left rounded-xl transition-all ${
                          customerId === cliente.id ? "bg-[#2fb463]/10 text-[#2fb463]" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#2fb463] to-[#1f8b49] flex items-center justify-center text-white font-bold shrink-0">
                            {cliente.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold ${customerId === cliente.id ? "text-[#2fb463]" : "text-slate-900 dark:text-white"}`}>
                              {cliente.name}
                            </div>
                            {(cliente.phone || cliente.email) && (
                              <div className="text-xs opacity-70 truncate">
                                {cliente.phone || cliente.email}
                              </div>
                            )}
                          </div>
                          {customerId === cliente.id && (
                            <svg className="w-5 h-5 text-[#2fb463] shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
    </form>
  );

  if (!isModal) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          {/* Breadcrumbs & Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-sm text-(--color-text-muted) mb-4">
              <button 
                onClick={onClose}
                className="hover:text-(--color-primary) transition-colors"
              >
                {breadcrumb || "Tarefas"}
              </button>
              <ChevronRight className="w-4 h-4" />
              <span className="text-(--color-text) font-medium">
                {formTitle || (initialData ? "Editar Tarefa" : "Nova Tarefa")}
              </span>
            </div>
            
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-4xl font-bold text-(--color-text) tracking-tight">
                  {formTitle || (initialData ? "Editar Tarefa" : "Criar Nova Tarefa")}
                </h1>
                <p className="mt-2 text-lg text-(--color-text-muted)">
                  {initialData 
                    ? "Atualize os detalhes e o progresso desta tarefa." 
                    : "Organize seu trabalho definindo prazos e responsáveis."}
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-(--color-text-muted) hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form Column */}
            <div className="lg:col-span-2 space-y-8">
              <div className="p-8 border border-slate-100 dark:border-slate-800 rounded-xl">
                {formContent}
              </div>
            </div>

            {/* Sidebar Info Column */}
            <div className="space-y-6">
              <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-(--color-text-muted) mb-4 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Dicas Rápidas
                </h3>
                <ul className="space-y-4 text-sm text-(--color-text)">
                  <li className="flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-(--color-primary) shrink-0" />
                    <p>Defina uma <strong>data de vencimento</strong> para receber notificações automáticas.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-(--color-primary) shrink-0" />
                    <p>Vincule a tarefa a um <strong>cliente</strong> para manter o histórico centralizado.</p>
                  </li>
                  <li className="flex gap-3">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-(--color-primary) shrink-0" />
                    <p>Use <strong>prioridades</strong> para ajudar sua equipe a focar no que é mais importante.</p>
                  </li>
                </ul>
              </div>

              <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-(--color-text-muted) mb-4 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notificações
                </h3>
                <p className="text-sm text-(--color-text-muted) leading-relaxed">
                  Ao ativar os lembretes, você e o responsável receberão alertas nos canais selecionados antes do prazo final.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return formContent;
}


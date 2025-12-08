import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { API, fetchJson } from "../utils/api";
import {
  FaCalendarAlt,
  FaUser,
  FaBuilding,
  FaCog,
  FaLock,
  FaTimes,
  FaEdit,
  FaTrash,
  FaCheck,
  FaClock,
  FaPhone,
  FaTasks,
  FaFileAlt,
  FaCalendarCheck,
  FaCalendarWeek,
  FaMapMarkerAlt,
  FaUsers,
  FaFacebook,
  FaInstagram,
  FaTwitter,
  FaGlobe,
} from "react-icons/fa";
import { Task } from "../types/tasks";
import { TaskModal } from "../components/tasks/TaskModal";
import { io, Socket } from "socket.io-client";

type Agent = { id: string; name: string };
type Customer = { id: string; name: string };
type Calendar = { 
  id: string; 
  name: string; 
  color: string; 
  is_default: boolean;
  type?: string;
  owner_id?: string;
};
type Event = {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  allDay?: boolean;
  extendedProps: {
    type?: "event" | "task";
    taskId?: string;
    task?: Task;
    description?: string;
    event_type?: string;
    status?: string;
    location?: string;
    calendar_name?: string;
    calendar_id?: string;
    customer_name?: string;
    customer_id?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_notes?: string;
    customer_tags?: string[];
    lead_name?: string;
    lead_id?: string;
    meeting_url?: string;
    created_by_name?: string;
    created_at?: string;
  };
};
type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  MEETING: "Reunião",
  CALL: "Ligação",
  TECHNICAL_VISIT: "Visita técnica",
  FOLLOW_UP: "Follow-up",
  PRESENTATION: "Apresentação",
  TRAINING: "Treinamento",
  OTHER: "Outro",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  RESCHEDULED: "Reagendado",
};

const DIALOG_OVERLAY_CLASS = "fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,15,9,0.72)] px-4 py-6 backdrop-blur-[12px]";

const ACTION_PRIMARY_CLASS = "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1f8b49] via-[#23a257] to-[#36c173] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_20px_60px_-35px_rgba(15,111,55,0.9)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_65px_-32px_rgba(15,111,55,0.88)]";

const ACTION_SECONDARY_CLASS = "inline-flex items-center gap-2 rounded-xl bg-[rgba(47,180,99,0.18)] px-4 py-2.5 text-sm font-semibold text-[rgba(13,117,64,0.95)] transition hover:bg-[rgba(47,180,99,0.25)]";

const ACTION_DANGER_CLASS = "inline-flex items-center gap-2 rounded-xl bg-[rgba(239,68,68,0.14)] px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-[rgba(239,68,68,0.22)]";

const ACTION_GHOST_CLASS = "inline-flex items-center gap-2 rounded-xl border border-transparent bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[rgba(47,180,99,0.35)] hover:bg-[rgba(47,180,99,0.08)] hover:text-emerald-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-[rgba(47,180,99,0.22)]";

const INPUT_BASE_CLASS = "w-full rounded-xl border border-[rgba(15,36,24,0.12)] bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900 dark:text-white";

const FILTER_SELECT_CLASS = `${INPUT_BASE_CLASS} text-sm`;

const QUICK_ACTION_CLASS = "inline-flex items-center gap-2 rounded-lg bg-[rgba(47,180,99,0.08)] px-3 py-1.5 text-sm font-medium text-[rgba(13,117,64,0.95)] transition hover:bg-[rgba(47,180,99,0.16)] dark:bg-[rgba(47,180,99,0.16)] dark:text-emerald-200 dark:hover:bg-[rgba(47,180,99,0.24)]";

const statusChipClass = (status?: string) => {
  switch (status) {
    case "COMPLETED":
      return "bg-[rgba(47,180,99,0.28)] text-[rgba(12,83,44,0.95)]";
    case "CONFIRMED":
      return "bg-[rgba(59,130,246,0.25)] text-[rgba(26,78,202,0.95)]";
    case "IN_PROGRESS":
      return "bg-[rgba(250,204,21,0.3)] text-[rgba(133,77,14,0.95)]";
    case "CANCELLED":
      return "bg-[rgba(248,113,113,0.25)] text-[rgba(153,27,27,0.95)]";
    case "RESCHEDULED":
      return "bg-[rgba(56,189,248,0.25)] text-[rgba(8,96,131,0.95)]";
    default:
      return "bg-[rgba(47,180,99,0.2)] text-[rgba(13,117,64,0.95)]";
  }
};

const formatEventDateTime = (iso: string | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function CalendarioPage() {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewEventModal, setShowViewEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [leadData, setLeadData] = useState<any>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPrefilledDate, setTaskPrefilledDate] = useState<Date | null>(null);
  
  // Navbar states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<"all" | "personal" | "team">("all");
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const defaultCalendarId = useMemo(() => calendars.find((c) => c.is_default)?.id, [calendars]);
  const calendarRef = useRef<any>(null);

  const selectedEventStartLabel = useMemo(
    () => formatEventDateTime(selectedEvent?.start),
    [selectedEvent?.start],
  );

  const selectedEventEndLabel = useMemo(
    () => formatEventDateTime(selectedEvent?.end),
    [selectedEvent?.end],
  );

  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    location: "",
    event_type: "OTHER",
    status: "SCHEDULED",
    start_time: "",
    end_time: "",
    calendar_id: "",
    customer_id: undefined as string | undefined,
    lead_id: undefined as string | undefined,
    meeting_url: undefined as string | undefined,
  });

  const requireAuth = async () => {
    try {
      const profile = await fetchJson<UserProfile>(`${API}/auth/me`);
      setUserProfile(profile);
      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  const loadCalendars = async () => {
    try {
      const data = await fetchJson<Calendar[]>(`${API}/calendar/calendars`);
      setCalendars(data || []);
      const def = (data || []).find((c) => c.is_default)?.id;
      setForm((f: any) => ({ ...f, calendar_id: f.calendar_id || def || "" }));
    } catch (e: any) {
      console.error("Failed to load calendars:", e);
      setError(e?.message || "Erro ao carregar calendários");
    }
  };

  const loadEventos = async (startISO: string, endISO: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start: startISO, end: endISO });
      const resp = await fetchJson<{ items: Event[] }>(`${API}/calendar/events?${params.toString()}`);
      setEventos((resp.items || []).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: e.backgroundColor || "#1F8B49",
        extendedProps: e.extendedProps,
      })));
    } catch (e: any) {
      console.error("Failed to load events:", e);
      setError(e?.message || "Erro ao carregar eventos");
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const resp = await fetchJson<{ tasks: Task[]; total: number }>(`${API}/api/tasks`);
      // Filtrar apenas tasks com due_date
      setTasks((resp?.tasks || []).filter(t => t.due_date));
    } catch (e: any) {
      console.error("Failed to load tasks:", e);
    }
  };

  const loadCustomerData = async (customerId: string) => {
    setLoadingCustomer(true);
    try {
      const customer = await fetchJson<any>(`${API}/customers/${customerId}`);
      setCustomerData(customer);
      setLeadData(null);
    } catch (e: any) {
      console.error("Failed to load customer:", e);
      setCustomerData(null);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const loadLeadData = async (leadId: string) => {
    setLoadingCustomer(true);
    try {
      console.log('[Calendar] Loading lead data for ID:', leadId);
      const lead = await fetchJson<any>(`${API}/leads/${leadId}`);
      console.log('[Calendar] Lead data loaded:', lead);
      setLeadData(lead);
      setCustomerData(null);
    } catch (e: any) {
      console.error("Failed to load lead:", e);
      setLeadData(null);
    } finally {
      setLoadingCustomer(false);
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      await loadCalendars();
      await loadTasks(); // Carregar tasks com due_date
      try {
        const list = await fetchJson<Agent[]>(`${API}/users/agents-supervisors`);
        setAgents(list || []);
      } catch {
        setAgents([]);
      }
    })();
  }, [navigate]);

  // Socket.io para recarregar tasks em tempo real
  useEffect(() => {
    const socket: Socket = io(API);

    socket.on("task:created", () => {
      console.log("[Calendar] Task created, reloading tasks");
      loadTasks();
    });

    socket.on("task:updated", () => {
      console.log("[Calendar] Task updated, reloading tasks");
      loadTasks();
    });

    socket.on("task:deleted", () => {
      console.log("[Calendar] Task deleted, reloading tasks");
      loadTasks();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (showViewEventModal && selectedEvent) {
      console.log('[Calendar] Modal opened with event:', selectedEvent);
      console.log('[Calendar] Event extendedProps:', selectedEvent.extendedProps);
      
      // Limpar dados anteriores
      setCustomerData(null);
      setLeadData(null);
      
      // Buscar dados do customer ou lead
      if (selectedEvent.extendedProps?.customer_id) {
        console.log('[Calendar] Loading customer data for ID:', selectedEvent.extendedProps.customer_id);
        loadCustomerData(selectedEvent.extendedProps.customer_id);
      } else if (selectedEvent.extendedProps?.lead_id) {
        console.log('[Calendar] Loading lead data for ID:', selectedEvent.extendedProps.lead_id);
        loadLeadData(selectedEvent.extendedProps.lead_id);
      } else {
        console.log('[Calendar] No customer_id or lead_id found in event');
      }
    }
  }, [showViewEventModal, selectedEvent]);

  const handleDatesSet = (arg: any) => {
    loadEventos(arg.startStr, arg.endStr);
  };

  const toLocalInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  const fromLocalInputValue = (s: string) => new Date(s);

  const openNewEvent = (preset?: { start?: Date; end?: Date }) => {
    const start = preset?.start || new Date();
    const end = preset?.end || new Date(start.getTime() + 60 * 60 * 1000);
    setForm({
      title: "",
      description: "",
      location: "",
      event_type: "OTHER",
      status: "SCHEDULED",
      start_time: toLocalInputValue(start),
      end_time: toLocalInputValue(end),
      calendar_id: defaultCalendarId || "",
      customer_id: undefined,
      lead_id: undefined,
      meeting_url: undefined,
    });
    setCustomerQuery("");
    setCustomerOptions([]);
    setError(null);
    setIsEditingEvent(false);
    setShowModal(true);
  };

  const handleDateClick = (info: any) => {
    const start = new Date(info.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openNewEvent({ start, end });
  };

  const saveEvent = async () => {
    setError(null);
    try {
      const startISO = fromLocalInputValue(form.start_time).toISOString();
      const endISO = fromLocalInputValue(form.end_time).toISOString();
      
      const body = {
        title: form.title,
        description: form.description || undefined,
        location: form.location || undefined,
        event_type: form.event_type,
        status: form.status,
        start_time: startISO,
        end_time: endISO,
        calendar_id: form.calendar_id,
        customer_id: form.customer_id || undefined,
        lead_id: form.lead_id || undefined,
        meeting_url: form.meeting_url || undefined,
      };

      if (isEditingEvent && selectedEvent?.id) {
        // UPDATE - Editando evento existente
        await fetchJson(`${API}/calendar/events/${selectedEvent.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        
        // Atualizar o selectedEvent com os novos dados
        setSelectedEvent({
          id: selectedEvent.id,
          title: form.title,
          start: startISO,
          end: endISO,
          backgroundColor: selectedEvent.backgroundColor,
          extendedProps: {
            ...selectedEvent.extendedProps,
            description: form.description,
            location: form.location,
            event_type: form.event_type,
            status: form.status,
            calendar_id: form.calendar_id,
            customer_id: form.customer_id,
          },
        });
        
        // Fechar modal de edição e reabrir modal de visualização
        setShowModal(false);
        setIsEditingEvent(false);
        setShowViewEventModal(true);
        
        alert("Evento atualizado com sucesso!");
      } else {
        // CREATE - Criando novo evento
        await fetchJson(`${API}/calendar/events`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        
        setShowModal(false);
        setIsEditingEvent(false);
        setSelectedEvent(null);
        
        alert("Evento criado com sucesso!");
      }
      
      const api = calendarRef.current?.getApi?.();
      if (api) {
        const view = api.view;
        handleDatesSet({ startStr: view.activeStart.toISOString(), endStr: view.activeEnd.toISOString() });
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar evento");
    }
  };

  useEffect(() => {
    const h = setTimeout(() => {
      const q = customerQuery.trim();
      if (!q) {
        setCustomerOptions([]);
        return;
      }
      fetchJson<{ items: any[] }>(`${API}/livechat/contacts?q=${encodeURIComponent(q)}&limit=20`)
        .then((resp) =>
          setCustomerOptions((resp?.items || []).map((r: any) => ({ id: r.id, name: r.name || r.title || r.id })))
        )
        .catch(() => {
          fetchJson<{ items: any[] }>(`${API}/livechat/crm/contacts?q=${encodeURIComponent(q)}&limit=20`)
            .then((resp) =>
              setCustomerOptions((resp?.items || []).map((r: any) => ({ id: r.id, name: r.name || r.title || r.id })))
            )
            .catch(() => setCustomerOptions([]));
        });
    }, 300);
    return () => clearTimeout(h);
  }, [customerQuery]);

  // Helpers and filters
  const canManageCalendars = ["ADMIN", "MANAGER", "SUPERVISOR"].includes(userProfile?.role || "");
  const personalCalendars = calendars.filter(c => c.type === "PERSONAL");
  const companyCalendars = calendars.filter(c => c.type !== "PERSONAL");
  
  // Transformar tasks em eventos do calendário
  const taskEvents = useMemo(() => {
    return tasks.map(task => {
      // Definir cor baseado no status
      let backgroundColor = "#1f8b49"; // emerald tone (default)
      if (task.status === "COMPLETED") {
        backgroundColor = "#10B981"; // green-500
      } else if (task.status === "IN_PROGRESS") {
        backgroundColor = "#F59E0B"; // amber-500
      } else if (task.priority === "HIGH") {
        backgroundColor = "#EF4444"; // red-500
      } else if (task.priority === "MEDIUM") {
        backgroundColor = "#F59E0B"; // amber-500
      }

      return {
        id: `task-${task.id}`,
        title: `📋 ${task.title}`,
        start: task.due_date!,
        end: task.due_date!,
        backgroundColor,
        allDay: true,
        extendedProps: {
          type: "task" as const,
          taskId: task.id,
          task: task,
        },
      };
    });
  }, [tasks]);
  
  const filteredEvents = useMemo(() => {
    // Combinar eventos normais e tasks
    let filtered = [...eventos, ...taskEvents];
    
    // Filter by view type
    if (activeView === "personal" && userProfile) {
      filtered = filtered.filter(e => {
        // Tasks não têm calendar_name, então sempre mostrar
        if (e.extendedProps.type === "task") return true;
        return personalCalendars.some(c => (e.extendedProps as any).calendar_name === c.name);
      });
    } else if (activeView === "team") {
      filtered = filtered.filter(e => {
        // Tasks não têm calendar_name, então sempre mostrar
        if (e.extendedProps.type === "task") return true;
        return companyCalendars.some(c => (e.extendedProps as any).calendar_name === c.name);
      });
    }
    
    // Filter by selected calendars (não filtrar tasks)
    if (selectedCalendars.length > 0) {
      filtered = filtered.filter(e => {
        if (e.extendedProps.type === "task") return true;
        return selectedCalendars.includes((e.extendedProps as any).calendar_name || "");
      });
    }
    
    // Filter by event type (não aplicar a tasks)
    if (filterEventType !== "all") {
      filtered = filtered.filter(e => {
        if (e.extendedProps.type === "task") return true;
        return (e.extendedProps as any).event_type === filterEventType;
      });
    }
    
    // Filter by status (não aplicar a tasks)
    if (filterStatus !== "all") {
      filtered = filtered.filter(e => {
        if (e.extendedProps.type === "task") return true;
        return (e.extendedProps as any).status === filterStatus;
      });
    }
    
    return filtered;
  }, [eventos, taskEvents, activeView, selectedCalendars, filterEventType, filterStatus, personalCalendars, companyCalendars, userProfile]);

  return (
    <div className="ml-16 min-h-screen bg-gradient-to-br from-[#f1faf5] via-white to-[#dff4e7] transition-colors duration-300 dark:from-[#04140a] dark:via-[#071d11] dark:to-[#103520]">
        <div className="h-screen overflow-auto p-6">
          <div className="mx-auto max-w-[1600px] space-y-6">
            {/* Card principal com todo o conteúdo */}
            <div className="livechat-panel rounded-3xl p-8 shadow-[0_52px_120px_-72px_rgba(6,20,12,0.85)] transition-colors duration-300">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendário</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Gerencie sua agenda e eventos
                  </p>
                  {/* Debug: Mostrar perfil do usuário */}
                  {userProfile && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[rgba(47,180,99,0.12)] px-3 py-1 text-xs font-semibold text-[rgba(13,117,64,0.95)] dark:bg-[rgba(47,180,99,0.18)] dark:text-emerald-200">
                      {userProfile.name} • {userProfile.role}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTask(null);
                      setTaskPrefilledDate(null);
                      setShowTaskModal(true);
                    }}
                    className={`${ACTION_SECONDARY_CLASS} shadow-[0_25px_55px_-40px_rgba(21,128,61,0.65)]`}
                  >
                    <FaTasks /> Nova Tarefa
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewEvent()}
                    className={`${ACTION_PRIMARY_CLASS} px-6 py-3`}
                  >
                    + Novo Evento
                  </button>
                </div>
              </div>

              {/* Navbar de Filtros e Funcionalidades */}
              <div className="mb-6 space-y-4">
                {/* Linha 1: Tabs de Visualização */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 rounded-xl bg-[rgba(47,180,99,0.08)] p-1 dark:bg-[rgba(47,180,99,0.14)]">
                    <button
                      onClick={() => setActiveView("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "all"
                          ? "bg-white text-emerald-600 shadow-md dark:bg-gray-800 dark:text-emerald-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      <FaCalendarAlt /> Todos os Calendários
                    </button>
                    <button
                      onClick={() => setActiveView("personal")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "personal"
                          ? "bg-white text-emerald-600 shadow-md dark:bg-gray-800 dark:text-emerald-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      <FaUser /> Meu Calendário Pessoal
                    </button>
                    <button
                      onClick={() => setActiveView("team")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "team"
                          ? "bg-white text-emerald-600 shadow-md dark:bg-gray-800 dark:text-emerald-300"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      <FaBuilding /> Calendários da Empresa
                    </button>
                  </div>

                  {/* Botões de Gerenciamento (só para ADMIN/MANAGER/SUPERVISOR) */}
                  {canManageCalendars && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate("/configuracoes?tab=calendarios")}
                        className={`${ACTION_PRIMARY_CLASS} flex items-center gap-2 px-6 py-3`}
                      >
                        <FaCog size={18} /> Gerenciar Calendários
                      </button>
                      <button
                        onClick={() => navigate("/configuracoes?tab=permissoes-calendario")}
                        className={`${ACTION_SECONDARY_CLASS} flex items-center gap-2 px-6 py-3 shadow-[0_25px_60px_-45px_rgba(21,128,61,0.6)]`}
                      >
                        <FaLock size={18} /> Permissões
                      </button>
                    </div>
                  )}
                </div>

                {/* Linha 2: Filtros Avançados */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Filtro de Calendários */}
                  <div className="relative">
                    <select
                      multiple
                      value={selectedCalendars}
                      onChange={(e) => {
                        const opts = Array.from(e.target.selectedOptions, opt => opt.value);
                        setSelectedCalendars(opts);
                      }}
                      className={`${FILTER_SELECT_CLASS} min-w-[220px]`}
                      size={1}
                    >
                      <option value="">Filtrar por Calendário...</option>
                      {calendars.map(cal => (
                        <option key={cal.id} value={cal.name}>
                          ● {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro de Tipo de Evento */}
                  <select
                    value={filterEventType}
                    onChange={(e) => setFilterEventType(e.target.value)}
                    className={`${FILTER_SELECT_CLASS} appearance-none pr-10`}
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="MEETING">Reunião</option>
                    <option value="CALL">Ligação</option>
                    <option value="TASK">Tarefa</option>
                    <option value="FOLLOWUP">Follow-up</option>
                    <option value="DEMO">Demo</option>
                    <option value="PRESENTATION">Apresentação</option>
                    <option value="TRAINING">Treinamento</option>
                    <option value="OTHER">Outro</option>
                  </select>

                  {/* Filtro de Status */}
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={`${FILTER_SELECT_CLASS} appearance-none pr-10`}
                  >
                    <option value="all">Todos os Status</option>
                    <option value="SCHEDULED">Agendado</option>
                    <option value="CONFIRMED">Confirmado</option>
                    <option value="IN_PROGRESS">Em Andamento</option>
                    <option value="COMPLETED">Concluído</option>
                    <option value="CANCELLED">Cancelado</option>
                    <option value="RESCHEDULED">Reagendado</option>
                  </select>

                  {/* Limpar Filtros */}
                  {(selectedCalendars.length > 0 || filterEventType !== "all" || filterStatus !== "all") && (
                    <button
                      onClick={() => {
                        setSelectedCalendars([]);
                        setFilterEventType("all");
                        setFilterStatus("all");
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] px-4 py-2 text-sm font-semibold text-[rgba(185,28,28,0.92)] transition hover:bg-[rgba(239,68,68,0.14)] dark:border-[rgba(239,68,68,0.35)] dark:bg-[rgba(239,68,68,0.16)] dark:text-red-200 dark:hover:bg-[rgba(239,68,68,0.24)]"
                    >
                      <FaTimes /> Limpar Filtros
                    </button>
                  )}

                  {/* Indicador de filtros ativos */}
                  {(selectedCalendars.length > 0 || filterEventType !== "all" || filterStatus !== "all") && (
                    <span className="rounded-full bg-[rgba(47,180,99,0.12)] px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-[rgba(47,180,99,0.22)] dark:text-emerald-200">
                      {[
                        selectedCalendars.length > 0 && `${selectedCalendars.length} calendário(s)`,
                        filterEventType !== "all" && "Tipo filtrado",
                        filterStatus !== "all" && "Status filtrado"
                      ].filter(Boolean).join(" • ")}
                    </span>
                  )}
                </div>

                {/* Linha 3: Ações Rápidas */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Ações Rápidas:</span>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.today();
                    }}
                    className={QUICK_ACTION_CLASS}
                  >
                    <FaCalendarCheck /> Hoje
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('dayGridMonth');
                    }}
                    className={QUICK_ACTION_CLASS}
                  >
                    <FaCalendarAlt /> Mês
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('timeGridWeek');
                    }}
                    className={QUICK_ACTION_CLASS}
                  >
                    📆 Semana
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('timeGridDay');
                    }}
                    className={QUICK_ACTION_CLASS}
                  >
                    📄 Dia
                  </button>
                  <div className="flex-1"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    Exibindo <strong className="text-emerald-600 dark:text-emerald-300">{filteredEvents.length}</strong> de <strong>{eventos.length}</strong> eventos
                  </span>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-5 rounded-2xl border border-red-200/60 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm dark:border-red-800/60 dark:bg-red-900/25 dark:text-red-200">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Calendar Info Cards */}
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-[0_38px_100px_-70px_rgba(8,24,16,0.7)]">
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 rounded-full bg-[rgba(47,180,99,0.18)] blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Total de Eventos</span>
                      <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{eventos.length}</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-[0_38px_100px_-70px_rgba(8,24,16,0.7)]">
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 rounded-full bg-[rgba(34,155,90,0.18)] blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Calendários</span>
                      <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{calendars.length}</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl livechat-panel p-5 shadow-[0_38px_100px_-70px_rgba(8,24,16,0.7)]">
                  <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 rounded-full bg-[rgba(22,128,72,0.2)] blur-2xl" />
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Participantes</span>
                      <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{agents.length}</div>
                  </div>
                </div>
              </div>

              {/* Calendar Legend */}
              {calendars.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-3">
                  {calendars.map((cal) => (
                    <div key={cal.id} className="flex items-center gap-2 rounded-full bg-[rgba(47,180,99,0.08)] px-3 py-1.5 dark:bg-[rgba(47,180,99,0.16)]">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cal.name}</span>
                      {cal.is_default && (
                        <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-[rgba(47,180,99,0.18)] text-emerald-700 dark:bg-[rgba(47,180,99,0.28)] dark:text-emerald-200">
                          Padrão
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-[rgba(13,117,64,0.85)] dark:text-emerald-200">
                  <svg className="h-4 w-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Carregando eventos...
                </div>
              )}

              {/* FullCalendar */}
              <div className="livechat-panel rounded-2xl overflow-hidden border border-[rgba(15,36,24,0.12)] bg-white shadow-[0_48px_120px_-80px_rgba(6,20,12,0.85)] dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/90">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay",
                  }}
                  buttonText={{
                    today: "Hoje",
                    month: "Mês",
                    week: "Semana",
                    day: "Dia",
                  }}
                  locale="pt-br"
                  events={filteredEvents}
                  dateClick={handleDateClick}
                  datesSet={handleDatesSet}
                  editable={true}
                  selectable={true}
                  eventClick={(info: EventClickArg) => {
                    const extendedProps = info.event.extendedProps as Event["extendedProps"];
                    
                    // Se for uma task, abrir TaskModal
                    if (extendedProps.type === "task" && extendedProps.task) {
                      setSelectedTask(extendedProps.task);
                      setShowTaskModal(true);
                      return;
                    }
                    
                    // Se for um evento, abrir modal de evento
                    setSelectedEvent({
                      id: info.event.id,
                      title: info.event.title,
                      start: info.event.startStr,
                      end: info.event.endStr,
                      backgroundColor: info.event.backgroundColor,
                      extendedProps: extendedProps,
                    });
                    setIsEditingEvent(false);
                    setShowViewEventModal(true);
                  }}
                  height="70vh"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className={DIALOG_OVERLAY_CLASS}>
            <div
              className="livechat-panel relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-[rgba(15,36,24,0.12)] shadow-[0_52px_120px_-70px_rgba(6,20,12,0.85)] dark:border-[rgba(255,255,255,0.08)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-r from-[#10361f] via-[#1f8b49] to-[#2fb463] px-8 py-6 text-white">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setIsEditingEvent(false);
                  }}
                  className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
                <div>
                  <h3 className="text-2xl font-bold leading-tight">
                    {isEditingEvent ? "Editar Evento" : "Novo Evento"}
                  </h3>
                  <p className="mt-1 text-sm text-white/80">
                    {isEditingEvent ? "Atualize os dados do evento" : "Preencha os dados do evento"}
                  </p>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-8 py-6 space-y-6">
                {error && (
                  <div className="rounded-2xl border border-red-200/60 bg-red-50/90 p-4 text-sm text-red-800 shadow-sm dark:border-red-800/60 dark:bg-red-900/25 dark:text-red-200">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Título *
                    </label>
                    <input
                      className={INPUT_BASE_CLASS}
                      value={form.title}
                      onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))}
                      placeholder="Ex.: Reunião com cliente"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Calendário *
                    </label>
                    <select
                      className={`${INPUT_BASE_CLASS} appearance-none`}
                      value={form.calendar_id}
                      onChange={(e) => setForm((f: any) => ({ ...f, calendar_id: e.target.value }))}
                    >
                      <option value="">Selecione...</option>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.is_default ? "(Padrão)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Início *
                    </label>
                    <input
                      type="datetime-local"
                      className={INPUT_BASE_CLASS}
                      value={form.start_time}
                      onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Fim *
                    </label>
                    <input
                      type="datetime-local"
                      className={INPUT_BASE_CLASS}
                      value={form.end_time}
                      onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Tipo
                    </label>
                    <select
                      className={`${INPUT_BASE_CLASS} appearance-none`}
                      value={form.event_type}
                      onChange={(e) => setForm((f: any) => ({ ...f, event_type: e.target.value }))}
                    >
                      <option value="MEETING">Reunião</option>
                      <option value="CALL">Ligação</option>
                      <option value="TECHNICAL_VISIT">Visita técnica</option>
                      <option value="FOLLOW_UP">Follow-up</option>
                      <option value="PRESENTATION">Apresentação</option>
                      <option value="TRAINING">Treinamento</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Status
                    </label>
                    <select
                      className={`${INPUT_BASE_CLASS} appearance-none`}
                      value={form.status}
                      onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}
                    >
                      <option value="SCHEDULED">Agendado</option>
                      <option value="CONFIRMED">Confirmado</option>
                      <option value="IN_PROGRESS">Em andamento</option>
                      <option value="COMPLETED">Concluído</option>
                      <option value="CANCELLED">Cancelado</option>
                      <option value="RESCHEDULED">Reagendado</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Local
                    </label>
                    <input
                      className={INPUT_BASE_CLASS}
                      value={form.location}
                      onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))}
                      placeholder="Endereço, link ou plataforma"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Descrição
                    </label>
                    <textarea
                      className={`${INPUT_BASE_CLASS} min-h-[120px]`}
                      value={form.description}
                      onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
                      placeholder="Detalhes adicionais sobre o evento"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Cliente
                    </label>
                    <input
                      className={INPUT_BASE_CLASS}
                      placeholder="Buscar cliente..."
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                    />
                    {customerQuery && customerOptions.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-auto rounded-2xl border border-[rgba(15,36,24,0.12)] bg-white shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900">
                        {customerOptions.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className={`w-full px-4 py-2.5 text-left text-sm transition ${
                              form.customer_id === c.id
                                ? "bg-[rgba(47,180,99,0.14)] font-semibold text-emerald-700 dark:bg-[rgba(47,180,99,0.24)] dark:text-emerald-200"
                                : "text-gray-700 hover:bg-[rgba(47,180,99,0.08)] dark:text-gray-300 dark:hover:bg-[rgba(47,180,99,0.16)]"
                            }`}
                            onClick={() => {
                              setForm((f: any) => ({ ...f, customer_id: c.id }));
                              setCustomerQuery(c.name);
                              setCustomerOptions([]);
                            }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {form.customer_id && !customerQuery && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                        <FaCheck className="h-3.5 w-3.5" /> Cliente selecionado
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Link da reunião (Google Meet, Zoom, Teams, etc.)
                    </label>
                    <input
                      className={INPUT_BASE_CLASS}
                      value={form.meeting_url || ""}
                      onChange={(e) => setForm((f: any) => ({ ...f, meeting_url: e.target.value }))}
                      placeholder="https://meet.google.com/abc-defg-hij"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className={ACTION_GHOST_CLASS}
                    onClick={() => {
                      setShowModal(false);
                      setError(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={`${ACTION_PRIMARY_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
                    onClick={saveEvent}
                    disabled={!form.title || !form.calendar_id || !form.start_time || !form.end_time}
                  >
                    Salvar Evento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal: Visualizar/Editar Evento */}
        {showViewEventModal && selectedEvent && (
          <div
            className={DIALOG_OVERLAY_CLASS}
            onClick={() => {
              setShowViewEventModal(false);
              setSelectedEvent(null);
              setIsEditingEvent(false);
            }}
          >
            <div
              className="livechat-panel relative w-full max-w-5xl overflow-hidden rounded-[32px] border border-[rgba(15,36,24,0.12)] bg-white shadow-[0_52px_120px_-70px_rgba(6,20,12,0.85)] dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-gradient-to-r from-[#10361f] via-[#1f8b49] to-[#2fb463] px-8 py-6 text-white">
                <button
                  onClick={() => {
                    setShowViewEventModal(false);
                    setSelectedEvent(null);
                    setIsEditingEvent(false);
                  }}
                  className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <FaTimes className="h-4 w-4" />
                </button>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3 pr-12">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                      <FaCalendarAlt className="h-5 w-5" />
                    </div>
                    <h2 className="text-3xl font-bold leading-tight">{selectedEvent.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/85">
                      {selectedEvent.extendedProps?.event_type && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1">
                          <FaCalendarWeek className="h-3.5 w-3.5" />
                          {EVENT_TYPE_LABELS[selectedEvent.extendedProps.event_type] || selectedEvent.extendedProps.event_type}
                        </span>
                      )}
                      {selectedEvent.extendedProps?.status && (
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${statusChipClass(selectedEvent.extendedProps.status)} backdrop-blur-sm`}>
                          <FaCheck className="h-3.5 w-3.5" />
                          {STATUS_LABELS[selectedEvent.extendedProps.status] || selectedEvent.extendedProps.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-2 text-sm text-white/85">
                    {selectedEventStartLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-semibold">
                        <FaCalendarCheck className="h-3.5 w-3.5" />
                        {selectedEventStartLabel}
                      </span>
                    )}
                    {selectedEventEndLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-semibold">
                        <FaClock className="h-3.5 w-3.5" />
                        Término: {selectedEventEndLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-8 py-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="space-y-6 lg:col-span-2">
                    <div className="rounded-2xl border border-[rgba(15,36,24,0.08)] bg-white/95 p-6 shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/95">
                      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <FaClock className="h-4 w-4 text-emerald-400" />
                        Horário
                      </h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Início</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{selectedEventStartLabel || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Término</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">{selectedEventEndLabel || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {selectedEvent.extendedProps?.description && (
                      <div className="rounded-2xl border border-[rgba(15,36,24,0.08)] bg-white/95 p-6 shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/95">
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          <FaFileAlt className="h-4 w-4 text-emerald-400" />
                          Descrição
                        </h3>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                          {selectedEvent.extendedProps.description}
                        </p>
                      </div>
                    )}

                    {selectedEvent.extendedProps?.location && (
                      <div className="rounded-2xl border border-[rgba(15,36,24,0.08)] bg-white/95 p-6 shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/95">
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          <FaMapMarkerAlt className="h-4 w-4 text-emerald-400" />
                          Local
                        </h3>
                        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                          {selectedEvent.extendedProps.location}
                        </p>
                      </div>
                    )}

                    {selectedEvent.extendedProps?.meeting_url && (
                      <div className="rounded-2xl border border-[rgba(47,180,99,0.35)] bg-[rgba(47,180,99,0.08)] p-6 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-600">
                          <FaGlobe className="h-4 w-4" />
                          Reunião online
                        </h3>
                        <p className="mt-2 text-sm text-emerald-900/70 dark:text-emerald-200/80">Acesse a reunião diretamente no link abaixo.</p>
                        <a
                          href={selectedEvent.extendedProps.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-300"
                        >
                          Abrir link da reunião
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {(customerData || leadData || selectedEvent.extendedProps?.customer_name || selectedEvent.extendedProps?.lead_name) && (
                      <div className="rounded-2xl border border-[rgba(15,36,24,0.1)] bg-white/95 p-6 shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/95">
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          <FaUsers className="h-4 w-4 text-emerald-400" />
                          {customerData ? "Cliente" : leadData ? "Lead" : "Contato"}
                        </h3>
                        {loadingCustomer ? (
                          <div className="flex items-center justify-center py-10">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(47,180,99,0.35)] border-t-transparent" />
                          </div>
                        ) : (
                          <div className="mt-4 space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-3">
                              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(47,180,99,0.18)] text-lg font-bold text-emerald-600 dark:text-emerald-300">
                                {(customerData?.name || leadData?.name || selectedEvent.extendedProps.customer_name || selectedEvent.extendedProps.lead_name || "?").substring(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                  {customerData?.name || leadData?.name || selectedEvent.extendedProps.customer_name || selectedEvent.extendedProps.lead_name || "Contato"}
                                </p>
                                {(customerData?.phone || leadData?.phone || selectedEvent.extendedProps.customer_phone) && (
                                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <FaPhone className="h-3.5 w-3.5" />
                                    {customerData?.phone || leadData?.phone || selectedEvent.extendedProps.customer_phone}
                                  </p>
                                )}
                              </div>
                            </div>

                            {(customerData?.email || leadData?.email || selectedEvent.extendedProps.customer_email) && (
                              <div className="rounded-2xl bg-[rgba(47,180,99,0.08)] px-4 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-200/80">Email</p>
                                <p className="mt-1 break-all text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {customerData?.email || leadData?.email || selectedEvent.extendedProps.customer_email}
                                </p>
                              </div>
                            )}

                            {leadData && (leadData.cellphone || leadData.altCellphone || leadData.telephone || leadData.altTelephone) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Telefones adicionais</p>
                                <div className="mt-1 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  {leadData.cellphone && (
                                    <p>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">Celular:</span> {leadData.cellphone}
                                    </p>
                                  )}
                                  {leadData.altCellphone && (
                                    <p>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">Cel. alt.:</span> {leadData.altCellphone}
                                    </p>
                                  )}
                                  {leadData.telephone && (
                                    <p>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">Telefone:</span> {leadData.telephone}
                                    </p>
                                  )}
                                  {leadData.altTelephone && (
                                    <p>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">Telefone alt.:</span> {leadData.altTelephone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {(customerData?.cpf_cnpj || leadData?.cpf) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Documento</p>
                                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {customerData?.cpf_cnpj || leadData?.cpf}
                                </p>
                              </div>
                            )}

                            {((leadData && (leadData.street || leadData.address)) || customerData?.address) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Endereço</p>
                                <div className="mt-1 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                  {leadData?.street && (
                                    <p>
                                      {leadData.street}
                                      {leadData.number && `, ${leadData.number}`}
                                      {leadData.complement && ` - ${leadData.complement}`}
                                    </p>
                                  )}
                                  {leadData?.neighborhood && <p>{leadData.neighborhood}</p>}
                                  {(leadData?.city || leadData?.state) && (
                                    <p>
                                      {leadData?.city}
                                      {leadData?.state && ` - ${leadData.state}`}
                                      {leadData?.cep && ` • CEP ${leadData.cep}`}
                                    </p>
                                  )}
                                  {leadData?.address && !leadData.street && <p>{leadData.address}</p>}
                                  {customerData?.address && !leadData && <p>{customerData.address}</p>}
                                </div>
                              </div>
                            )}

                            {leadData && (leadData.facebook || leadData.instagram || leadData.twitter || leadData.website || leadData.site) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Redes sociais</p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {leadData.facebook && (
                                    <a
                                      href={leadData.facebook.startsWith("http") ? leadData.facebook : `https://facebook.com/${leadData.facebook}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(47,180,99,0.14)] px-3 py-1 font-semibold text-emerald-600 transition hover:bg-[rgba(47,180,99,0.2)] dark:text-emerald-300"
                                    >
                                      <FaFacebook className="h-3 w-3" /> Facebook
                                    </a>
                                  )}
                                  {leadData.instagram && (
                                    <a
                                      href={leadData.instagram.startsWith("http") ? leadData.instagram : `https://instagram.com/${leadData.instagram}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(47,180,99,0.14)] px-3 py-1 font-semibold text-emerald-600 transition hover:bg-[rgba(47,180,99,0.2)] dark:text-emerald-300"
                                    >
                                      <FaInstagram className="h-3 w-3" /> Instagram
                                    </a>
                                  )}
                                  {leadData.twitter && (
                                    <a
                                      href={leadData.twitter.startsWith("http") ? leadData.twitter : `https://twitter.com/${leadData.twitter}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(47,180,99,0.14)] px-3 py-1 font-semibold text-emerald-600 transition hover:bg-[rgba(47,180,99,0.2)] dark:text-emerald-300"
                                    >
                                      <FaTwitter className="h-3 w-3" /> Twitter
                                    </a>
                                  )}
                                  {(leadData.website || leadData.site) && (
                                    <a
                                      href={leadData.website || leadData.site}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 transition hover:text-emerald-600 dark:bg-gray-800/60 dark:text-gray-200"
                                    >
                                      <FaGlobe className="h-3 w-3" /> Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {(customerData?.notes || leadData?.notes || selectedEvent.extendedProps.customer_notes) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Notas</p>
                                <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                  {customerData?.notes || leadData?.notes || selectedEvent.extendedProps.customer_notes}
                                </p>
                              </div>
                            )}

                            {(customerData?.tags?.length || leadData?.tags?.length || selectedEvent.extendedProps.customer_tags?.length) && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tags</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(customerData?.tags || leadData?.tags || selectedEvent.extendedProps.customer_tags || []).map((tag: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 rounded-full bg-[rgba(47,180,99,0.16)] px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {leadData?.status && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status do lead</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{leadData.status}</p>
                              </div>
                            )}

                            {leadData?.source && (
                              <div className="rounded-2xl bg-white px-4 py-3 shadow-inner dark:bg-gray-800/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Origem</p>
                                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{leadData.source}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-[rgba(15,36,24,0.08)] bg-white/95 p-6 shadow-sm dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900/95">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Informações adicionais</h3>
                      <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Calendário</p>
                          <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{selectedEvent.extendedProps?.calendar_name || "N/A"}</p>
                        </div>
                        {selectedEvent.extendedProps?.created_by_name && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Criado por</p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{selectedEvent.extendedProps.created_by_name}</p>
                          </div>
                        )}
                        {selectedEvent.extendedProps?.created_at && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Criado em</p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                              {new Date(selectedEvent.extendedProps.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(15,36,24,0.08)] bg-gray-50/80 px-8 py-4 dark:border-[rgba(255,255,255,0.06)] dark:bg-gray-900/70">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setForm({
                        title: selectedEvent.title || "",
                        description: selectedEvent.extendedProps?.description || "",
                        location: selectedEvent.extendedProps?.location || "",
                        event_type: selectedEvent.extendedProps?.event_type || "OTHER",
                        status: selectedEvent.extendedProps?.status || "SCHEDULED",
                        start_time: selectedEvent.start ? new Date(selectedEvent.start).toISOString().slice(0, 16) : "",
                        end_time: selectedEvent.end ? new Date(selectedEvent.end).toISOString().slice(0, 16) : "",
                        calendar_id: selectedEvent.extendedProps?.calendar_id || calendars[0]?.id || "",
                        customer_id: selectedEvent.extendedProps?.customer_id || undefined,
                        lead_id: selectedEvent.extendedProps?.lead_id || undefined,
                        meeting_url: selectedEvent.extendedProps?.meeting_url || undefined,
                      });
                      setIsEditingEvent(true);
                      setShowViewEventModal(false);
                      setShowModal(true);
                    }}
                    className={ACTION_SECONDARY_CLASS}
                  >
                    <FaEdit className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm("Deseja realmente deletar este evento?")) {
                        try {
                          await fetchJson(`${API}/calendar/events/${selectedEvent.id}`, {
                            method: "DELETE",
                          });
                          setShowViewEventModal(false);
                          setSelectedEvent(null);
                          if (calendarRef.current) {
                            const api = calendarRef.current.getApi();
                            const view = api.view;
                            await loadEventos(view.activeStart, view.activeEnd);
                          }
                        } catch (err: any) {
                          alert("Erro ao deletar evento: " + err.message);
                        }
                      }
                    }}
                    className={ACTION_DANGER_CLASS}
                  >
                    <FaTrash className="h-4 w-4" />
                    Deletar
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowViewEventModal(false);
                    setSelectedEvent(null);
                    setIsEditingEvent(false);
                  }}
                  className={ACTION_GHOST_CLASS}
                >
                  <FaTimes className="h-4 w-4" />
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task Modal */}
        {showTaskModal && (
          <TaskModal
            isOpen={showTaskModal}
            onClose={() => {
              setShowTaskModal(false);
              setSelectedTask(null);
              setTaskPrefilledDate(null);
              loadTasks(); // Recarregar tasks quando fechar
            }}
            onSubmit={async (data) => {
              try {
                if (selectedTask) {
                  // Atualizar task existente
                  await fetchJson(`${API}/tasks/${selectedTask.id}`, {
                    method: "PUT",
                    body: JSON.stringify(data),
                  });
                } else {
                  // Criar nova task
                  await fetchJson(`${API}/tasks`, {
                    method: "POST",
                    body: JSON.stringify(data),
                  });
                }
                await loadTasks(); // Recarregar tasks
                setShowTaskModal(false);
                setSelectedTask(null);
                setTaskPrefilledDate(null);
              } catch (e: any) {
                console.error("Error saving task:", e);
                throw e;
              }
            }}
            initialData={selectedTask || undefined}
            prefilledData={taskPrefilledDate ? { due_date: taskPrefilledDate.toISOString() } : undefined}
          />
        )}

      </div>
  );
}

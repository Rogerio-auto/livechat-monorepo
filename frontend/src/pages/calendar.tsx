import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import Sidebar from "../componets/Sidbars/sidebar";
import { API, fetchJson } from "../utils/api";
import { 
  FaCalendarAlt, FaUser, FaBuilding, FaCog, FaLock, FaPlus, 
  FaFilter, FaTimes, FaEdit, FaTrash, FaEye, FaCheck, FaClock,
  FaPhone, FaTasks, FaRedo, FaBullseye, FaChalkboardTeacher,
  FaFileAlt, FaCalendarCheck, FaCalendarDay, FaCalendarWeek,
  FaMapMarkerAlt, FaUsers, FaSave, FaBan, FaPalette, FaEnvelope,
  FaFacebook, FaInstagram, FaTwitter, FaGlobe, FaHome
} from "react-icons/fa";

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
  extendedProps: {
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

export function CalendarioPage() {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Event[]>([]);
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
  
  // Navbar states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<"all" | "personal" | "team">("all");
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const defaultCalendarId = useMemo(() => calendars.find((c) => c.is_default)?.id, [calendars]);
  const calendarRef = useRef<any>(null);

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
        backgroundColor: e.backgroundColor || "#3B82F6",
        extendedProps: e.extendedProps,
      })));
    } catch (e: any) {
      console.error("Failed to load events:", e);
      setError(e?.message || "Erro ao carregar eventos");
    } finally {
      setLoading(false);
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
      try {
        const list = await fetchJson<Agent[]>(`${API}/users/agents-supervisors`);
        setAgents(list || []);
      } catch {
        setAgents([]);
      }
    })();
  }, [navigate]);

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
  
  const filteredEvents = useMemo(() => {
    let filtered = eventos;
    
    // Filter by view type
    if (activeView === "personal" && userProfile) {
      filtered = filtered.filter(e => 
        personalCalendars.some(c => e.extendedProps.calendar_name === c.name)
      );
    } else if (activeView === "team") {
      filtered = filtered.filter(e => 
        companyCalendars.some(c => e.extendedProps.calendar_name === c.name)
      );
    }
    
    // Filter by selected calendars
    if (selectedCalendars.length > 0) {
      filtered = filtered.filter(e => 
        selectedCalendars.includes(e.extendedProps.calendar_name || "")
      );
    }
    
    // Filter by event type
    if (filterEventType !== "all") {
      filtered = filtered.filter(e => e.extendedProps.event_type === filterEventType);
    }
    
    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter(e => e.extendedProps.status === filterStatus);
    }
    
    return filtered;
  }, [eventos, activeView, selectedCalendars, filterEventType, filterStatus, personalCalendars, companyCalendars, userProfile]);

  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 transition-colors duration-300">
        <div className="h-screen overflow-auto p-6">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Card principal com todo o conteúdo */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-2xl transition-colors duration-300">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendário</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Gerencie sua agenda e eventos
                  </p>
                  {/* Debug: Mostrar perfil do usuário */}
                  {userProfile && (
                    <div className="mt-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-800 dark:text-blue-300 inline-block">
                      {userProfile.name} • {userProfile.role}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openNewEvent()}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700 hover:shadow-lg"
                >
                  + Novo Evento
                </button>
              </div>

              {/* Navbar de Filtros e Funcionalidades */}
              <div className="mb-6 space-y-4">
                {/* Linha 1: Tabs de Visualização */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    <button
                      onClick={() => setActiveView("all")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "all"
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      <FaCalendarAlt /> Todos os Calendários
                    </button>
                    <button
                      onClick={() => setActiveView("personal")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "personal"
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      <FaUser /> Meu Calendário Pessoal
                    </button>
                    <button
                      onClick={() => setActiveView("team")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeView === "team"
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-md"
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
                        className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/50 flex items-center gap-2 transform hover:scale-105"
                      >
                        <FaCog size={18} /> Gerenciar Calendários
                      </button>
                      <button
                        onClick={() => navigate("/configuracoes?tab=permissoes-calendario")}
                        className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/50 flex items-center gap-2 transform hover:scale-105"
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
                      className="px-4 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-w-[200px]"
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
                    className="px-4 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                    className="px-4 py-2 rounded-lg text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center gap-2"
                    >
                      <FaTimes /> Limpar Filtros
                    </button>
                  )}

                  {/* Indicador de filtros ativos */}
                  {(selectedCalendars.length > 0 || filterEventType !== "all" || filterStatus !== "all") && (
                    <span className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-full">
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
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                  >
                    <FaCalendarCheck /> Hoje
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('dayGridMonth');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                  >
                    <FaCalendarAlt /> Mês
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('timeGridWeek');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    📆 Semana
                  </button>
                  <button
                    onClick={() => {
                      const api = calendarRef.current?.getApi();
                      api?.changeView('timeGridDay');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    📄 Dia
                  </button>
                  <div className="flex-1"></div>
                  <span className="text-xs">
                    Exibindo <strong className="text-blue-600 dark:text-blue-400">{filteredEvents.length}</strong> de <strong>{eventos.length}</strong> eventos
                  </span>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              )}

              {/* Calendar Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent p-5">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total de Eventos</span>
                      <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{eventos.length}</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent p-5">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Calendários</span>
                      <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{calendars.length}</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-green-500/10 via-transparent to-transparent p-5">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-green-500/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Participantes</span>
                      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    <div key={cal.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cal.name}</span>
                      {cal.is_default && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Padrão</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Carregando eventos...
                </div>
              )}

              {/* FullCalendar */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
                    setSelectedEvent({
                      id: info.event.id,
                      title: info.event.title,
                      start: info.event.startStr,
                      end: info.event.endStr,
                      backgroundColor: info.event.backgroundColor,
                      extendedProps: info.event.extendedProps,
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
              className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header fixo do modal */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-8 py-5">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isEditingEvent ? "Editar Evento" : "Novo Evento"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {isEditingEvent ? "Atualize os dados do evento" : "Preencha os dados do evento"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError(null);
                    setIsEditingEvent(false);
                  }}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Fechar
                </button>
              </div>

              {/* Conteúdo com scroll */}
              <div className="overflow-y-auto max-h-[calc(90vh-88px)] px-8 py-6">
                {/* Error display inside modal */}
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Título *</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.title}
                      onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))}
                      placeholder="Ex.: Reunião com cliente"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Calendário *</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Início *</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.start_time}
                      onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fim *</label>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.end_time}
                      onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                    <select
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Local</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.location}
                      onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))}
                      placeholder="Endereço, link ou plataforma"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Descrição</label>
                    <textarea
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
                      placeholder="Detalhes adicionais sobre o evento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cliente</label>
                    <input
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar cliente..."
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                    />
                    {customerQuery && customerOptions.length > 0 && (
                      <div className="mt-1 rounded-xl border border-gray-300 dark:border-gray-600 max-h-40 overflow-auto bg-white dark:bg-gray-800">
                        {customerOptions.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              form.customer_id === c.id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"
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
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <FaCheck /> Cliente selecionado
                      </div>
                    )}
                  </div>
                  
                  {/* Campo de Link da Reunião Online */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Link da Reunião (Google Meet, Zoom, Teams, etc.)
                    </label>
                    <input
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.meeting_url || ""}
                      onChange={(e) => setForm((f: any) => ({ ...f, meeting_url: e.target.value }))}
                      placeholder="https://meet.google.com/abc-defg-hij"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => {
                      setShowModal(false);
                      setError(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
            onClick={() => {
              setShowViewEventModal(false);
              setSelectedEvent(null);
              setIsEditingEvent(false);
            }}
          >
            <div 
              className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header com gradiente e close button */}
              <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6">
                <button
                  onClick={() => {
                    setShowViewEventModal(false);
                    setSelectedEvent(null);
                    setIsEditingEvent(false);
                  }}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                >
                  <FaTimes size={20} />
                </button>
                
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                    <FaCalendarAlt size={28} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {selectedEvent.title}
                    </h2>
                    <div className="flex items-center gap-4 text-white/90 text-sm">
                      <span className="flex items-center gap-2">
                        <FaClock />
                        {new Date(selectedEvent.start || "").toLocaleDateString("pt-BR")}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                        {selectedEvent.extendedProps?.event_type || "Evento"}
                      </span>
                      <span className={`px-3 py-1 rounded-full backdrop-blur-sm ${
                        selectedEvent.extendedProps?.status === "COMPLETED" ? "bg-green-500/30" :
                        selectedEvent.extendedProps?.status === "CANCELLED" ? "bg-red-500/30" :
                        "bg-blue-500/30"
                      }`}>
                        {selectedEvent.extendedProps?.status || "SCHEDULED"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Corpo do Modal */}
              <div className="overflow-y-auto max-h-[calc(90vh-250px)] p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Coluna Principal - Detalhes do Evento */}
                  <div className="lg:col-span-2 space-y-6">
                    
                    {/* Card de Horário */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <FaClock className="text-blue-600 dark:text-blue-400" />
                        Horário
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Início</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {new Date(selectedEvent.start || "").toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Término</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {new Date(selectedEvent.end || "").toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Descrição */}
                    {selectedEvent.extendedProps?.description && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <FaFileAlt className="text-purple-600 dark:text-purple-400" />
                          Descrição
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {selectedEvent.extendedProps.description}
                        </p>
                      </div>
                    )}

                    {/* Local */}
                    {selectedEvent.extendedProps?.location && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <FaMapMarkerAlt className="text-red-600 dark:text-red-400" />
                          Local
                        </h3>
                        <p className="text-gray-700 dark:text-gray-300">
                          {selectedEvent.extendedProps.location}
                        </p>
                      </div>
                    )}

                  </div>

                  {/* Coluna Lateral - Informações do Cliente */}
                  <div className="lg:col-span-1 space-y-6">
                    
                    {/* Card do Cliente/Lead */}
                    {(customerData || leadData || selectedEvent.extendedProps?.customer_name || selectedEvent.extendedProps?.lead_name) && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <FaUser className="text-purple-600 dark:text-purple-400" />
                          {customerData ? 'Cliente' : leadData ? 'Lead' : 'Cliente/Lead'}
                        </h3>
                        
                        {loadingCustomer ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Avatar e Nome */}
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl">
                                {(customerData?.name || leadData?.name || selectedEvent.extendedProps.customer_name || selectedEvent.extendedProps.lead_name || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white text-lg">
                                  {customerData?.name || leadData?.name || selectedEvent.extendedProps.customer_name || selectedEvent.extendedProps.lead_name || "Cliente"}
                                </p>
                                {(customerData?.phone || leadData?.phone || selectedEvent.extendedProps.customer_phone) && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                    <FaPhone size={12} />
                                    {customerData?.phone || leadData?.phone || selectedEvent.extendedProps.customer_phone}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Email */}
                            {(customerData?.email || leadData?.email || selectedEvent.extendedProps.customer_email) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                  <FaEnvelope size={10} /> Email
                                </p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                                  {customerData?.email || leadData?.email || selectedEvent.extendedProps.customer_email}
                                </p>
                              </div>
                            )}

                            {/* Telefones Adicionais do Lead */}
                            {leadData && (leadData.cellphone || leadData.altCellphone || leadData.telephone || leadData.altTelephone) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                                  <FaPhone size={10} /> Telefones
                                </p>
                                <div className="space-y-1 text-sm">
                                  {leadData.cellphone && (
                                    <p className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Celular:</span> {leadData.cellphone}
                                    </p>
                                  )}
                                  {leadData.altCellphone && (
                                    <p className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Cel. Alt:</span> {leadData.altCellphone}
                                    </p>
                                  )}
                                  {leadData.telephone && (
                                    <p className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Telefone:</span> {leadData.telephone}
                                    </p>
                                  )}
                                  {leadData.altTelephone && (
                                    <p className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Tel. Alt:</span> {leadData.altTelephone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* CPF/CNPJ (Customer ou Lead) */}
                            {(customerData?.cpf_cnpj || leadData?.cpf) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CPF/CNPJ</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {customerData?.cpf_cnpj || leadData?.cpf}
                                </p>
                              </div>
                            )}

                            {/* Endereço Completo do Lead */}
                            {leadData && (leadData.street || leadData.address) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                  <FaHome size={10} /> Endereço
                                </p>
                                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                                  {leadData.street && (
                                    <p>
                                      {leadData.street}
                                      {leadData.number && `, ${leadData.number}`}
                                      {leadData.complement && ` - ${leadData.complement}`}
                                    </p>
                                  )}
                                  {leadData.neighborhood && <p>{leadData.neighborhood}</p>}
                                  {(leadData.city || leadData.state) && (
                                    <p>
                                      {leadData.city}{leadData.state && ` - ${leadData.state}`}
                                      {leadData.cep && ` | CEP: ${leadData.cep}`}
                                    </p>
                                  )}
                                  {!leadData.street && leadData.address && <p>{leadData.address}</p>}
                                </div>
                              </div>
                            )}

                            {/* Endereço Simples do Customer */}
                            {customerData?.address && !leadData && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                                  <FaHome size={10} /> Endereço
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {customerData.address}
                                </p>
                              </div>
                            )}

                            {/* Redes Sociais do Lead */}
                            {leadData && (leadData.facebook || leadData.instagram || leadData.twitter || leadData.website || leadData.site) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Redes Sociais</p>
                                <div className="flex flex-wrap gap-2">
                                  {leadData.facebook && (
                                    <a
                                      href={leadData.facebook.startsWith('http') ? leadData.facebook : `https://facebook.com/${leadData.facebook}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs"
                                    >
                                      <FaFacebook /> Facebook
                                    </a>
                                  )}
                                  {leadData.instagram && (
                                    <a
                                      href={leadData.instagram.startsWith('http') ? leadData.instagram : `https://instagram.com/${leadData.instagram}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 hover:bg-pink-200 dark:hover:bg-pink-900/50 transition-colors text-xs"
                                    >
                                      <FaInstagram /> Instagram
                                    </a>
                                  )}
                                  {leadData.twitter && (
                                    <a
                                      href={leadData.twitter.startsWith('http') ? leadData.twitter : `https://twitter.com/${leadData.twitter}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors text-xs"
                                    >
                                      <FaTwitter /> Twitter
                                    </a>
                                  )}
                                  {(leadData.website || leadData.site) && (
                                    <a
                                      href={leadData.website || leadData.site}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs"
                                    >
                                      <FaGlobe /> Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Notas */}
                            {(customerData?.notes || leadData?.notes || selectedEvent.extendedProps.customer_notes) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Notas</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {customerData?.notes || leadData?.notes || selectedEvent.extendedProps.customer_notes}
                                </p>
                              </div>
                            )}

                            {/* Tags */}
                            {(customerData?.tags || leadData?.tags || selectedEvent.extendedProps.customer_tags) && 
                             ((customerData?.tags?.length || 0) > 0 || (leadData?.tags?.length || 0) > 0 || (selectedEvent.extendedProps.customer_tags?.length || 0) > 0) && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Tags</p>
                                <div className="flex flex-wrap gap-2">
                                  {(customerData?.tags || leadData?.tags || selectedEvent.extendedProps.customer_tags || []).map((tag: string, idx: number) => (
                                    <span 
                                      key={idx}
                                      className="px-2 py-1 text-xs rounded-full bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-200"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Status do Lead */}
                            {leadData?.status && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {leadData.status}
                                </p>
                              </div>
                            )}

                            {/* Origem do Lead */}
                            {leadData?.source && (
                              <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Origem</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {leadData.source}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card de Metadados */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Informações Adicionais</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Calendário</p>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {selectedEvent.extendedProps?.calendar_name || "N/A"}
                          </p>
                        </div>
                        {selectedEvent.extendedProps?.created_by_name && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Criado por</p>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {selectedEvent.extendedProps.created_by_name}
                            </p>
                          </div>
                        )}
                        {selectedEvent.extendedProps?.created_at && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Criado em</p>
                            <p className="text-gray-900 dark:text-white font-medium">
                              {new Date(selectedEvent.extendedProps.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Footer com Ações */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-8 py-4 flex justify-between items-center">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Preencher o form com os dados do evento
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
                      // Marcar que está editando
                      setIsEditingEvent(true);
                      // Fechar modal de visualização e abrir modal de edição
                      setShowViewEventModal(false);
                      setShowModal(true);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
                  >
                    <FaEdit /> Editar
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
                    className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all flex items-center gap-2 shadow-lg shadow-red-600/30"
                  >
                    <FaTrash /> Deletar
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowViewEventModal(false);
                    setSelectedEvent(null);
                    setIsEditingEvent(false);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

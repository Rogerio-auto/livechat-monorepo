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
  FaTimes,
  FaCheck,
  FaTasks,
} from "react-icons/fa";
import { Task } from "@livechat/shared";
import { TaskModal } from "../components/tasks/TaskModal";
import { io, Socket } from "socket.io-client";
import { toast } from "../hooks/useToast";
import { Breadcrumbs } from "../components/Breadcrumbs";

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

export function CalendarioPage() {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskPrefilledDate, setTaskPrefilledDate] = useState<Date | null>(null);
  
  // Navbar states
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [activeView, setActiveView] = useState<"all" | "personal" | "team">("all");
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const calendarRef = useRef<any>(null);

  const toggleCalendar = (calendarName: string) => {
    setSelectedCalendars(prev => 
      prev.includes(calendarName) 
        ? prev.filter(c => c !== calendarName) 
        : [...prev, calendarName]
    );
  };

  const handleCalendarAction = (action: string) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (action === 'today') {
      api.today();
    } else if (action === 'prev') {
      api.prev();
    } else if (action === 'next') {
      api.next();
    } else {
      api.changeView(action);
    }
  };

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
    } catch (e: any) {
      console.error("Failed to load calendars:", e);
      setError(e?.message || "Erro ao carregar calendários");
    }
  };

  const loadEventos = async (startISO: string, endISO: string) => {
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

  const handleDatesSet = (arg: any) => {
    setCalendarTitle(arg.view.title);
    loadEventos(arg.startStr, arg.endStr);
  };

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
    <div className="flex-1 flex flex-col min-w-0">
      <div className="w-full px-3 pb-10 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs 
          items={[
            { label: "Calendário", active: true }
          ]} 
        />
        <div className="space-y-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-sm text-(--color-text-muted) mb-2">
              <span className="text-(--color-text) font-medium">Calendário</span>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-(--color-text)">Agenda e Eventos</h1>
                <p className="mt-2 text-(--color-text-muted)">Gerencie seus compromissos e tarefas em um só lugar.</p>
              </div>
              {userProfile && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-[rgba(47,180,99,0.12)] px-3 py-1 text-xs font-semibold text-(--color-primary)">
                  {userProfile.name} • {userProfile.role}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <aside className="lg:w-80 space-y-8">
              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/calendario/novo")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#2fb463] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#2fb463]/20 transition-all duration-200  hover:bg-[#1f8b49]"
                >
                  + Novo Evento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskPrefilledDate(null);
                    setShowTaskModal(true);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-6 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 transition-all duration-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <FaTasks /> Nova Tarefa
                </button>
              </div>

              {/* Views */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Visualização</h3>
                <div className="flex flex-col gap-1">
                  {[
                    { id: "all", label: "Todos os Calendários", icon: FaCalendarAlt },
                    { id: "personal", label: "Meu Calendário", icon: FaUser },
                    { id: "team", label: "Equipe", icon: FaBuilding },
                  ].map((view) => (
                    <button
                      key={view.id}
                      onClick={() => setActiveView(view.id as any)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeView === view.id
                          ? "bg-[rgba(47,180,99,0.1)] text-(--color-primary)"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <view.icon className="w-4 h-4" />
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calendars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Calendários</h3>
                  {canManageCalendars && (
                    <button 
                      onClick={() => navigate("/configuracoes?tab=calendarios")}
                      className="text-[10px] font-bold text-(--color-primary) hover:underline"
                    >
                      GERENCIAR
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {calendars.map((cal) => (
                    <label key={cal.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedCalendars.includes(cal.name)}
                          onChange={() => toggleCalendar(cal.name)}
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-200 dark:border-slate-700 transition-all checked:bg-(--color-primary) checked:border-(--color-primary)"
                        />
                        <FaCheck className="absolute left-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cal.color }} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-(--color-primary) transition-colors">
                        {cal.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtros</h3>
                <div className="space-y-3">
                  <select
                    value={filterEventType}
                    onChange={(e) => setFilterEventType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:border-(--color-primary) focus:outline-none"
                  >
                    <option value="all">Todos os Tipos</option>
                    {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 focus:border-(--color-primary) focus:outline-none"
                  >
                    <option value="all">Todos os Status</option>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Navegação</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCalendarAction('dayGridMonth')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Mês
                  </button>
                  <button
                    onClick={() => handleCalendarAction('timeGridWeek')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => handleCalendarAction('timeGridDay')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Dia
                  </button>
                  <button
                    onClick={() => handleCalendarAction('prev')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handleCalendarAction('next')}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 space-y-6">
              {/* Error display */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <FaTimes className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Stats Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-6 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Eventos</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{eventos.length}</p>
                </div>
                <div className="p-6 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calendários</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{calendars.length}</p>
                </div>
                <div className="p-6 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Participantes</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{agents.length}</p>
                </div>
              </div>

              {/* FullCalendar Container */}
              <div className="rounded-xl p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                    {calendarTitle}
                  </h2>
                </div>
                <div className="calendar-modern-wrapper">
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={false}
                    buttonText={{
                      today: "Hoje",
                      month: "Mês",
                      week: "Semana",
                      day: "Dia",
                    }}
                    locale="pt-br"
                    events={filteredEvents}
                    dateClick={(info) => navigate(`/calendario/novo?start=${info.dateStr}`)}
                    datesSet={handleDatesSet}
                    editable={true}
                    selectable={true}
                    eventClick={(info: EventClickArg) => {
                      const extendedProps = info.event.extendedProps as Event["extendedProps"];
                      if (extendedProps.type === "task" && extendedProps.task) {
                        setSelectedTask(extendedProps.task);
                        setShowTaskModal(true);
                        return;
                      }
                      navigate(`/calendario/${info.event.id}`);
                    }}
                    height="auto"
                  />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      <style>{`
        .calendar-modern-wrapper .fc {
          --fc-border-color: transparent;
          --fc-daygrid-dot-event-dot-border: 4px solid var(--color-primary);
          font-family: inherit;
        }
        .calendar-modern-wrapper .fc-theme-standard td, 
        .calendar-modern-wrapper .fc-theme-standard th {
          border: 1px solid rgba(0,0,0,0.05);
        }
        .dark .calendar-modern-wrapper .fc-theme-standard td, 
        .dark .calendar-modern-wrapper .fc-theme-standard th {
          border: 1px solid rgba(255,255,255,0.05);
        }
        .calendar-modern-wrapper .fc-toolbar-title {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: var(--color-text);
        }
        .calendar-modern-wrapper .fc-toolbar {
          margin-bottom: 2rem !important;
        }
        .calendar-modern-wrapper .fc-button {
          background: transparent !important;
          border: 1px solid rgba(0,0,0,0.1) !important;
          color: var(--color-text) !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          padding: 0.5rem 1rem !important;
          border-radius: 0.75rem !important;
          transition: all 0.2s !important;
          text-transform: capitalize !important;
        }
        .dark .calendar-modern-wrapper .fc-button {
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .calendar-modern-wrapper .fc-button:hover {
          background: rgba(0,0,0,0.05) !important;
        }
        .dark .calendar-modern-wrapper .fc-button:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        .calendar-modern-wrapper .fc-button-active {
          background: var(--color-primary) !important;
          border-color: var(--color-primary) !important;
          color: white !important;
        }
        .calendar-modern-wrapper .fc-event {
          border-radius: 6px !important;
          padding: 2px 4px !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          border: none !important;
        }
      `}</style>

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

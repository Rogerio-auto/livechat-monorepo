import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { 
  FaTimes, FaEdit, FaTrash, FaCalendarAlt, FaClock, 
  FaMapMarkerAlt, FaFileAlt, FaGlobe, FaUsers, FaPhone,
  FaCalendarWeek, FaCheck, FaCalendarCheck
} from "react-icons/fa";
import { ArrowLeft } from "lucide-react";
import { API, fetchJson } from "../../utils/api";
import { toast } from "../../hooks/useToast";
import { Breadcrumbs } from "../../components/Breadcrumbs";

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

const statusChipClass = (status?: string) => {
  switch (status) {
    case "COMPLETED": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "CONFIRMED": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "IN_PROGRESS": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "CANCELLED": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
  }
};

export default function EventView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<any>(`${API}/calendar/events/${id}`);
      setEvent(data);
      
      if (data.customer_id) {
        const customer = await fetchJson<any>(`${API}/customers/${data.customer_id}`);
        setCustomerData(customer);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar evento: " + e.message);
      navigate("/calendario");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Deseja realmente excluir este evento?")) return;
    
    try {
      await fetchJson(`${API}/calendar/events/${id}`, {
        method: "DELETE",
      });
      toast.success("Evento excluído com sucesso!");
      navigate("/calendario");
    } catch (e: any) {
      toast.error("Erro ao excluir evento: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const formatDateTime = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs 
          items={[
            { label: "Calendário", href: "/calendario" },
            { label: event.title, active: true }
          ]} 
        />
        
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FaCalendarAlt className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-(--color-text) tracking-tight">{event.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${statusChipClass(event.status)}`}>
                    {STATUS_LABELS[event.status] || event.status}
                  </span>
                  <span className="text-slate-400 text-sm">•</span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1">
                    <FaCalendarWeek className="w-3.5 h-3.5" />
                    {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Link
                to={`/calendario/${id}/editar`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-bold text-sm"
              >
                <FaEdit className="w-4 h-4" />
                Editar
              </Link>
              <button
                onClick={() => navigate("/calendario")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-(--color-text-muted) hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Time Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Início</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FaCalendarCheck className="text-emerald-500" />
                  {formatDateTime(event.start_time)}
                </p>
              </div>
              <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Término</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FaClock className="text-emerald-500" />
                  {formatDateTime(event.end_time)}
                </p>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FaFileAlt className="text-emerald-500" />
                  Descrição
                </h3>
                <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FaMapMarkerAlt className="text-emerald-500" />
                  Localização
                </h3>
                <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                  {event.location}
                </div>
              </div>
            )}

            {/* Meeting URL */}
            {event.meeting_url && (
              <div className="p-6 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <FaGlobe />
                  Reunião Online
                </h3>
                <a
                  href={event.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                >
                  Entrar na Reunião
                </a>
              </div>
            )}
          </div>

          <div className="space-y-8">
            {/* Customer Info */}
            {(customerData || event.customer_name) && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <FaUsers className="text-emerald-500" />
                  Cliente
                </h3>
                <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl">
                      {(customerData?.name || event.customer_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{customerData?.name || event.customer_name}</p>
                      {customerData?.email && <p className="text-sm text-slate-500">{customerData.email}</p>}
                    </div>
                  </div>
                  
                  {customerData?.phone && (
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <FaPhone className="text-emerald-500" />
                      {customerData.phone}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Informações Adicionais</h3>
              <div className="p-6 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calendário</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{event.calendar_name || "N/A"}</p>
                </div>
                {event.created_by_name && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Criado por</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{event.created_by_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Criado em</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(event.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


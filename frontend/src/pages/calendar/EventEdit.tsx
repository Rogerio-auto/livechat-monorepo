import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaTimes, FaCalendarAlt, FaCheck, FaTrash } from "react-icons/fa";
import { ArrowLeft } from "lucide-react";
import { API, fetchJson } from "../../utils/api";
import { toast } from "../../hooks/useToast";
import { Breadcrumbs } from "../../components/Breadcrumbs";

const INPUT_BASE_CLASS = "w-full rounded-xl border border-[rgba(15,36,24,0.12)] bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:border-[rgba(255,255,255,0.08)] dark:bg-gray-900 dark:text-white";
const ACTION_PRIMARY_CLASS = "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1f8b49] via-[#23a257] to-[#36c173] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#1f8b49]/20 transition-all duration-200  hover:shadow-[#1f8b49]/30";
const ACTION_GHOST_CLASS = "inline-flex items-center gap-2 rounded-xl border border-transparent bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";
const ACTION_DANGER_CLASS = "inline-flex items-center gap-2 rounded-xl bg-red-50 px-6 py-3 text-sm font-bold text-red-600 transition-all hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30";

export default function EventEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    event_type: "OTHER",
    status: "SCHEDULED",
    start_time: "",
    end_time: "",
    calendar_id: "",
    customer_id: undefined as string | undefined,
    meeting_url: undefined as string | undefined,
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [event, cals] = await Promise.all([
        fetchJson<any>(`${API}/calendar/events/${id}`),
        fetchJson<any[]>(`${API}/calendar/calendars`)
      ]);

      setCalendars(cals || []);
      
      const toLocalISO = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      setForm({
        title: event.title || "",
        description: event.description || "",
        location: event.location || "",
        event_type: event.event_type || "OTHER",
        status: event.status || "SCHEDULED",
        start_time: toLocalISO(event.start_time),
        end_time: toLocalISO(event.end_time),
        calendar_id: event.calendar_id || "",
        customer_id: event.customer_id || undefined,
        meeting_url: event.meeting_url || undefined,
      });

      if (event.customer_name) {
        setCustomerQuery(event.customer_name);
      }
    } catch (e: any) {
      setError(e.message || "Erro ao carregar dados do evento");
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };

      await fetchJson(`${API}/calendar/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Evento atualizado com sucesso!");
      navigate(`/calendario/${id}`);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar evento");
    } finally {
      setSaving(false);
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs 
          items={[
            { label: "Calendário", href: "/calendario" },
            { label: form.title || "Evento", href: `/calendario/${id}` },
            { label: "Editar", active: true }
          ]} 
        />
        
        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-(--color-text) tracking-tight">Editar Evento</h1>
              <p className="mt-2 text-lg text-(--color-text-muted)">Altere as informações do seu compromisso.</p>
            </div>
            
            <button
              onClick={() => navigate(`/calendario/${id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-(--color-text-muted) hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="p-8 border border-slate-100 dark:border-slate-800 rounded-xl">
              {error && (
                <div className="p-4 mb-6 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Título *</label>
                  <input
                    className={INPUT_BASE_CLASS}
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Reunião de Alinhamento"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Calendário *</label>
                  <select
                    className={INPUT_BASE_CLASS}
                    value={form.calendar_id}
                    onChange={e => setForm(f => ({ ...f, calendar_id: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {calendars.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tipo</label>
                  <select
                    className={INPUT_BASE_CLASS}
                    value={form.event_type}
                    onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Início *</label>
                  <input
                    type="datetime-local"
                    className={INPUT_BASE_CLASS}
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Fim *</label>
                  <input
                    type="datetime-local"
                    className={INPUT_BASE_CLASS}
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Local</label>
                  <input
                    className={INPUT_BASE_CLASS}
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Endereço ou link da reunião"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Descrição</label>
                  <textarea
                    className={`${INPUT_BASE_CLASS} min-h-[120px]`}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detalhes do evento..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Cliente</label>
                  <input
                    className={INPUT_BASE_CLASS}
                    placeholder="Buscar cliente..."
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                  />
                  {customerQuery && customerOptions.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {customerOptions.map(c => (
                        <button
                          key={c.id}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                          onClick={() => {
                            setForm(f => ({ ...f, customer_id: c.id }));
                            setCustomerQuery(c.name);
                            setCustomerOptions([]);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Link da Reunião</label>
                  <input
                    className={INPUT_BASE_CLASS}
                    value={form.meeting_url || ""}
                    onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 mt-8 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleDelete}
                  className={ACTION_DANGER_CLASS}
                >
                  <FaTrash className="inline-block mr-2" /> Excluir Evento
                </button>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigate(`/calendario/${id}`)}
                    className={ACTION_GHOST_CLASS}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.title || !form.calendar_id || !form.start_time || !form.end_time}
                    className={ACTION_PRIMARY_CLASS}
                  >
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-(--color-text-muted) mb-4 flex items-center gap-2">
                Dicas Rápidas
              </h3>
              <ul className="space-y-4 text-sm text-(--color-text-muted)">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">1</span>
                  <p>Mantenha as informações atualizadas para que toda a equipe esteja alinhada.</p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">2</span>
                  <p>Se o horário mudar, não esqueça de atualizar o início e o término.</p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                  <p>Você pode excluir o evento permanentemente se ele não for mais necessário.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

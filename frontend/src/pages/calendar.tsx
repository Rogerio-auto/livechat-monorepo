import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Sidebar from "../componets/Sidbars/sidebar";

type Agent = { id: string; name: string };
type Customer = { id: string; name: string };

export function CalendarioPage() {
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
  const [eventos, setEventos] = useState<any[]>([]);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const defaultCalendarId = useMemo(() => calendars.find((c) => c.is_default)?.id as string | undefined, [calendars]);
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
    participant_ids: [] as string[],
    customer_id: undefined as string | undefined,
  });

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error((payload as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadCalendars = async () => {
    try {
      const data = await fetchJson<any[]>(`${API}/calendar/calendars`);
      setCalendars(data || []);
      const def = (data || []).find((c: any) => c.is_default)?.id;
      setForm((f: any) => ({ ...f, calendar_id: f.calendar_id || def || "" }));
    } catch (e) { console.error(e); }
  };

  const loadEventos = async (startISO: string, endISO: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startISO, end: endISO });
      const resp = await fetchJson<{ items: any[] }>(`${API}/calendar/events?${params.toString()}`);
      setEventos((resp.items || []).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        backgroundColor: e.backgroundColor,
        extendedProps: e.extendedProps,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadCalendars();
    fetchJson<Agent[]>(`${API}/users/agents-supervisors`).then((list) => setAgents(list || [])).catch(() => setAgents([]));
  }, []);

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
    setForm((f: any) => ({
      ...f,
      title: "",
      description: "",
      location: "",
      event_type: "OTHER",
      status: "SCHEDULED",
      start_time: toLocalInputValue(start),
      end_time: toLocalInputValue(end),
      calendar_id: defaultCalendarId || f.calendar_id || "",
      participant_ids: [],
      customer_id: undefined,
    }));
    setCustomerQuery("");
    setCustomerOptions([]);
    setShowModal(true);
  };

  const handleDateClick = (info: any) => {
    const start = new Date(info.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    openNewEvent({ start, end });
  };

  const saveEvent = async () => {
    try {
      const startISO = fromLocalInputValue(form.start_time).toISOString();
      const endISO = fromLocalInputValue(form.end_time).toISOString();
      await fetchJson(`${API}/calendar/events`, {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          location: form.location || undefined,
          event_type: form.event_type,
          status: form.status,
          start_time: startISO,
          end_time: endISO,
          calendar_id: form.calendar_id,
          participant_ids: form.participant_ids || [],
          customer_id: form.customer_id || undefined,
        }),
      });
      setShowModal(false);
      const api = calendarRef.current?.getApi?.();
      if (api) {
        const view = api.view;
        handleDatesSet({ startStr: view.activeStart.toISOString(), endStr: view.activeEnd.toISOString() });
      }
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar evento");
    }
  };

  useEffect(() => {
    const h = setTimeout(() => {
      const q = customerQuery.trim();
      if (!q) { setCustomerOptions([]); return; }
      // Buscar clientes (customers) preferencialmente; fallback para leads
      fetchJson<{ items: any[] }>(`${API}/livechat/contacts?q=${encodeURIComponent(q)}&limit=20`)
        .then((resp) => setCustomerOptions((resp?.items || []).map((r: any) => ({ id: r.id, name: r.name || r.title || r.id }))))
        .catch(() => {
          fetchJson<{ items: any[] }>(`${API}/livechat/crm/contacts?q=${encodeURIComponent(q)}&limit=20`)
            .then((resp) => setCustomerOptions((resp?.items || []).map((r: any) => ({ id: r.id, name: r.name || r.title || r.id }))))
            .catch(() => setCustomerOptions([]));
        });
    }, 300);
    return () => clearTimeout(h);
  }, [customerQuery]);

  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-gray-100 p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[#204A34]">Agenda Unificada</h2>
            <button onClick={() => openNewEvent()} className="px-4 py-2 rounded-lg bg-[#204A34] text-white hover:bg-[#1a3b2a] transition">Novo Evento</button>
          </div>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={eventos}
            dateClick={handleDateClick}
            datesSet={handleDatesSet}
            editable={true}
            selectable={true}
            eventClick={(info) =>
              alert(`Evento: ${info.event.title}\nStatus: ${info.event.extendedProps?.status || ""}\nInício: ${info.event.start?.toLocaleString()}\nFim: ${info.event.end?.toLocaleString() || "N/A"}`)
            }
            height="80vh"
          />

          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-zinc-800">Novo Evento</h3>
                  <button className="text-zinc-500 hover:text-zinc-700" onClick={() => setShowModal(false)}>✕</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Título</label>
                    <input className="w-full border rounded-lg px-3 py-2" value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ex.: Reunião com cliente" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Calendário</label>
                    <select className="w-full border rounded-lg px-3 py-2" value={form.calendar_id} onChange={(e) => setForm((f: any) => ({ ...f, calendar_id: e.target.value }))}>
                      <option value="">Selecione...</option>
                      {calendars.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Início</label>
                    <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={form.start_time} onChange={(e) => setForm((f: any) => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Fim</label>
                    <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={form.end_time} onChange={(e) => setForm((f: any) => ({ ...f, end_time: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Tipo</label>
                    <select className="w-full border rounded-lg px-3 py-2" value={form.event_type} onChange={(e) => setForm((f: any) => ({ ...f, event_type: e.target.value }))}>
                      <option value="MEETING">Reunião</option>
                      <option value="CALL">Ligação</option>
                      <option value="TECHNICAL_VISIT">Visita técnica</option>
                      <option value="FOLLOW_UP">Follow-up</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Status</label>
                    <select className="w-full border rounded-lg px-3 py-2" value={form.status} onChange={(e) => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                      <option value="SCHEDULED">Agendado</option>
                      <option value="COMPLETED">Concluído</option>
                      <option value="CANCELLED">Cancelado</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-600 mb-1">Local</label>
                    <input className="w-full border rounded-lg px-3 py-2" value={form.location} onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))} placeholder="Endereço ou link" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-600 mb-1">Descrição</label>
                    <textarea className="w-full border rounded-lg px-3 py-2" rows={3} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Participantes</label>
                    <div className="border rounded-lg p-2 max-h-40 overflow-auto">
                      {agents.length === 0 && <div className="text-sm text-zinc-500">Nenhum usuário disponível</div>}
                      {agents.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 py-1">
                          <input type="checkbox" checked={form.participant_ids?.includes(u.id)} onChange={(e) => setForm((f: any) => ({ ...f, participant_ids: e.target.checked ? Array.from(new Set([...(f.participant_ids || []), u.id])) : (f.participant_ids || []).filter((x: string) => x !== u.id) }))} />
                          <span className="text-sm">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-600 mb-1">Cliente</label>
                    <input className="w-full border rounded-lg px-3 py-2" placeholder="Buscar cliente..." value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
                    {customerQuery && (
                      <div className="mt-1 border rounded-lg max-h-40 overflow-auto bg-white">
                        {customerOptions.map((c) => (
                          <button type="button" key={c.id} className={`w-full text-left px-3 py-2 hover:bg-zinc-100 ${form.customer_id === c.id ? 'bg-zinc-50' : ''}`} onClick={() => { setForm((f: any) => ({ ...f, customer_id: c.id })); setCustomerQuery(c.name); }}>
                            {c.name}
                          </button>
                        ))}
                        {customerOptions.length === 0 && <div className="px-3 py-2 text-sm text-zinc-500">Sem resultados</div>}
                      </div>
                    )}
                    {form.customer_id && (
                      <div className="mt-1 text-xs text-zinc-600">Cliente selecionado (id): {form.customer_id}</div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button className="px-4 py-2 rounded-lg border" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button className="px-4 py-2 rounded-lg bg-[#204A34] text-white hover:bg-[#1a3b2a]" onClick={saveEvent} disabled={!form.title || !form.calendar_id}>Salvar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

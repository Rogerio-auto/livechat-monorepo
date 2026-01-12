import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

type CalendarRow = { id: string; name: string; is_default?: boolean };

export function CalendarEmbed({ apiBase }: { apiBase: string }) {
  const API = apiBase.replace(/\/$/, '');
  const [events, setEvents] = useState<any[]>([]);
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const defaultCalendarId = useMemo(() => calendars.find((c) => (c as any).is_default)?.id, [calendars]);
  const [calendarId, setCalendarId] = useState<string>('');
  const calRef = useRef<FullCalendar | null>(null);

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    return res.json();
  };

  const loadCalendars = async () => {
    try {
      const data = await fetchJson<CalendarRow[]>(`${API}/calendar/calendars`);
      setCalendars(data || []);
      const def = (data || []).find((c: any) => c.is_default)?.id;
      setCalendarId((v) => v || def || (data?.[0]?.id ?? ''));
    } catch {}
  };

  const loadEvents = async (startISO: string, endISO: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start: startISO, end: endISO });
      const resp = await fetchJson<{ items: any[] }>(`${API}/calendar/events?${params.toString()}`);
      setEvents((resp.items || []).map((e: any) => ({ id: e.id, title: e.title, start: e.start, end: e.end, extendedProps: e.extendedProps })));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadCalendars().catch(() => {}); }, []);

  const handleDatesSet = (arg: any) => { loadEvents(arg.startStr, arg.endStr); };

  return (
    <div className="mt-3 bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-zinc-50">
        <div className="text-sm font-medium text-zinc-800">Agenda</div>
        <select className="text-xs bg-white border border-zinc-200 rounded px-2 py-1" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
          {(calendars || []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
      </div>
      <div className="p-2">
        <FullCalendar
          ref={calRef as any}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
          height="32vh"
          events={events}
          datesSet={handleDatesSet}
        />
        {loading && <div className="mt-1 text-[11px] text-zinc-500">Carregando eventos...</div>}
      </div>
    </div>
  );
}

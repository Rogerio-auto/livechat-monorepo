import { useState, useEffect, useCallback } from "react";
import { API, fetchJson } from "../utils/api";

export function useCalendarsSettings() {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCalendar, setNewCalendar] = useState({
    name: "",
    type: "PERSONAL" as "PERSONAL" | "TEAM" | "COMPANY" | "PROJECT",
    color: "#3B82F6",
    description: "",
  });

  const fetchCalendars = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<any[]>(`${API}/settings/calendars`);
      setCalendars(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar calendários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  const handleCreateCalendar = async () => {
    if (!newCalendar.name.trim()) {
      alert("O nome do calendário é obrigatório");
      return;
    }
    try {
      await fetchJson(`${API}/settings/calendars`, {
        method: "POST",
        body: JSON.stringify(newCalendar),
      });
      setNewCalendar({
        name: "",
        type: "PERSONAL",
        color: "#3B82F6",
        description: "",
      });
      await fetchCalendars();
    } catch (err: any) {
      console.error("Erro ao criar calendário:", err);
      alert("Erro ao criar calendário");
    }
  };

  const handleDeleteCalendar = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este calendário?")) return;
    try {
      await fetchJson(`${API}/settings/calendars/${id}`, {
        method: "DELETE",
      });
      await fetchCalendars();
    } catch (err: any) {
      console.error("Erro ao excluir calendário:", err);
      alert("Erro ao excluir calendário");
    }
  };

  return {
    calendars,
    loading,
    error,
    newCalendar,
    setNewCalendar,
    handleCreateCalendar,
    handleDeleteCalendar,
    refetch: fetchCalendars,
  };
}

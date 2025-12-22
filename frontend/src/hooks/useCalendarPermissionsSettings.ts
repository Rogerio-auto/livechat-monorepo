import { useState, useEffect } from 'react';
import { fetchJson } from '../lib/fetch';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Calendar {
  id: string;
  name: string;
  type: string;
  color: string;
  description?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Permission {
  user_id: string;
  can_view: boolean;
  can_edit: boolean;
  can_create_events: boolean;
  can_manage: boolean;
  users?: {
    name: string;
    email: string;
  };
}

export function useCalendarPermissionsSettings() {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPermission, setNewPermission] = useState({
    user_id: '',
    can_view: true,
    can_edit: false,
    can_create_events: false,
    can_manage: false,
  });

  const loadCalendars = async () => {
    try {
      const data = await fetchJson<Calendar[]>(`${API}/calendar/calendars`);
      setCalendars(data || []);
    } catch (e) {
      console.error('Erro ao carregar calendários:', e);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await fetchJson<User[]>(`${API}/settings/users`);
      setAllUsers(data || []);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    }
  };

  const loadPermissions = async (calendarId: string) => {
    if (!calendarId) {
      setPermissions([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchJson<Permission[]>(`${API}/calendar/${calendarId}/permissions`);
      setPermissions(data || []);
    } catch (e) {
      console.error('Erro ao carregar permissões:', e);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedCalendarId || !newPermission.user_id) {
      alert('Selecione um calendário e um usuário');
      return;
    }
    try {
      await fetchJson(`${API}/calendar/${selectedCalendarId}/permissions`, {
        method: 'POST',
        body: JSON.stringify(newPermission),
      });
      setNewPermission({
        user_id: '',
        can_view: true,
        can_edit: false,
        can_create_events: false,
        can_manage: false,
      });
      await loadPermissions(selectedCalendarId);
    } catch (e: any) {
      console.error('Erro ao conceder acesso:', e);
      alert(e.message || 'Erro ao conceder acesso');
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste usuário?')) return;
    try {
      await fetchJson(`${API}/calendar/${selectedCalendarId}/permissions/${userId}`, {
        method: 'DELETE',
      });
      await loadPermissions(selectedCalendarId);
    } catch (e: any) {
      console.error('Erro ao revogar acesso:', e);
      alert(e.message || 'Erro ao revogar acesso');
    }
  };

  useEffect(() => {
    loadCalendars();
    loadAllUsers();
  }, []);

  useEffect(() => {
    if (selectedCalendarId) {
      loadPermissions(selectedCalendarId);
    } else {
      setPermissions([]);
    }
  }, [selectedCalendarId]);

  return {
    calendars,
    allUsers,
    selectedCalendarId,
    setSelectedCalendarId,
    permissions,
    loading,
    newPermission,
    setNewPermission,
    handleGrantAccess,
    handleRevokeAccess,
  };
}

// InboxMultiSelect.tsx
// Componente para seleção múltipla de inboxes com badges de provider

import { useState, useEffect } from "react";
import { API, fetchJson } from "../../utils/api";

type Inbox = {
  id: string;
  name: string;
  phone_number: string;
  provider: "META" | "WAHA";
  is_active: boolean;
};

type InboxMultiSelectProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function InboxMultiSelect({ selectedIds, onChange }: InboxMultiSelectProps) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInboxes();
  }, []);

  async function loadInboxes() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchJson<Inbox[]>(`${API}/settings/inboxes`);
      setInboxes(data || []);
    } catch (err) {
      console.error("Error loading inboxes:", err);
      setError("Erro ao carregar inboxes");
    } finally {
      setLoading(false);
    }
  }

  function handleToggle(inboxId: string) {
    if (selectedIds.includes(inboxId)) {
      onChange(selectedIds.filter(id => id !== inboxId));
    } else {
      onChange([...selectedIds, inboxId]);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (inboxes.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center">
        <svg
          className="w-12 h-12 text-gray-600 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-gray-400 text-sm">Nenhuma inbox configurada</p>
        <p className="text-gray-500 text-xs mt-1">Configure inboxes em Configurações primeiro</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
      {inboxes.map((inbox) => (
        <label
          key={inbox.id}
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
            selectedIds.includes(inbox.id)
              ? "bg-green-600/20 border border-green-500/30 hover:bg-green-600/25"
              : "bg-gray-900 border border-gray-700 hover:bg-gray-800 hover:border-gray-600"
          }`}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(inbox.id)}
            onChange={() => handleToggle(inbox.id)}
            className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-offset-gray-900"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{inbox.name}</p>
            <p className="text-xs text-gray-400 truncate">{inbox.phone_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded font-medium ${
                inbox.provider === "META"
                  ? "bg-blue-600/20 text-blue-400"
                  : "bg-green-600/20 text-green-400"
              }`}
            >
              {inbox.provider}
            </span>
            {!inbox.is_active && (
              <span className="text-xs px-2 py-1 rounded bg-gray-600/20 text-gray-400">
                Inativa
              </span>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

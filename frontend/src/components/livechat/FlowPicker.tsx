import React, { useEffect, useState } from "react";
import { FiLayers, FiSearch, FiX, FiSend } from "react-icons/fi";
import { getAccessToken } from "../../utils/api";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

interface Flow {
  id: string;
  name: string;
  status: string;
  categories: string[];
}

interface FlowPickerProps {
  inboxId: string;
  onSelect: (flow: Flow, config: { ctaText: string; headerText: string; bodyText: string }) => void;
  onClose: () => void;
}

export function FlowPicker({ inboxId, onSelect, onClose }: FlowPickerProps) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  
  const [ctaText, setCtaText] = useState("Abrir Formulário");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("Por favor, preencha o formulário abaixo:");

  useEffect(() => {
    async function fetchFlows() {
      if (!inboxId || inboxId === "null") {
        setLoading(false);
        return;
      }
      try {
        const token = getAccessToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const res = await fetch(`${API}/api/meta/flows/${inboxId}`, {
          headers,
          credentials: "include"
        });
        if (!res.ok) throw new Error("Erro ao buscar flows");
        const data = await res.json();
        setFlows(Array.isArray(data.data) ? data.data : []);
      } catch (err) {
        console.error("Error fetching flows:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFlows();
  }, [inboxId]);

  const filteredFlows = flows.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = () => {
    if (selectedFlow) {
      onSelect(selectedFlow, { ctaText, headerText, bodyText });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-(--color-border) flex items-center justify-between bg-(--color-surface-muted)">
          <div className="flex items-center gap-2">
            <FiLayers className="text-blue-500 w-5 h-5" />
            <h3 className="font-semibold text-(--color-text)">Enviar WhatsApp Flow</h3>
          </div>
          <button onClick={onClose} className="text-(--color-text-muted) hover:text-(--color-text)">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedFlow ? (
            <>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar flow por nome ou ID..."
                  className="w-full pl-10 pr-4 py-2 bg-(--color-surface-muted) border border-(--color-border) rounded-xl text-sm focus:outline-none focus:border-blue-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="py-10 text-center text-sm text-(--color-text-muted)">Carregando flows...</div>
              ) : filteredFlows.length === 0 ? (
                <div className="py-10 text-center text-sm text-(--color-text-muted)">Nenhum flow encontrado nesta inbox.</div>
              ) : (
                <div className="grid gap-2">
                  {filteredFlows.map(flow => (
                    <button
                      key={flow.id}
                      onClick={() => setSelectedFlow(flow)}
                      className="p-3 text-left bg-(--color-surface-muted) hover:bg-blue-500/10 border border-(--color-border) hover:border-blue-500/50 rounded-xl transition-all group"
                    >
                      <div className="font-medium text-sm group-hover:text-blue-500">{flow.name}</div>
                      <div className="text-[10px] text-(--color-text-muted) flex justify-between mt-1">
                        <span>ID: {flow.id}</span>
                        <span className="uppercase">{flow.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => setSelectedFlow(null)}
                className="text-xs text-blue-500 hover:underline mb-2 flex items-center gap-1"
              >
                ← Voltar para lista
              </button>

              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <div className="text-xs font-bold text-blue-500 mb-1">FLOW SELECIONADO</div>
                <div className="text-sm font-medium">{selectedFlow.name}</div>
                <div className="text-[10px] opacity-70">ID: {selectedFlow.id}</div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Texto do Cabeçalho (Opcional)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-(--color-surface-muted) border border-(--color-border) rounded-lg text-sm"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Ex: Título do Formulário"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Corpo da Mensagem</label>
                  <textarea
                    className="w-full px-3 py-2 bg-(--color-surface-muted) border border-(--color-border) rounded-lg text-sm"
                    rows={2}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-(--color-text-muted) mb-1">Texto do Botão (CTA)</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-(--color-surface-muted) border border-(--color-border) rounded-lg text-sm"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-(--color-border) flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-(--color-text) bg-(--color-surface-muted) rounded-xl hover:bg-(--color-border) transition-colors"
          >
            Cancelar
          </button>
          <button
            disabled={!selectedFlow}
            onClick={handleSend}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <FiSend className="w-4 h-4" />
            Enviar Flow
          </button>
        </div>
      </div>
    </div>
  );
}

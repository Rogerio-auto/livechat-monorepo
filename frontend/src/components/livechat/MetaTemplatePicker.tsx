import React, { useEffect, useState } from "react";
import { FiFileText, FiSearch, FiX, FiSend, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { getAccessToken } from "../../utils/api";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";

interface WhatsAppTemplate {
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
  id: string;
}

interface MetaTemplatePickerProps {
  inboxId: string;
  onSelect: (template: WhatsAppTemplate, components: any[]) => void;
  onClose: () => void;
}

export function MetaTemplatePicker({ inboxId, onSelect, onClose }: MetaTemplatePickerProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const token = getAccessToken();
        const headers = new Headers();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const res = await fetch(`${API}/api/meta/templates/list/${inboxId}?status=APPROVED`, {
          headers,
          credentials: "include"
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Erro ao buscar templates");
        }
        const data = await res.json();
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, [inboxId]);

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    // Reset variables
    const newVars: Record<string, string> = {};
    const body = template.components.find(c => c.type === "BODY");
    if (body?.text) {
      const matches = body.text.match(/{{(\d+)}}/g);
      if (matches) {
        matches.forEach((m: string) => {
          const num = m.replace(/[{}]/g, "");
          newVars[`body_${num}`] = "";
        });
      }
    }
    const header = template.components.find(c => c.type === "HEADER");
    if (header?.format === "TEXT" && header.text) {
      const matches = header.text.match(/{{(\d+)}}/g);
      if (matches) {
        matches.forEach((m: string) => {
          const num = m.replace(/[{}]/g, "");
          newVars[`header_${num}`] = "";
        });
      }
    }
    setVariables(newVars);
  };

  const handleSend = () => {
    if (selectedTemplate) {
      const components: any[] = [];
      
      // Body Params
      const bodyMatches = (selectedTemplate.components.find(c => c.type === "BODY")?.text || "").match(/{{(\d+)}}/g);
      if (bodyMatches) {
        const bodyParams = bodyMatches.map((m: string) => {
          const num = m.replace(/[{}]/g, "");
          return { type: "text", text: variables[`body_${num}`] || "" };
        });
        components.push({
          type: "body",
          parameters: bodyParams
        });
      }

      // Header Params (if Text)
      const header = selectedTemplate.components.find(c => c.type === "HEADER");
      if (header?.format === "TEXT") {
        const headerMatches = (header.text || "").match(/{{(\d+)}}/g);
        if (headerMatches) {
          const headerParams = headerMatches.map((m: string) => {
            const num = m.replace(/[{}]/g, "");
            return { type: "text", text: variables[`header_${num}`] || "" };
          });
          components.push({
            type: "header",
            parameters: headerParams
          });
        }
      } else if (header?.format === "IMAGE" || header?.format === "VIDEO" || header?.format === "DOCUMENT") {
        // Para media, precisamos de um link. Por enquanto, se o usuário não puder subir, 
        // vamos ao menos mandar um parâmetro vazio ou placeholder para não dar erro 500
        // Idealmente deveríamos ter um input de URL ou upload aqui
        components.push({
          type: "header",
          parameters: [{
            type: header.format.toLowerCase(),
            [header.format.toLowerCase()]: { link: variables["header_media_url"] || "" }
          }]
        });
      }

      onSelect(selectedTemplate, components);
    }
  };

  const getBodyText = (template: WhatsAppTemplate) => {
    const body = template.components.find(c => c.type === "BODY");
    return body?.text || "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-(--color-border) flex items-center justify-between bg-(--color-surface-muted)">
          <div className="flex items-center gap-2">
            <FiFileText className="text-green-500 w-5 h-5" />
            <h3 className="font-semibold text-(--color-text)">Enviar Template Meta</h3>
          </div>
          <button onClick={onClose} className="text-(--color-text-muted) hover:text-(--color-text)">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedTemplate ? (
            <>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                <input
                  type="text"
                  placeholder="Buscar template por nome..."
                  className="w-full pl-10 pr-4 py-2 bg-(--color-surface-muted) border border-(--color-border) rounded-xl text-sm focus:outline-none focus:border-green-500"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="py-10 text-center text-sm text-(--color-text-muted)">Carregando templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-10 text-center text-sm text-(--color-text-muted)">Nenhum template aprovado encontrado.</div>
              ) : (
                <div className="grid gap-2">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="p-3 text-left bg-(--color-surface-muted) hover:bg-green-500/10 border border-(--color-border) hover:border-green-500/50 rounded-xl transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm group-hover:text-green-500">{template.name}</div>
                        <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded uppercase font-bold">
                          {template.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-(--color-text-muted) mt-1 line-clamp-2 italic">
                        "{getBodyText(template)}"
                      </div>
                      <div className="text-[10px] text-(--color-text-muted) mt-2 flex gap-2">
                        <span className="bg-(--color-border) px-1 rounded">{template.category}</span>
                        <span className="bg-(--color-border) px-1 rounded">{template.language}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                <div className="text-[10px] uppercase text-green-600 font-bold mb-1">Template Selecionado</div>
                <div className="font-semibold text-sm mb-2">{selectedTemplate.name}</div>
                <div className="text-sm p-3 bg-(--color-surface) border border-(--color-border) rounded-lg whitespace-pre-wrap">
                  {getBodyText(selectedTemplate)}
                </div>
                
                {Object.keys(variables).length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="text-[10px] uppercase text-(--color-text-muted) font-bold">Variáveis do Template</div>
                    {Object.keys(variables).map(key => (
                      <div key={key} className="space-y-1">
                        <label className="text-[11px] text-(--color-text-muted)">
                          {key.startsWith("header") ? `Cabeçalho (${key.split("_")[1]})` : `Corpo (${key.split("_")[1]})`}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-1.5 bg-(--color-surface) border border-(--color-border) rounded-lg text-sm focus:outline-none focus:border-green-500"
                          placeholder={`Valor para {{${key.split("_")[1]}}}`}
                          value={variables[key]}
                          onChange={(e) => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedTemplate.components.some(c => c.type === "HEADER" && ["IMAGE", "VIDEO", "DOCUMENT"].includes(c.format)) && (
                  <div className="mt-4 space-y-3">
                    <div className="text-[10px] uppercase text-(--color-text-muted) font-bold">Mídia do Cabeçalho</div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-(--color-text-muted)">URL da Mídia</label>
                      <input
                        type="text"
                        className="w-full px-3 py-1.5 bg-(--color-surface) border border-(--color-border) rounded-lg text-sm focus:outline-none focus:border-green-500"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={variables["header_media_url"] || ""}
                        onChange={(e) => setVariables(prev => ({ ...prev, header_media_url: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-(--color-text-muted) mt-3 leading-relaxed">
                  <FiAlertCircle className="inline mr-1" />
                  Templates iniciam uma janela de 24 horas de conversa paga.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="flex-1 py-2 text-sm font-medium text-(--color-text-muted) hover:text-(--color-text) bg-(--color-surface-muted) rounded-xl border border-(--color-border) transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSend}
                  className="flex-[2] py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FiSend className="w-4 h-4" />
                  Enviar Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

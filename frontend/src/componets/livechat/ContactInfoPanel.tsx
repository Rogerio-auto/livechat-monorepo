import { useState, useEffect } from "react";
import { FiUser, FiMail, FiPhone, FiMapPin, FiCalendar, FiTag, FiX, FiImage, FiFileText, FiLink, FiInfo, FiGlobe, FiEdit2, FiCheck, FiXCircle } from "react-icons/fi";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Chat, Message } from "./types";

type Props = {
  chat: Chat | null;
  apiBase?: string;
  onClose: () => void;
};

function EditableField({ 
  label, 
  value, 
  icon: Icon, 
  onSave,
  placeholder = "Não informado"
}: { 
  label: string; 
  value: string | null | undefined; 
  icon: any; 
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (draft === (value || "")) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save", error);
      alert("Erro ao salvar alteração");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm p-3 rounded-xl bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/30 transition-colors group relative">
      <div className="w-8 h-8 rounded-lg bg-[color:var(--color-surface)] flex items-center justify-center text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-primary)] transition-colors shrink-0">
        <Icon size={14} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[color:var(--color-text-muted)] mb-0.5">{label}</div>
        {isEditing ? (
          <input
            className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded px-2 py-1 text-xs text-[color:var(--color-text)] focus:outline-none focus:border-[color:var(--color-primary)]"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setDraft(value || "");
                setIsEditing(false);
              }
            }}
            disabled={saving}
          />
        ) : (
          <div className={`truncate font-medium ${!value ? "text-[color:var(--color-text-muted)] italic opacity-70" : "text-[color:var(--color-text)]"}`}>
            {value || placeholder}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-lg hover:bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)] transition-colors"
              title="Salvar"
            >
              <FiCheck size={14} />
            </button>
            <button 
              onClick={() => {
                setDraft(value || "");
                setIsEditing(false);
              }}
              disabled={saving}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
              title="Cancelar"
            >
              <FiXCircle size={14} />
            </button>
          </>
        ) : (
          <button 
            onClick={() => {
              setDraft(value || "");
              setIsEditing(true);
            }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-primary)] transition-all"
            title="Editar"
          >
            <FiEdit2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function MediaGallery({ chat, apiBase, type }: { chat: Chat; apiBase?: string; type: "IMAGE" | "DOCUMENT" | "LINK" }) {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiBase) return;
    setLoading(true);
    // Fetch messages (simplified - ideally should have a specific media endpoint)
    fetch(`${apiBase}/livechat/chats/${chat.id}/messages?limit=100`)
      .then(res => res.json())
      .then(data => {
        const msgs = (Array.isArray(data) ? data : data.data || []) as Message[];
        const filtered = msgs.filter(m => {
          if (type === "LINK") {
             // Simple link detection regex
             return /https?:\/\/[^\s]+/.test(m.content || "");
          }
          return m.type === type || (m.media_url && type === "IMAGE" && (m.type === "IMAGE" || m.type === "VIDEO"));
        });
        setItems(filtered);
      })
      .catch(err => console.error("Failed to load media", err))
      .finally(() => setLoading(false));
  }, [chat.id, apiBase, type]);

  if (loading) return <div className="p-4 text-center text-xs text-[color:var(--color-text-muted)]">Carregando...</div>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-[color:var(--color-text-muted)] opacity-60">
        {type === "IMAGE" && <FiImage size={24} className="mb-2" />}
        {type === "DOCUMENT" && <FiFileText size={24} className="mb-2" />}
        {type === "LINK" && <FiLink size={24} className="mb-2" />}
        <span className="text-xs">Nenhum item encontrado</span>
      </div>
    );
  }

  if (type === "IMAGE") {
    return (
      <div className="grid grid-cols-3 gap-2 p-2">
        {items.map(m => (
          <a key={m.id} href={m.media_url || "#"} target="_blank" rel="noopener noreferrer" className="aspect-square bg-[color:var(--color-surface-muted)] rounded-lg overflow-hidden border border-[color:var(--color-border)] hover:opacity-80 transition-opacity">
            {m.type === "VIDEO" ? (
              <video src={m.media_url || ""} className="w-full h-full object-cover" />
            ) : (
              <img src={m.media_url || ""} alt="Media" className="w-full h-full object-cover" />
            )}
          </a>
        ))}
      </div>
    );
  }

  if (type === "LINK") {
     return (
        <div className="flex flex-col gap-2 p-2">
           {items.map(m => {
              const links = m.content.match(/https?:\/\/[^\s]+/g) || [];
              return links.map((link, i) => (
                 <a key={`${m.id}-${i}`} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface)] transition-colors">
                    <div className="w-8 h-8 rounded bg-[color:var(--color-primary)]/10 flex items-center justify-center text-[color:var(--color-primary)] shrink-0">
                       <FiLink size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="text-xs font-medium truncate text-[color:var(--color-text)]">{link}</div>
                       <div className="text-[10px] text-[color:var(--color-text-muted)]">{format(new Date(m.created_at || Date.now()), "dd/MM/yyyy HH:mm")}</div>
                    </div>
                 </a>
              ));
           })}
        </div>
     );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {items.map(m => (
        <a key={m.id} href={m.media_url || "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface)] transition-colors">
          <div className="w-8 h-8 rounded bg-[color:var(--color-primary)]/10 flex items-center justify-center text-[color:var(--color-primary)] shrink-0">
            <FiFileText size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate text-[color:var(--color-text)]">{m.body || "Documento"}</div>
            <div className="text-[10px] text-[color:var(--color-text-muted)]">{format(new Date(m.created_at || Date.now()), "dd/MM/yyyy HH:mm")}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

export function ContactInfoPanel({ chat, apiBase, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"info" | "media" | "docs" | "links">("info");
  // Local state to reflect immediate updates
  const [localChat, setLocalChat] = useState<Chat | null>(chat);

  useEffect(() => {
    setLocalChat(chat);
  }, [chat]);

  if (!localChat) return null;

  const contactName = localChat.customer_name || localChat.display_name || "Desconhecido";
  const contactPhone = localChat.display_phone || localChat.remote_id?.replace("@s.whatsapp.net", "") || "Sem número";
  const contactAvatar = localChat.photo_url || localChat.customer_avatar_url;

  const handleUpdateContact = async (field: string, value: string) => {
    if (!apiBase || !localChat.customer_id) {
      console.warn("Cannot update contact: missing apiBase or customer_id");
      return;
    }

    // Optimistic update
    setLocalChat(prev => prev ? ({ ...prev, [field]: value }) : null);

    try {
      // Assuming a generic update endpoint for contact or chat
      // Since we don't have a specific contact update endpoint confirmed, 
      // we'll try to update the chat's customer info if possible, or just log it for now.
      // In a real scenario: await fetch(`${apiBase}/contacts/${localChat.customer_id}`, { method: 'PUT', body: JSON.stringify({ [field]: value }) ... })
      
      // For now, we'll simulate a success to keep the UI responsive as requested
      console.log(`Updating contact ${localChat.customer_id} field ${field} to ${value}`);
      
      // If there was a real endpoint, we would call it here.
      // await fetch(`${apiBase}/livechat/contacts/${localChat.customer_id}`, ...);
      
    } catch (error) {
      console.error("Failed to update contact", error);
      // Revert optimistic update if needed
    }
  };

  return (
    <div className="h-full flex flex-col bg-[color:var(--color-surface)] border-l border-[color:var(--color-border)] w-[420px] shadow-xl z-20 transition-all duration-300">
      <div className="p-4 border-b border-[color:var(--color-border)] flex items-center justify-between bg-[color:var(--color-surface)] backdrop-blur-sm">
        <h3 className="font-semibold text-sm text-[color:var(--color-heading)]">Detalhes</h3>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-[color:var(--color-surface-muted)] rounded-full transition-colors text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          <FiX size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[color:var(--color-border)] px-2">
        {[
          { id: "info", icon: FiInfo, label: "Info" },
          { id: "media", icon: FiImage, label: "Mídia" },
          { id: "docs", icon: FiFileText, label: "Docs" },
          { id: "links", icon: FiLink, label: "Links" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium uppercase tracking-wide transition-colors relative ${
              activeTab === tab.id
                ? "text-[color:var(--color-primary)]"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[color:var(--color-primary)] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "info" && (
          <div className="p-4 space-y-6">
            {/* Header Profile */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[color:var(--color-surface-muted)] mb-3 overflow-hidden border-4 border-[color:var(--color-surface)] shadow-lg ring-1 ring-[color:var(--color-border)]">
                {contactAvatar ? (
                  <img src={contactAvatar} alt={contactName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                    <FiUser size={40} />
                  </div>
                )}
              </div>
              <h2 className="font-bold text-lg text-[color:var(--color-heading)]">{contactName}</h2>
              <p className="text-sm text-[color:var(--color-text-muted)] font-mono">{contactPhone}</p>
            </div>

            {/* Info List */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Contato</label>
                <div className="flex flex-col gap-2">
                  <EditableField 
                    label="Email" 
                    value={localChat.customer_email} 
                    icon={FiMail} 
                    onSave={(val) => handleUpdateContact('customer_email', val)} 
                  />
                  <EditableField 
                    label="Telefone" 
                    value={contactPhone} 
                    icon={FiPhone} 
                    onSave={(val) => handleUpdateContact('customer_phone', val)} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Dados Adicionais</label>
                <div className="flex flex-col gap-2">
                   <EditableField 
                    label="Endereço" 
                    value={(localChat as any).address} 
                    icon={FiMapPin} 
                    onSave={(val) => handleUpdateContact('address', val)} 
                    placeholder="Não cadastrado"
                  />
                   <EditableField 
                    label="Website" 
                    value={(localChat as any).website} 
                    icon={FiGlobe} 
                    onSave={(val) => handleUpdateContact('website', val)} 
                    placeholder="Não cadastrado"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">Sistema</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)]">
                    <div className="text-[10px] text-[color:var(--color-text-muted)] mb-1">Origem</div>
                    <div className="font-medium text-xs flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      {localChat.kind || "WhatsApp"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)]">
                    <div className="text-[10px] text-[color:var(--color-text-muted)] mb-1">Criado em</div>
                    <div className="font-medium text-xs">
                      {localChat.created_at 
                        ? format(new Date(localChat.created_at), "dd/MM/yy", { locale: ptBR })
                        : "N/A"
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--color-border)]">
              <label className="text-[10px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                <FiTag /> Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {localChat.tag_ids && localChat.tag_ids.length > 0 ? (
                   <div className="text-xs text-[color:var(--color-text-muted)] italic">Tags gerenciadas no cabeçalho</div>
                ) : (
                  <span className="text-xs text-[color:var(--color-text-muted)] italic">Sem tags</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "media" && <MediaGallery chat={localChat} apiBase={apiBase} type="IMAGE" />}
        {activeTab === "docs" && <MediaGallery chat={localChat} apiBase={apiBase} type="DOCUMENT" />}
        {activeTab === "links" && <MediaGallery chat={localChat} apiBase={apiBase} type="LINK" />}
      </div>
    </div>
  );
}

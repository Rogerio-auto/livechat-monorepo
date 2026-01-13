import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { FiClock, FiCheck, FiLock, FiAlertTriangle, FiRotateCcw, FiCpu, FiMoreVertical, FiEdit2, FiTrash2, FiCornerUpLeft, FiLayers, FiMapPin, FiInfo, FiFileText } from "react-icons/fi";
import { BiCheckDouble } from "react-icons/bi";
import Lightbox from "../../components/ui/Lightbox";
import AudioPlayerWhatsApp from "../../components/livechat/AudioPlayerWhatsApp";
import type { Message } from "@livechat/shared";

type MediaLightboxItem = {
  id: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  url: string;
  caption?: string | null;
};

type MessageBubbleProps = {
  m: Message;
  isAgent: boolean;
  mediaItems?: MediaLightboxItem[];
  mediaIndex?: number | null;
  showRemoteSenderInfo?: boolean;
  onRetry?: (message: Message) => void;
  onReply?: () => void;
  onEdit?: (message: Message, data: { text: string; linkPreview?: boolean; linkPreviewHighQuality?: boolean }) => void;
  onDelete?: (message: Message) => void;
  allMessages?: Message[]; // Para buscar mensagem citada
  customerName?: string | null; // Nome do contato/cliente do chat
};

export function MessageBubble({
  m,
  isAgent,
  mediaItems,
  mediaIndex,
  showRemoteSenderInfo = false,
  onRetry,
  onReply,
  onEdit,
  onDelete,
  allMessages = [],
  customerName = null,
}: MessageBubbleProps) {
  const deliveryStatusSource =
    typeof m.delivery_status === "string" && m.delivery_status
      ? m.delivery_status
      : typeof m.view_status === "string" && m.view_status
        ? m.view_status
        : "";
  const deliveryStatus = deliveryStatusSource.toLowerCase();
  const isDeleted = (m.view_status || "").toLowerCase() === "deleted";
  const time = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const wrap = isAgent ? "w-full flex justify-end" : "w-full flex justify-start";
  const bubbleBase =
    "relative inline-block w-auto max-w-[85%] sm:max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md leading-snug whitespace-pre-wrap break-words text-[13px] transition-colors duration-200 backdrop-blur-[2px]";
  const isPrivate = !!m.is_private || m.type === "PRIVATE";
  const bubbleSideClass = isPrivate ? "" : isAgent ? "rounded-br-none" : "rounded-bl-none";
  const bubbleStyle: CSSProperties = useMemo(() => {
    if (isPrivate) {
      return {
        background: "color-mix(in srgb, var(--color-highlight) 40%, var(--color-bg))",
        color: "var(--color-heading)",
      };
    }
    if (isAgent) {
      return {
        background: "var(--color-primary)",
        color: "var(--color-on-primary)",
      };
    }
    return {
      background: "color-mix(in srgb, var(--color-surface) 45%, var(--color-bg))",
      color: "var(--color-text)",
    };
  }, [isAgent, isPrivate]);

  const messageType = useMemo(() => {
    const type = (m.type || "TEXT").toUpperCase();
    const body = (m.body || m.content || "").toUpperCase();
    const hasMedia = !!(m.media_public_url || m.media_url || m.media_storage_path);
    
    if (type === "TEXT" && hasMedia) {
      if (body.startsWith("[DOCUMENT]") || body.startsWith("[DOCUMENTO]") || body.startsWith("[FILE]") || body.includes("📄 DOCUMENTO")) {
        return "DOCUMENT";
      }
      if (body.startsWith("[IMAGE]") || body.includes("📷 IMAGEM")) return "IMAGE";
      if (body.startsWith("[VIDEO]") || body.includes("🎥 VÍDEO")) return "VIDEO";
      if (body.startsWith("[AUDIO]") || body.startsWith("[PTT]") || body.includes("🎵 ÁUDIO") || body.includes("🎤 ÁUDIO") || body.includes("🎤 VOZ")) return "AUDIO";
      if (body.startsWith("[STICKER]") || body.includes("💟 FIGURINHA")) return "STICKER";
    }
    return type;
  }, [m.type, m.body, m.content, m.media_public_url, m.media_url, m.media_storage_path]);

  // Fallback para URLs de mídia
  const mediaUrl = m.media_public_url || m.media_url || null;
  const textBody = m.body ?? m.content ?? "";
  const caption = m.caption ?? (["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "FILE", "STICKER"].includes(messageType) ? textBody : null);

  const displayFilename = useMemo(() => {
    if (messageType !== "DOCUMENT" && messageType !== "FILE") return null;
    let name = m.body || m.content || "Documento";
    // Remove prefixos comuns de worker
    name = name.replace(/^\[DOCUMENT\]\s*/i, "");
    name = name.replace(/^\[DOCUMENTO\]\s*/i, "");
    name = name.replace(/^\[FILE\]\s*/i, "");
    name = name.replace(/^📄\s*Documento\s*/i, "");
    return name;
  }, [messageType, m.body, m.content]);

  const remoteDisplayName = useMemo(() => {
    return (
      m.remote_sender_name ||
      m.remote_sender_phone ||
      m.remote_sender_id ||
      null
    );
  }, [m.remote_sender_name, m.remote_sender_phone, m.remote_sender_id]);
  const resolvedRemoteName = remoteDisplayName || "Participante";
  const remoteAvatarUrl = m.remote_sender_avatar_url ?? null;
  const showRemoteSender =
    showRemoteSenderInfo &&
    !isAgent &&
    Boolean(remoteDisplayName && (m.remote_participant_id || m.remote_sender_id));
  const remoteInitials = useMemo(() => {
    const base = remoteDisplayName || "?";
    return base.slice(0, 2).toUpperCase();
  }, [remoteDisplayName]);

  // Find quoted/replied message
  const quotedMessage = useMemo(() => {
    if (!m.replied_message_id || !allMessages.length) {
      if (m.replied_message_id) {
        console.log('[MessageBubble] replied_message_id present but no messages to search:', {
          messageId: m.id,
          replied_message_id: m.replied_message_id,
          allMessagesCount: allMessages.length
        });
      }
      return null;
    }
    // Backend now returns UUID in replied_message_id field
    const found = allMessages.find(msg => msg.id === m.replied_message_id);
    console.log('[MessageBubble] Searching for quoted message:', {
      messageId: m.id,
      replied_message_id: m.replied_message_id,
      found: !!found,
      foundId: found?.id,
      allMessagesCount: allMessages.length
    });
    return found || null;
  }, [m.replied_message_id, m.id, allMessages]);

  const fallbackLightboxItems = useMemo<MediaLightboxItem[]>(() => {
    if (!mediaUrl || !["IMAGE", "VIDEO", "DOCUMENT"].includes(messageType)) {
      return [];
    }
    return [
      {
        id: m.id,
        type: messageType as "IMAGE" | "VIDEO" | "DOCUMENT",
        url: mediaUrl,
        caption: caption || null,
      },
    ];
  }, [mediaUrl, messageType, m.id, caption]);

  const resolvedMediaItems = useMemo(() => {
    if (mediaItems && mediaItems.length > 0) return mediaItems;
    return fallbackLightboxItems;
  }, [mediaItems, fallbackLightboxItems]);

  const resolvedMediaIndex = useMemo(() => {
    if (mediaItems && typeof mediaIndex === "number" && mediaIndex >= 0) {
      return mediaIndex;
    }
    if (!resolvedMediaItems.length) return 0;
    const found = resolvedMediaItems.findIndex((item) => item.id === m.id);
    return found >= 0 ? found : 0;
  }, [mediaIndex, mediaItems, resolvedMediaItems, m.id]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(resolvedMediaIndex);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState<string>(m.body || m.content || "");
  const [useLinkPreview, setUseLinkPreview] = useState(true);
  const [useLinkPreviewHQ, setUseLinkPreviewHQ] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setLightboxIndex(resolvedMediaIndex);
  }, [resolvedMediaIndex, resolvedMediaItems]);

  if (messageType === "SYSTEM") {
    return (
      <div className="flex justify-center my-2 w-full">
        <span className="bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full shadow-sm border border-gray-200 dark:border-gray-700/50 flex items-center gap-1.5">
          <FiInfo className="w-3 h-3 opacity-70" />
          {m.body ?? m.content}
        </span>
      </div>
    );
  }

  const handleMenuMouseLeave = (event: MouseEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setShowMenu(false);
    }
  };

  const openLightbox = () => {
    if (!resolvedMediaItems.length) return;
    setLightboxIndex(resolvedMediaIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  let bubbleContent: ReactNode;
  if (isDeleted) {
    bubbleContent = (
      <span className="italic" style={{ color: "var(--color-text-muted)" }}>
        Mensagem apagada
      </span>
    );
  } else if (mediaUrl && messageType === "IMAGE") {
    bubbleContent = (
      <div
        className="overflow-hidden rounded-xl p-2 shadow-inner"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 40%, transparent)" }}
      >
        {m.is_media_sensitive && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-2">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Conteúdo sensível
          </div>
        )}
        <img
          src={mediaUrl}
          alt={caption || "Imagem"}
          className="max-h-72 w-full rounded-xl object-contain cursor-pointer"
          onClick={openLightbox}
        />
        {caption && <p className="mt-2 text-xs opacity-90 whitespace-pre-wrap wrap-break-word">{caption}</p>}
      </div>
    );
  } else if (mediaUrl && messageType === "VIDEO") {
    bubbleContent = (
      <div
        className="relative overflow-hidden rounded-xl p-2 shadow-inner"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-surface) 90%, transparent)" }}
      >
        {m.is_media_sensitive && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-2">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Conteúdo sensível
          </div>
        )}
        <video
          src={mediaUrl}
          className="max-h-72 w-full rounded-xl object-contain"
          muted
          playsInline
          controls
        />
        {caption && <p className="mt-2 text-xs opacity-90">{caption}</p>}
      </div>
    );
  } else if (mediaUrl && messageType === "AUDIO") {
    bubbleContent = (
      <AudioPlayerWhatsApp src={mediaUrl} caption={caption || textBody || null} />
    );
  } else if (mediaUrl && messageType === "STICKER") {
    bubbleContent = (
      <div className="overflow-hidden rounded-xl p-1">
        <img
          src={mediaUrl}
          alt="Sticker"
          className="h-32 w-32 object-contain cursor-pointer"
          style={{ imageRendering: 'crisp-edges' }}
          onClick={openLightbox}
        />
      </div>
    );
  } else if (messageType === "LOCATION") {
    // Tentar extrair coordenadas do body (JSON)
    let locationData: { latitude?: number; longitude?: number; name?: string; address?: string } | null = null;
    try {
      if (textBody) {
        locationData = JSON.parse(textBody);
      }
    } catch {
      // Ignore parse errors for location
    }
    
    bubbleContent = (
      <div
        className="flex flex-col gap-2 rounded-xl p-3 shadow-inner"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 40%, transparent)" }}
      >
        <div className="flex items-center gap-2">
          <FiMapPin className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium">Localização</span>
        </div>
        {locationData?.name && (
          <div className="text-sm font-semibold">{locationData.name}</div>
        )}
        {locationData?.address && (
          <div className="text-xs opacity-80">{locationData.address}</div>
        )}
        {locationData?.latitude && locationData?.longitude && (
          <a 
            href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            Ver no Google Maps
          </a>
        )}
      </div>
    );
  } else if (mediaUrl && (messageType === "DOCUMENT" || messageType === "FILE")) {
    bubbleContent = (
      <div
        className="flex flex-col gap-2 rounded-xl px-4 py-3 shadow-inner"
        style={{ background: "color-mix(in srgb, var(--color-surface) 45%, var(--color-bg))" }}
      >
        {m.is_media_sensitive && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-1">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Conteúdo sensível
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-lg font-semibold">📄</span>
          <span className="truncate max-w-[200px]">{displayFilename}</span>
          {m.media_size && (
            <span className="text-[10px] opacity-60">
              ({(m.media_size / 1024 / 1024).toFixed(2)} MB)
            </span>
          )}
        </div>
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-90 hover:opacity-100">
          Baixar documento
        </a>
        {caption && (
          <p className="mt-1 text-xs opacity-80">{caption}</p>
        )}
      </div>
    );
  } else if (messageType === "TEMPLATE") {
    const template = m.interactive_content; // We store template data here too
    bubbleContent = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
          <FiLayers className="w-3.5 h-3.5" /> Template
        </div>
        
        {/* Render Media if present (handled by worker-media) */}
        {mediaUrl && (
           <div className="mb-2">
             {m.media_mime?.startsWith("image") || mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
               <img src={mediaUrl} alt="Template Media" className="rounded-lg max-h-48 object-cover w-full cursor-pointer" onClick={openLightbox} />
             ) : m.media_mime?.startsWith("video") || mediaUrl.match(/\.(mp4|mov)$/i) ? (
               <video src={mediaUrl} controls className="rounded-lg max-h-48 w-full" />
             ) : (
               <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-90">Ver mídia anexa</a>
             )}
           </div>
        )}

        {template?.name ? (
           <div className="text-sm">
             <span className="opacity-70">Nome:</span> <span className="font-medium">{template.name}</span>
             {template.language?.code && <span className="ml-2 opacity-60 text-xs">({template.language.code})</span>}
           </div>
        ) : (
           <div>{textBody || "[Template]"}</div>
        )}

        {/* Render Buttons if present in template components */}
        {template?.components && Array.isArray(template.components) && (
          <div className="flex flex-col gap-2 mt-2 border-t border-white/10 pt-2">
            {template.components
              .filter((c: Record<string, unknown>) => c.type === "BUTTONS" || c.type === "buttons")
              .flatMap((c: Record<string, unknown>) => (c.buttons as Array<Record<string, unknown>>) || [])
              .map((btn: Record<string, unknown>, idx: number) => (
                <div key={idx} className="w-full py-2 px-3 bg-white/10 rounded text-sm font-medium text-center opacity-90">
                  {(btn.text as string) || (btn.reply as any)?.title || "Botão"}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  } else if (messageType === "BUTTON" || messageType === "BUTTONS") {
    const button = m.interactive_content;
    bubbleContent = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
          <FiCheck className="w-3.5 h-3.5" /> Botão
        </div>
        <div className="font-medium">{button?.text || textBody || "[Botão]"}</div>
        {button?.payload && <div className="text-[10px] opacity-50 font-mono">{button.payload}</div>}
      </div>
    );
  } else if (messageType === "ORDER") {
    const order = m.interactive_content;
    bubbleContent = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs text-green-400 mb-1">
          <FiCheck className="w-3.5 h-3.5" /> Pedido
        </div>
        <div className="font-medium">Pedido do Catálogo</div>
        {order?.catalog_id && <div className="text-xs opacity-70">Catálogo: {order.catalog_id}</div>}
        {order?.product_items && (
           <div className="text-xs opacity-80">{order.product_items.length} itens</div>
        )}
      </div>
    );
  } else if (messageType === "POLL") {
    const poll = m.interactive_content;
    bubbleContent = (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
          <FiCheck className="w-3.5 h-3.5" /> Enquete
        </div>
        <div className="font-medium">{poll?.name || textBody || "Enquete"}</div>
        {poll?.options && Array.isArray(poll.options) && (
          <div className="flex flex-col gap-1 mt-1">
            {poll.options.map((opt: Record<string, unknown>, idx: number) => (
              <div key={idx} className="py-1.5 px-3 bg-white/10 rounded text-sm border border-white/5">
                {(opt.option_name as string) || (opt.text as string) || `Opção ${idx + 1}`}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  } else if (messageType === "TEMPLATE") {
    bubbleContent = (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-(--color-primary) opacity-90 uppercase border-b border-white/10 pb-1 mb-1">
          <FiFileText className="w-3.5 h-3.5" />
          WhatsApp Template
        </div>
        <div className="italic opacity-90">{textBody}</div>
        {m.metadata?.template_name && (
          <div className="text-[10px] opacity-50 mt-1">Nome: {m.metadata.template_name}</div>
        )}
      </div>
    );
  } else if (messageType === "INTERACTIVE") {
    let interactive = m.interactive_content;
    if (typeof interactive === "string") {
      try {
        interactive = JSON.parse(interactive);
      } catch (e) {
        console.error("[MessageBubble] Failed to parse interactive_content:", e);
      }
    }

    if (!interactive) {
      bubbleContent = (
        <div className="flex flex-col gap-1">
           <div className="text-xs opacity-70 italic">[Interativo]</div>
           <div>{textBody || "[Conteúdo interativo]"}</div>
        </div>
      );
    } else {
      const type = interactive.type;
      const header = interactive.header;
      const body = interactive.body;
      const footer = interactive.footer;
      const action = interactive.action;

      bubbleContent = (
        <div className="flex flex-col gap-2 min-w-[200px]">
          {header?.type === "text" && <div className="font-bold text-sm">{header.text}</div>}
          
          {body?.text && <div className="whitespace-pre-wrap wrap-break-word">{body.text}</div>}
          
          {footer?.text && <div className="text-xs opacity-70 border-t border-white/10 pt-1 mt-1">{footer.text}</div>}

          {(type === "button" || type === "buttons") && (action as Record<string, unknown>)?.buttons && (
             <div className="flex flex-col gap-2 mt-2">
               {((action as Record<string, unknown>).buttons as Array<Record<string, unknown>>).map((btn: Record<string, unknown>, idx: number) => (
                 <div 
                   key={idx} 
                   className="w-full py-2 px-3 bg-white/10 rounded text-sm font-medium text-center opacity-90"
                 >
                   {(btn.reply as any)?.title || (btn.text as string) || (btn.type as string)}
                 </div>
               ))}
             </div>
          )}

          {type === "list" && (action as Record<string, unknown>)?.sections && (
             <div className="flex flex-col gap-2 mt-2">
               <div className="w-full py-2 px-3 bg-white/10 rounded text-sm font-medium text-center opacity-80">
                 {(action as Record<string, unknown>).button as string || "Ver opções"}
               </div>
               {((action as Record<string, unknown>).sections as Array<Record<string, unknown>>).map((section: Record<string, unknown>, sIdx: number) => (
                 <div key={sIdx} className="flex flex-col gap-1">
                   {!!section.title && <div className="text-xs font-bold opacity-70 mt-1 uppercase tracking-wider">{String(section.title)}</div>}
                   {(section.rows as Array<Record<string, unknown>>)?.map((row: Record<string, unknown>, rIdx: number) => (
                     <div key={rIdx} className="py-1.5 px-2 border-l-2 border-white/20 pl-2 text-sm hover:bg-white/5 rounded-r">
                       <div className="font-medium">{String(row.title)}</div>
                       {!!row.description && <div className="text-xs opacity-70">{String(row.description)}</div>}
                     </div>
                   ))}
                 </div>
               ))}
             </div>
          )}

          {type === "button_reply" && (
            <div className="flex items-center gap-2 py-1 px-2 bg-white/10 rounded border-l-4 border-white/30">
              <FiCheck className="w-4 h-4 opacity-70" />
              <span className="font-medium">{interactive.button_reply?.title || "Opção selecionada"}</span>
            </div>
          )}

          {type === "list_reply" && (
            <div className="flex flex-col gap-1 py-1 px-2 bg-white/10 rounded border-l-4 border-white/30">
              <div className="flex items-center gap-2">
                <FiCheck className="w-4 h-4 opacity-70" />
                <span className="font-medium">{interactive.list_reply?.title || "Opção selecionada"}</span>
              </div>
              {interactive.list_reply?.description && (
                <div className="text-xs opacity-70 ml-6">{interactive.list_reply.description}</div>
              )}
            </div>
          )}

          {type === "flow" && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="w-full py-2 px-3 bg-white/10 rounded text-sm font-medium text-center border border-white/20">
                <FiLayers className="inline mr-2" />
                {(action as Record<string, any>)?.parameters?.flow_cta || "Abrir Formulário"}
              </div>
              <div className="text-[10px] opacity-50 text-center">Flow ID: {interactive.flow_id || (action as any)?.parameters?.flow_id}</div>
            </div>
          )}

          {type === "nfm_reply" && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="text-xs font-bold border-b border-white/10 pb-1">
                RESPOSTA DO FORMULÁRIO:
              </div>
              <div className="text-xs opacity-90 font-mono bg-black/20 p-2 rounded max-h-40 overflow-auto">
                {(() => {
                  try {
                    const resp = interactive.nfm_reply?.response_json;
                    const data = typeof resp === "string" ? JSON.parse(resp) : resp;
                    return <pre>{JSON.stringify(data || {}, null, 2)}</pre>;
                  } catch (e) {
                    return <span>{String(interactive.nfm_reply?.response_json)}</span>;
                  }
                })()}
              </div>
            </div>
          )}
        </div>
      );
    }
  } else {
    bubbleContent = textBody || (messageType ? `[${messageType}]` : "");
  }

  const renderStatusIcon = () => {
    if (!isAgent) return null;
    const iconStyle = { color: "var(--color-on-primary)", opacity: 0.8 };
    const readStyle = { color: "#34b7f1" }; // Blue for READ

    switch (deliveryStatus) {
      case "sending":
      case "pending":
        return <FiClock className="w-3.5 h-3.5" style={iconStyle} />;
      case "sent":
        return <FiCheck className="w-3.5 h-3.5" style={iconStyle} />;
      case "delivered":
        return <BiCheckDouble className="h-4 w-4" style={iconStyle} />;
      case "read":
        return <BiCheckDouble className="h-4 w-4" style={readStyle} />;
      case "error":
        return <FiAlertTriangle className="w-3.5 h-3.5 text-red-100" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className={wrap}>
        <div className={`${bubbleBase} ${bubbleSideClass}`} style={bubbleStyle}>
          {showRemoteSender && (
            <div className="mb-1 flex items-center gap-2">
              {remoteAvatarUrl ? (
                <img
                  src={remoteAvatarUrl}
                  alt={resolvedRemoteName}
                  className="h-6 w-6 rounded-full object-cover"
                  onError={(event) => {
                    (event.currentTarget as HTMLImageElement).src = "";
                  }}
                />
              ) : (
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-bg) 60%, transparent)", color: "var(--color-text-muted)" }}
                >
                  {remoteInitials}
                </div>
              )}
              <span className="text-xs font-semibold truncate" style={{ color: "var(--color-heading)" }}>
                {resolvedRemoteName}
              </span>
            </div>
          )}
          {isPrivate && (
            <div className="mb-1 flex items-center gap-1 text-[11px]" style={{ color: "var(--color-highlight)" }}>
              <FiLock className="w-3.5 h-3.5" />
              <span className="opacity-90">Privado</span>
              {m.sender_name && (
                <span className="max-w-48 truncate font-medium" style={{ color: "var(--color-highlight)" }}>
                  - {m.sender_name}
                </span>
              )}
            </div>
          )}
          {!isPrivate && isAgent && (
            <div className="mb-1 flex items-center gap-2">
              {m.sender_id ? (
                m.sender_avatar_url ? (
                  <img
                    src={m.sender_avatar_url}
                    alt={m.sender_name || "Agente"}
                    className="h-5 w-5 rounded-full object-cover"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--color-border) 60%, transparent)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {(m.sender_name || "A").slice(0, 1).toUpperCase()}
                  </div>
                )
              ) : (
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                    color: "var(--color-primary)",
                  }}
                >
                  <FiCpu className="h-3.5 w-3.5" />
                </div>
              )}
              {m.sender_name ? (
                <span
                  className="text-[10px] font-semibold opacity-80 truncate"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {m.sender_name}
                </span>
              ) : null}
            </div>
          )}
          {quotedMessage && (
            <div
              className="mb-2 border-l-4 px-3 py-2 rounded-r-lg"
              style={{
                borderColor: "var(--color-primary)",
                backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)",
              }}
            >
              <div
                className="text-[10px] font-semibold mb-1"
                style={{ color: "var(--color-primary)" }}
              >
                {quotedMessage.sender_name || 
                 (quotedMessage.sender_type === "CUSTOMER" ? (customerName || "Cliente") : "Agente")}
              </div>
              <div
                className="text-[11px] line-clamp-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                {quotedMessage.type === "IMAGE" && "📷 Imagem"}
                {quotedMessage.type === "VIDEO" && "🎥 Vídeo"}
                {quotedMessage.type === "AUDIO" && "🎤 Áudio"}
                {quotedMessage.type === "DOCUMENT" && "📄 Documento"}
                {quotedMessage.type === "FILE" && "📎 Arquivo"}
                {(!quotedMessage.type || quotedMessage.type === "TEXT") && (quotedMessage.body || quotedMessage.content || "")}
              </div>
            </div>
          )}
          {!isEditing ? (
            <div>{bubbleContent}</div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "color-mix(in srgb, var(--color-bg) 70%, transparent)",
                  color: "var(--color-text)",
                  "--tw-ring-color": "color-mix(in srgb, var(--color-primary) 45%, transparent)",
                } as CSSProperties}
                rows={2}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div
                className="flex items-center gap-3 text-[11px]"
                style={{ color: "var(--color-text)" }}
              >
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={useLinkPreview} onChange={(e) => setUseLinkPreview(e.target.checked)} />
                  <span>Link preview</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={useLinkPreviewHQ}
                    onChange={(e) => setUseLinkPreviewHQ(e.target.checked)}
                    disabled={!useLinkPreview}
                  />
                  <span>Alta qualidade</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[12px] border transition-colors"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
                    color: "var(--color-primary)",
                    borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
                  }}
                  onClick={() => {
                    if (onEdit) onEdit(m, { text: editText, linkPreview: useLinkPreview, linkPreviewHighQuality: useLinkPreviewHQ });
                    setIsEditing(false);
                  }}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[12px] border transition-colors"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-surface-muted) 60%, transparent)",
                    color: "var(--color-text)",
                    borderColor: "var(--color-border)",
                  }}
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(m.body || m.content || "");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {/* Left side empty to align */}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: isAgent ? "var(--color-on-primary)" : "var(--color-text-muted)", opacity: isAgent ? 0.8 : 1 }}>
                {time}
              </span>
              {renderStatusIcon()}
              {(onReply || (isAgent && (onEdit || onDelete))) && (
                <div className="relative z-50" onMouseLeave={handleMenuMouseLeave}>
                  <button
                    type="button"
                    className="p-1 rounded transition-colors"
                    style={{ color: isAgent ? "var(--color-on-primary)" : "var(--color-text-muted)", opacity: isAgent ? 0.8 : 1 }}
                    onClick={() => setShowMenu((v) => !v)}
                    title="Ações"
                  >
                    <FiMoreVertical className="h-4 w-4" />
                  </button>
                  {showMenu && (
                    <div
                      className={`absolute bottom-full ${isAgent ? "right-0" : "left-0"} z-50 w-40 rounded-md border shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden`}
                      style={{
                        borderColor: "var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                      }}
                      onMouseEnter={() => setShowMenu(true)}
                    >
                      {onReply && (
                        <button
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] transition-colors"
                          style={{ color: "var(--color-text)" }}
                          onClick={() => {
                            setShowMenu(false);
                            onReply();
                          }}
                        >
                          <FiCornerUpLeft className="h-3.5 w-3.5" /> Responder
                        </button>
                      )}
                      {isAgent && onEdit && !isPrivate && (
                        <button
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] transition-colors"
                          style={{ color: "var(--color-text)" }}
                          onClick={() => {
                            setShowMenu(false);
                            setIsEditing(true);
                          }}
                        >
                          <FiEdit2 className="h-3.5 w-3.5" /> Editar
                        </button>
                      )}
                      {isAgent && onDelete && !isPrivate && (
                        <button
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] text-red-300 hover:bg-red-900/30"
                          onClick={() => {
                            setShowMenu(false);
                            onDelete(m);
                          }}
                        >
                          <FiTrash2 className="h-3.5 w-3.5" /> Apagar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Upload progress indicator for optimistic media/audio sends */}
          {isAgent && (deliveryStatus === "sending" || deliveryStatus === "pending") && typeof m.upload_progress === "number" && (
            <div className="mt-2">
              <div
                className="h-1.5 w-full rounded overflow-hidden"
                style={{ backgroundColor: "color-mix(in srgb, var(--color-border) 40%, transparent)" }}
              >
                <div
                  className="h-1.5 transition-[width] duration-100"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
                    width: `${Math.max(0, Math.min(100, Math.round(m.upload_progress || 0)))}%`,
                  }}
                />
              </div>
              <div className="mt-1 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                Enviando {Math.max(0, Math.min(100, Math.round(m.upload_progress || 0)))}%
              </div>
            </div>
          )}
          {isAgent && deliveryStatus === "error" && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-red-400">
              <span>{m.error_reason || "Falha ao enviar mensagem."}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(m)}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/50 px-2 py-0.5 text-[10px] font-medium text-red-200 hover:bg-red-500/10 transition"
                >
                  <FiRotateCcw className="h-3.5 w-3.5" />
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {resolvedMediaItems.length > 0 && (
        <Lightbox
          isOpen={lightboxOpen}
          onClose={closeLightbox}
          items={resolvedMediaItems}
          index={lightboxIndex}
        />
      )}
    </>
  );
}


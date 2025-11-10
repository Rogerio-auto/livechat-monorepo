import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FiClock, FiCheck, FiLock, FiAlertTriangle, FiRotateCcw, FiCpu, FiMoreVertical, FiEdit2, FiTrash2, FiCornerUpLeft, FiLayers, FiMapPin } from "react-icons/fi";
import { BiCheckDouble } from "react-icons/bi";
import Lightbox from "../../components/ui/Lightbox";
import AudioPlayerWhatsApp from "../../components/livechat/AudioPlayerWhatsApp";
import type { Message } from "./types";

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
    "relative inline-block w-auto max-w-[85%] sm:max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-2xl shadow-md leading-snug whitespace-pre-wrap break-words text-[13px] transition-colors duration-200 backdrop-blur-[2px]";
  const isPrivate = !!m.is_private || m.type === "PRIVATE";
  const agentBubble =
    "rounded-br-none bg-[color:color-mix(in srgb,var(--color-primary) 52%,var(--color-bg))] text-(--color-on-primary)";
  const customerBubble =
    "rounded-bl-none bg-[color:color-mix(in srgb,var(--color-surface) 45%,var(--color-bg))] text-(--color-text)";
  const privateBubble =
    "bg-[color:color-mix(in srgb,var(--color-highlight) 40%,var(--color-bg))] text-(--color-heading)";
  const bubbleSide = isPrivate
    ? privateBubble
    : isAgent
      ? agentBubble
      : customerBubble;
  const messageType = (m.type || "TEXT").toUpperCase();
  
  // Fallback para URLs de mídia
  const mediaUrl = m.media_public_url || m.media_url || null;
  const textBody = m.body ?? m.content ?? "";
  const caption = m.caption ?? null;
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
        caption: textBody || null,
      },
    ];
  }, [mediaUrl, messageType, m.id, textBody]);

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
      <span className="italic text-(--color-text-muted)">Mensagem apagada</span>
    );
  } else if (mediaUrl && messageType === "IMAGE") {
    bubbleContent = (
      <div className="overflow-hidden rounded-2xl bg-(--color-surface-muted)/40 p-2 shadow-inner">
        {m.is_media_sensitive && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-2">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Conteúdo sensível
          </div>
        )}
        <img
          src={mediaUrl}
          alt={caption || textBody || "Imagem"}
          className="max-h-72 w-full rounded-xl object-contain cursor-pointer"
          onClick={openLightbox}
        />
        {caption && (
          <p className="mt-2 text-xs opacity-90">{caption}</p>
        )}
      </div>
    );
  } else if (mediaUrl && messageType === "VIDEO") {
    bubbleContent = (
      <div className="relative overflow-hidden rounded-2xl bg-(--color-surface)/90 p-2 shadow-inner">
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
        {caption && (
          <p className="mt-2 text-xs opacity-90">{caption}</p>
        )}
      </div>
    );
  } else if (mediaUrl && messageType === "AUDIO") {
    bubbleContent = (
      <AudioPlayerWhatsApp src={mediaUrl} caption={caption || textBody || null} />
    );
  } else if (mediaUrl && messageType === "STICKER") {
    bubbleContent = (
      <div className="overflow-hidden rounded-2xl p-1">
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
    } catch {}
    
    bubbleContent = (
      <div className="flex flex-col gap-2 rounded-2xl bg-(--color-surface-muted)/40 p-3 shadow-inner">
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
      <div className="flex flex-col gap-2 rounded-2xl bg-[color:color-mix(in srgb,var(--color-surface) 45%,var(--color-bg))] px-4 py-3 shadow-inner">
        {m.is_media_sensitive && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 mb-1">
            <FiAlertTriangle className="w-3.5 h-3.5" /> Conteúdo sensível
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-lg font-semibold">📄</span>
          <span>Documento</span>
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
    bubbleContent = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
          <FiLayers className="w-3.5 h-3.5" /> Template
        </div>
        <div>{textBody || "[Template]"}</div>
      </div>
    );
  } else {
    bubbleContent = textBody || (messageType ? `[${messageType}]` : "");
  }

  const renderStatusIcon = () => {
    if (!isAgent) return null;
    switch (deliveryStatus) {
      case "sending":
      case "pending":
  return <FiClock className="w-3.5 h-3.5 text-(--color-text-muted)" />;
      case "sent":
  return <FiCheck className="w-3.5 h-3.5 text-(--color-text-muted)" />;
      case "delivered":
  return <BiCheckDouble className="h-4 w-4 text-(--color-text-muted)" />;
      case "read":
  return <BiCheckDouble className="h-4 w-4 text-(--color-primary)" />;
      case "error":
        return <FiAlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className={wrap}>
        <div className={`${bubbleBase} ${bubbleSide}`}>
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
                <div className="h-6 w-6 rounded-full bg-(--color-bg)/60 flex items-center justify-center text-[10px] font-semibold text-(--color-text-muted)">
                  {remoteInitials}
                </div>
              )}
              <span className="text-xs font-semibold text-(--color-heading) truncate">
                {resolvedRemoteName}
              </span>
            </div>
          )}
          {isPrivate && (
            <div className="mb-1 flex items-center gap-1 text-[11px] text-(--color-highlight)">
              <FiLock className="w-3.5 h-3.5" />
              <span className="opacity-90">Privado</span>
              {m.sender_name && (
                <span className="max-w-48 truncate font-medium text-(--color-highlight)">- {m.sender_name}</span>
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
                  <div className="h-5 w-5 rounded-full bg-(--color-border)/60 flex items-center justify-center text-[9px] font-semibold text-(--color-text-muted)">
                    {(m.sender_name || "A").slice(0, 1).toUpperCase()}
                  </div>
                )
              ) : (
                <div className="h-5 w-5 rounded-full bg-(--color-primary)/15 text-(--color-primary) flex items-center justify-center">
                  <FiCpu className="h-3.5 w-3.5" />
                </div>
              )}
              {m.sender_name ? (
                <span className="text-[10px] font-semibold text-(--color-text-muted) opacity-80 truncate">
                  {m.sender_name}
                </span>
              ) : null}
            </div>
          )}
          {quotedMessage && (
            <div className="mb-2 border-l-4 border-(--color-primary) bg-(--color-surface-muted)/60 px-3 py-2 rounded-r-lg">
              <div className="text-[10px] font-semibold text-(--color-primary) mb-1">
                {quotedMessage.sender_name || 
                 (quotedMessage.sender_type === "CUSTOMER" ? (customerName || "Cliente") : "Agente")}
              </div>
              <div className="text-[11px] text-(--color-text-muted) line-clamp-2">
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
                className="w-full rounded-md border border-(--color-border) bg-(--color-bg)/70 px-2 py-1 text-sm text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/45"
                rows={2}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="flex items-center gap-3 text-[11px] text-(--color-text)">
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
                  className="rounded px-2 py-1 text-[12px] bg-(--color-primary)/20 text-(--color-primary) border border-(--color-primary)/40 hover:bg-(--color-primary)/30"
                  onClick={() => {
                    if (onEdit) onEdit(m, { text: editText, linkPreview: useLinkPreview, linkPreviewHighQuality: useLinkPreviewHQ });
                    setIsEditing(false);
                  }}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[12px] bg-(--color-surface-muted)/60 text-(--color-text) border border-(--color-border) hover:bg-(--color-surface-muted)/80"
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
              <span className="text-[10px] text-(--color-text-muted)">{time}</span>
              {renderStatusIcon()}
              {(onReply || (isAgent && (onEdit || onDelete))) && (
                <div className="relative z-50">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-(--color-surface-muted)/60"
                    onClick={() => setShowMenu((v) => !v)}
                    title="Ações"
                  >
                    <FiMoreVertical className="h-4 w-4 text-(--color-text-muted)" />
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 bottom-full z-50 mb-1 w-40 rounded-md border border-(--color-border) bg-(--color-surface) shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
                      {onReply && (
                        <button
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] text-(--color-text) hover:bg-(--color-surface-muted)/60"
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
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-[12px] text-(--color-text) hover:bg-(--color-surface-muted)/60"
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
              <div className="h-1.5 w-full rounded bg-(--color-border)/40 overflow-hidden">
                <div
                  className="h-1.5 bg-(--color-primary)/70 transition-[width] duration-100"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round(m.upload_progress || 0)))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-(--color-text-muted)">
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

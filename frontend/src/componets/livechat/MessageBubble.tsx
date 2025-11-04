import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FiClock, FiCheck, FiLock, FiAlertTriangle, FiRotateCcw, FiCpu } from "react-icons/fi";
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
};

export function MessageBubble({
  m,
  isAgent,
  mediaItems,
  mediaIndex,
  showRemoteSenderInfo = false,
  onRetry,
  onReply,
}: MessageBubbleProps) {
  const deliveryStatusSource =
    typeof m.delivery_status === "string" && m.delivery_status
      ? m.delivery_status
      : typeof m.view_status === "string" && m.view_status
        ? m.view_status
        : "";
  const deliveryStatus = deliveryStatusSource.toLowerCase();
  const time = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const wrap = isAgent ? "w-full flex justify-end" : "w-full flex justify-start";
  const bubbleBase =
    "relative inline-block w-auto max-w-[85%] sm:max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-2xl shadow-md leading-snug whitespace-pre-wrap break-words text-[13px] transition-colors duration-200 backdrop-blur-[2px]";
  const isPrivate = !!m.is_private || m.type === "PRIVATE";
  const agentBubble =
    "rounded-br-none bg-[color:color-mix(in srgb,var(--color-primary) 45%,var(--color-background))] text-[var(--color-heading)]";
  const customerBubble =
    "rounded-bl-none bg-[color:color-mix(in srgb,var(--color-surface) 35%,var(--color-background))] text-[var(--color-text)]";
  const privateBubble =
    "bg-[color:color-mix(in srgb,var(--color-highlight) 40%,var(--color-background))] text-[var(--color-heading)]";
  const bubbleSide = isPrivate
    ? privateBubble
    : isAgent
      ? agentBubble
      : customerBubble;
  const messageType = (m.type || "TEXT").toUpperCase();
  const mediaUrl = m.media_url ?? null;
  const textBody = m.body ?? m.content ?? "";
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
  if (mediaUrl && messageType === "IMAGE") {
    bubbleContent = (
      <div className="overflow-hidden rounded-2xl bg-black/20 p-2 shadow-inner">
        <img
          src={mediaUrl}
          alt={textBody || "Imagem"}
          className="max-h-72 w-full rounded-xl object-contain"
        />
        {textBody ? (
          <p className="mt-1 text-xs text-[var(--color-text)] opacity-80">{textBody}</p>
        ) : null}
      </div>
    );
  } else if (mediaUrl && messageType === "VIDEO") {
    bubbleContent = (
      <div className="relative overflow-hidden rounded-2xl bg-black/80 p-2 shadow-inner">
        <video
          src={mediaUrl}
          className="max-h-72 w-full rounded-xl object-contain"
          muted
          playsInline
          controls
        />
        {textBody ? (
          <p className="mt-1 text-xs text-[var(--color-text)] opacity-80">{textBody}</p>
        ) : null}
      </div>
    );
  } else if (mediaUrl && messageType === "AUDIO") {
    bubbleContent = (
      <AudioPlayerWhatsApp src={mediaUrl} caption={textBody || null} />
    );
  } else if (mediaUrl && (messageType === "DOCUMENT" || messageType === "FILE")) {
    bubbleContent = (
      <div className="flex flex-col gap-2 rounded-2xl bg-[color:color-mix(in srgb,var(--color-surface) 45%,var(--color-background))] px-4 py-3 shadow-inner">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
          <span className="text-lg font-semibold">DOC</span>
          <span>Documento</span>
        </div>
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-text-muted)] underline">
          Baixar documento
        </a>
        {textBody ? (
          <p className="mt-1 text-xs text-[var(--color-text)] opacity-80">{textBody}</p>
        ) : null}
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
        return <FiClock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />;
      case "sent":
        return <FiCheck className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />;
      case "delivered":
        return <BiCheckDouble className="h-4 w-4 text-[var(--color-text-muted)]" />;
      case "read":
        return <BiCheckDouble className="h-4 w-4 text-[var(--color-primary)]" />;
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
                <div className="h-6 w-6 rounded-full bg-[color:var(--color-bg)]/60 flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-muted)]">
                  {remoteInitials}
                </div>
              )}
              <span className="text-xs font-semibold text-[var(--color-heading)] truncate">
                {resolvedRemoteName}
              </span>
            </div>
          )}
          {isPrivate && (
            <div className="mb-1 flex items-center gap-1 text-[11px] text-[var(--color-highlight)]">
              <FiLock className="w-3.5 h-3.5" />
              <span className="opacity-90">Privado</span>
              {m.sender_name && (
                <span className="max-w-[12rem] truncate font-medium text-[var(--color-highlight)]">- {m.sender_name}</span>
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
                  <div className="h-5 w-5 rounded-full bg-[color:var(--color-border)]/60 flex items-center justify-center text-[9px] font-semibold text-[var(--color-text-muted)]">
                    {(m.sender_name || "A").slice(0, 1).toUpperCase()}
                  </div>
                )
              ) : (
                <div className="h-5 w-5 rounded-full bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)] flex items-center justify-center">
                  <FiCpu className="h-3.5 w-3.5" />
                </div>
              )}
              {m.sender_name ? (
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] opacity-80 truncate">
                  {m.sender_name}
                </span>
              ) : null}
            </div>
          )}
          <div className="text-[var(--color-text)]">{bubbleContent}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {onReply && (
                <button
                  type="button"
                  onClick={onReply}
                  className="text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition opacity-70 hover:opacity-100"
                  title="Responder"
                >
                  Responder
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">{time}</span>
              {renderStatusIcon()}
            </div>
          </div>
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

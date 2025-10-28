import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type LightboxItem = {
  id: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  url: string;
  caption?: string | null;
};

type LightboxProps = {
  isOpen: boolean;
  onClose: () => void;
  items: LightboxItem[];
  index: number;
};

function useKey(
  active: boolean,
  key: string,
  handler: (event: KeyboardEvent) => void,
) {
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === key) {
        handler(event);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active, key, handler]);
}

export function Lightbox({ isOpen, onClose, items, index }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(index);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex((prev) => {
        if (prev === index) return prev;
        return Math.min(Math.max(index, 0), items.length - 1);
      });
      setIframeError(false);
    }
  }, [isOpen, index, items.length]);

  useEffect(() => {
    if (!isOpen) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen, currentIndex]);

  const handleClose = useCallback(() => {
    onClose();
    setIframeError(false);
  }, [onClose]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (items.length === 0) return prev;
      return (prev + 1) % items.length;
    });
    setIframeError(false);
  }, [items.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => {
      if (items.length === 0) return prev;
      return (prev - 1 + items.length) % items.length;
    });
    setIframeError(false);
  }, [items.length]);

  useKey(isOpen, "Escape", () => handleClose());
  useKey(isOpen, "ArrowRight", () => goToNext());
  useKey(isOpen, "ArrowLeft", () => goToPrev());

  const activeItem = useMemo(() => {
    if (!items.length) return null;
    const safeIndex = Math.min(Math.max(currentIndex, 0), items.length - 1);
    return items[safeIndex];
  }, [currentIndex, items]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90"
      onClick={handleClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Fechar"
        className="absolute top-4 right-4 text-3xl text-white/80 hover:text-white transition"
        onClick={(event) => {
          event.stopPropagation();
          handleClose();
        }}
      >
        ×
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            className="absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/20 text-white text-3xl flex items-center justify-center hover:bg-white/30 transition"
            onClick={(event) => {
              event.stopPropagation();
              goToPrev();
            }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo"
            className="absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/20 text-white text-3xl flex items-center justify-center hover:bg-white/30 transition"
            onClick={(event) => {
              event.stopPropagation();
              goToNext();
            }}
          >
            ›
          </button>
        </>
      )}

      <div
        className="flex max-h-[92vh] max-w-[92vw] flex-col items-center justify-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {activeItem ? (
          <>
            <div className="flex items-center justify-center">
              {activeItem.type === "IMAGE" && (
                <img
                  src={activeItem.url}
                  alt={activeItem.caption ?? "Imagem"}
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
                />
              )}
              {activeItem.type === "VIDEO" && (
                <video
                  src={activeItem.url}
                  controls
                  className="max-h-[90vh] max-w-[90vw] rounded-xl bg-black"
                />
              )}
              {activeItem.type === "DOCUMENT" && !iframeError && (
                <iframe
                  src={activeItem.url}
                  title={activeItem.caption ?? "Documento"}
                  className="h-[90vh] w-[90vw] rounded-xl bg-white"
                  onError={() => setIframeError(true)}
                />
              )}
              {activeItem.type === "DOCUMENT" && iframeError && (
                <div className="flex flex-col items-center gap-3 rounded-xl bg-white/10 p-6 text-center text-white">
                  <p className="text-sm opacity-80">
                    Não foi possível exibir o documento embutido.
                  </p>
                  <a
                    href={activeItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/80 transition"
                  >
                    Abrir/baixar documento
                  </a>
                </div>
              )}
            </div>

            {activeItem.caption && (
              <p className="max-w-[85vw] text-center text-sm text-white/80">
                {activeItem.caption}
              </p>
            )}
            {items.length > 1 && (
              <p className="text-xs text-white/60">
                {currentIndex + 1} / {items.length}
              </p>
            )}
          </>
        ) : (
          <p className="text-white/70">Nenhum conteúdo</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Lightbox;

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
  className="fixed inset-0 z-1000 flex items-center justify-center bg-(--color-overlay)"
      onClick={handleClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        aria-label="Fechar"
        className="absolute top-4 right-4 text-3xl text-[color-mix(in_srgb,var(--color-text)_86%,transparent)] hover:text-(--color-text) transition"
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
            className="absolute left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--color-text)_12%,transparent)] text-(--color-text) text-3xl flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-text)_18%,transparent)] transition"
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
            className="absolute right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--color-text)_12%,transparent)] text-(--color-text) text-3xl flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-text)_18%,transparent)] transition"
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
                  className="max-h-[90vh] max-w-[90vw] rounded-xl bg-(--color-surface)"
                />
              )}
              {activeItem.type === "DOCUMENT" && !iframeError && (
                <iframe
                  src={activeItem.url}
                  title={activeItem.caption ?? "Documento"}
                  className="h-[90vh] w-[90vw] rounded-xl bg-(--color-surface)"
                  onError={() => setIframeError(true)}
                />
              )}
              {activeItem.type === "DOCUMENT" && iframeError && (
                <div className="flex flex-col items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-text)_10%,transparent)] p-6 text-center text-(--color-text)">
                  <p className="text-sm text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
                    Não foi possível exibir o documento embutido.
                  </p>
                  <a
                    href={activeItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-[color-mix(in_srgb,var(--color-text)_8%,var(--color-surface))] transition"
                  >
                    Abrir/baixar documento
                  </a>
                </div>
              )}
            </div>

            {activeItem.caption && (
              <p className="max-w-[85vw] text-center text-sm text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
                {activeItem.caption}
              </p>
            )}
            {items.length > 1 && (
              <p className="text-xs text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                {currentIndex + 1} / {items.length}
              </p>
            )}
          </>
        ) : (
          <p className="text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">Nenhum conteúdo</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default Lightbox;

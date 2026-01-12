import React from "react";
import { API, fetchJson } from "../../../utils/api";

type SessionInfo = {
  status?: string | null;
  phone?: string | null;
  number?: string | null;
  connectedPhone?: string | null;
  [key: string]: unknown;
};

type Props = {
  sessionId: string;
  onStatusChange?: (info: SessionInfo | null) => void;
  disabled?: boolean;
};

type WahaResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  error?: string;
  [key: string]: unknown;
};

const cardClasses = "rounded-lg border border-white/10 p-3 bg-[#0B1324]";

function extractQrSource(result: any): string | null {
  if (!result) return null;
  if (typeof result === "string" && result.startsWith("data:")) return result;
  if (typeof result?.base64 === "string") return result.base64;
  if (result?.data && result?.mimetype) {
    return `data:${result.mimetype};base64,${result.data}`;
  }
  return null;
}

export default function WahaConfig({ sessionId, onStatusChange, disabled }: Props) {
  const session = React.useMemo(() => sessionId?.trim() || "", [sessionId]);

  const [info, setInfo] = React.useState<SessionInfo | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = React.useState(false);
  const [loadingQr, setLoadingQr] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [qrError, setQrError] = React.useState<string | null>(null);

  const loadInfo = React.useCallback(async (): Promise<SessionInfo | null> => {
    if (!session) return null;
    setLoadingInfo(true);
    setStatusError(null);
    try {
      const resp = await fetchJson<WahaResponse<SessionInfo>>(
        `${API}/waha/sessions/${encodeURIComponent(session)}`,
      );
      if (!resp?.ok) {
        throw new Error(resp?.error || "Falha ao consultar sessao WAHA.");
      }
      const payload = resp.result ?? null;
      setInfo(payload);
      onStatusChange?.(payload);
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusError(message);
      setInfo(null);
      onStatusChange?.(null);
      return null;
    } finally {
      setLoadingInfo(false);
    }
  }, [session, onStatusChange]);

  const ensureSession = React.useCallback(async () => {
    if (!session || disabled) return;
    try {
      await fetchJson<WahaResponse>(`${API}/waha/sessions`, {
        method: "POST",
        body: JSON.stringify({ name: session, start: true }),
      });
    } catch (error) {
      // Backend already normalizes conflicts; surface only real failures.
      throw error;
    }
  }, [session, disabled]);

  const refreshQr = React.useCallback(async () => {
    if (!session || disabled) return;
    setLoadingQr(true);
    setQrError(null);
    try {
      await ensureSession();
      const resp = await fetchJson<WahaResponse<any>>(
        `${API}/waha/sessions/${encodeURIComponent(session)}/auth/qr?format=image`,
      );
      if (!resp?.ok) {
        throw new Error(resp?.error || "Falha ao gerar QR Code.");
      }
      const source = extractQrSource(resp.result);
      if (!source) {
        throw new Error("QR Code nao disponivel no momento.");
      }
      setQr(source);
      await loadInfo();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setQrError(message);
      setQr(null);
    } finally {
      setLoadingQr(false);
    }
  }, [session, disabled, ensureSession, loadInfo]);

  React.useEffect(() => {
    setInfo(null);
    setQr(null);
    setStatusError(null);
    setQrError(null);
    if (!session) return;
    (async () => {
      try {
        const payload = await loadInfo();
        const status = String(payload?.status || "").toUpperCase();
        const needsQr = !payload || !status || status === "SCAN_QR_CODE" || status === "FAILED" || status === "QR_TIMEOUT";
        if (!disabled && needsQr) {
          await refreshQr();
        }
      } catch {
        // errors already handled inside helpers
      }
    })();
  }, [session, disabled, refreshQr, loadInfo]);

  const connectedNumber = info?.phone ?? info?.number ?? info?.connectedPhone ?? null;
  const statusLabel = info?.status ?? "desconhecido";

  return (
    <div className={`${cardClasses} space-y-3 text-sm text-white/90`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">WAHA</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadInfo}
            disabled={disabled || loadingInfo}
            className="text-xs px-2 py-1 rounded border border-white/10 text-white/80 hover:border-white/40 disabled:opacity-50"
          >
            {loadingInfo ? "Atualizando..." : "Atualizar status"}
          </button>
          <button
            type="button"
            onClick={refreshQr}
            disabled={disabled || loadingQr}
            className="text-xs px-2 py-1 rounded border border-[#38BDF8]/40 text-[#38BDF8] hover:border-[#38BDF8] disabled:opacity-50"
          >
            {loadingQr ? "Gerando..." : "Atualizar QR"}
          </button>
        </div>
      </div>

      <div className="rounded bg-[#111c36] border border-white/10 p-3 space-y-2">
        <div>
          <span className="text-white/60">Sessao:</span>{" "}
          <span className="font-mono text-xs break-all">{session || "-"}</span>
        </div>
        <div>
          <span className="text-white/60">Status:</span> <span>{statusLabel}</span>
        </div>
        <div>
          <span className="text-white/60">Numero conectado:</span>{" "}
          <span>{connectedNumber || "-"}</span>
        </div>
        {statusError && <div className="text-xs text-red-400">Erro status: {statusError}</div>}
      </div>

      {qrError && <div className="text-xs text-red-400">Erro QR: {qrError}</div>}

      {qr ? (
        <div className="border border-white/10 rounded p-2 flex flex-col items-center gap-2">
          <img
            src={qr}
            alt="QR Code WAHA"
            className="w-64 h-64 object-contain bg-white/5 rounded"
          />
          <span className="text-xs text-white/60">
            Escaneie com o WhatsApp do numero que deseja conectar.
          </span>
        </div>
      ) : (
        <div className="text-xs text-white/60">
          O QR Code sera exibido automaticamente apos gerar a sessao.
        </div>
      )}
    </div>
  );
}

import React from "react";
import type { MetaProviderConfig } from "../../../types/types";

type MetaConfigProps = {
  value?: MetaProviderConfig | null;
  onChange: (next: MetaProviderConfig) => void;
  disabled?: boolean;
};

const INPUT =
  "w-full rounded-xl px-3 py-2 bg-[#0B1324] border border-white/10 text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#38BDF8] disabled:opacity-60";
const LABEL = "block text-sm text-[#94A3B8] mb-1";

const DEFAULT_META: MetaProviderConfig = {
  access_token: "",
  refresh_token: "",
  provider_api_key: "",
  phone_number_id: "",
  waba_id: "",
  webhook_verify_token: "",
};

const generateToken = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export default function MetaConfig({ value, onChange, disabled }: MetaConfigProps) {
  const meta = { ...DEFAULT_META, ...(value ?? {}) };

  const update = (field: keyof MetaProviderConfig, nextValue: string) => {
    const trimmed = nextValue.trim();
    onChange({ ...meta, [field]: trimmed });
  };

  return (
    <div className="rounded-xl p-4 border border-white/10 bg-[#0B1324] mt-4">
      <div className="text-sm font-medium text-white mb-3">Configuracoes Meta</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Access Token</label>
          <input
            className={INPUT}
            value={meta.access_token ?? ""}
            onChange={(e) => update("access_token", e.target.value)}
            placeholder="EAAG..."
            disabled={disabled}
          />
        </div>
        <div>
          <label className={LABEL}>Phone Number ID</label>
          <input
            className={INPUT}
            value={meta.phone_number_id ?? ""}
            onChange={(e) => update("phone_number_id", e.target.value)}
            placeholder="123456789000"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={LABEL}>WABA ID</label>
          <input
            className={INPUT}
            value={meta.waba_id ?? ""}
            onChange={(e) => update("waba_id", e.target.value)}
            placeholder="10203040506070"
            disabled={disabled}
          />
        </div>
        <div>
          <label className={LABEL}>Webhook Verify Token</label>
          <div className="flex gap-2">
            <input
              className={INPUT + " flex-1"}
              value={meta.webhook_verify_token ?? ""}
              onChange={(e) => update("webhook_verify_token", e.target.value)}
              placeholder="token seguro"
              disabled={disabled}
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#94A3B8]"
              onClick={() => onChange({ ...meta, webhook_verify_token: generateToken() })}
              disabled={disabled}
            >
              Gerar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

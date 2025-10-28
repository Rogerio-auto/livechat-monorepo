import { supabaseAdmin } from "../../lib/supabase.ts";
import { encryptSecret, decryptSecret } from "../../lib/crypto.ts";
import { WAHA_API_KEY, WAHA_PROVIDER } from "./client.ts";

type InboxRow = { id: string };
type SecretRow = {
  inbox_id: string;
  access_token: string | null;
  provider_api_key: string | null;
};

function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch (error) {
    console.warn("[WAHA] failed to decrypt stored secret", error);
    return null;
  }
}

export async function syncGlobalWahaApiKey(): Promise<void> {
  if (!WAHA_API_KEY) {
    console.info("[WAHA] WAHA_API_KEY not set, skipping global sync");
    return;
  }

  const encrypted = encryptSecret(WAHA_API_KEY);
  const nowIso = new Date().toISOString();

  try {
    const { data: inboxRows, error: inboxErr } = await supabaseAdmin
      .from("inboxes")
      .select("id")
      .eq("provider", WAHA_PROVIDER);

    if (inboxErr) {
      throw new Error(inboxErr.message);
    }

    const inboxes: InboxRow[] = inboxRows || [];
    if (inboxes.length === 0) {
      console.info("[WAHA] No WAHA inboxes found for global API key sync");
      return;
    }

    const inboxIds = inboxes.map((row) => row.id).filter(Boolean);
    if (inboxIds.length === 0) {
      console.info("[WAHA] No WAHA inbox IDs resolved for global API key sync");
      return;
    }

    const { data: secretsRows, error: secretsErr } = await supabaseAdmin
      .from("inbox_secrets")
      .select("inbox_id, access_token, provider_api_key")
      .in("inbox_id", inboxIds);

    if (secretsErr) {
      throw new Error(secretsErr.message);
    }

    const secretsMap = new Map<string, SecretRow>();
    for (const row of secretsRows || []) {
      secretsMap.set(row.inbox_id, row);
    }

    let upToDate = 0;
    let updated = 0;
    let failed = 0;

    for (const inboxId of inboxIds) {
      const secret = secretsMap.get(inboxId);
      const decrypted =
        safeDecrypt(secret?.provider_api_key) || safeDecrypt(secret?.access_token);

      if (decrypted === WAHA_API_KEY) {
        upToDate += 1;
        continue;
      }

      try {
        await supabaseAdmin
          .from("inbox_secrets")
          .upsert(
            [
              {
                inbox_id: inboxId,
                access_token: encrypted,
                provider_api_key: encrypted,
                updated_at: nowIso,
              },
            ],
            { onConflict: "inbox_id" },
          );
        updated += 1;
      } catch (error: any) {
        failed += 1;
        console.error("[WAHA] Failed to sync API key for inbox", inboxId, error?.message || error);
      }
    }

    console.info("[WAHA] Global API key sync completed", {
      total: inboxIds.length,
      upToDate,
      updated,
      failed,
    });
  } catch (error: any) {
    console.error("[WAHA] Global API key sync failed", error?.message || error);
  }
}


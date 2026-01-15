import axios from "axios";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";
import { logger } from "../lib/logger.js";
import { EX_APP, publish } from "../queue/rabbit.js";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  company_id: string;
  data: any;
}

/**
 * Service to handle outgoing webhooks
 */
export class WebhookService {
  /**
   * Triggers a webhook event by publishing to the queue
   * This decoupled approach ensures the main process doesn't wait for HTTP calls
   */
  static async trigger(event: string, companyId: string, data: any) {
    if (!companyId) {
      logger.warn(`[WebhookService] attempt to trigger ${event} without companyId`);
      return;
    }

    try {
      // For some events, we want to enrich the data before sending it to the worker
      // but to keep it fast, we do it in the worker/dispatcher.
      
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        company_id: companyId,
        data,
      };

      await publish(EX_APP, "webhook.dispatch", {
        jobType: "webhook.dispatch",
        payload,
        companyId,
      });

      logger.debug(`[WebhookService] Event ${event} queued for company ${companyId}`);
    } catch (error) {
      logger.error(`[WebhookService] Error triggering event ${event}`, error);
    }
  }

  /**
   * Resolve rich context (Inbox, Chat, Contact) for webhooks
   */
  static async enrichPayload(payload: WebhookPayload): Promise<WebhookPayload> {
    const { event, data, company_id } = payload;
    
    // If it's a message event, we want to add chat and contact info
    if (event.startsWith("message.") && data.chat_id) {
      try {
        const { data: chat } = await supabaseAdmin
          .from("chats")
          .select(`
            *,
            inbox:inboxes(*),
            contact:customers(*)
          `)
          .eq("id", data.chat_id)
          .single();

        if (chat) {
          return {
            ...payload,
            data: {
              ...data,
              chat: {
                id: chat.id,
                status: chat.status,
                type: chat.type
              },
              inbox: chat.inbox,
              contact: chat.contact
            }
          };
        }
      } catch (err) {
        logger.error(`[WebhookService] Failed to enrich payload for ${event}`, err);
      }
    }

    return payload;
  }

  /**
   * The actual dispatcher (usually called by a worker)
   */
  static async dispatch(companyId: string, initialPayload: WebhookPayload) {
    try {
      // 0. Enrich payload with context
      const payload = await this.enrichPayload(initialPayload);

      // 1. Get active subscriptions for this company and event
      const { data: subs, error } = await supabaseAdmin
        .from("webhook_subscriptions")
        .select("url, secret, events")
        .eq("company_id", companyId)
        .eq("is_active", true);

      if (error || !subs || subs.length === 0) return;

      const filtered = subs.filter(s => 
        s.events.includes("*") || s.events.includes(payload.event)
      );

      if (filtered.length === 0) return;

      const body = JSON.stringify(payload);

      // 2. Send to each matching subscription
      const tasks = filtered.map(async (sub) => {
        try {
          const signature = crypto
            .createHmac("sha256", sub.secret)
            .update(body)
            .digest("hex");

          await axios.post(sub.url, body, {
            headers: {
              "Content-Type": "application/json",
              "X-Webhook-Signature": signature,
              "User-Agent": "LiveChat-Webhook-Dispatcher/1.0",
            },
            timeout: 5000,
          });

          logger.info(`[WebhookService] ✅ Delivered ${payload.event} to ${sub.url}`);
        } catch (deliveryError: any) {
          logger.error(`[WebhookService] ❌ Delivery failed to ${sub.url}: ${deliveryError.message}`);
          // Add retry logic or queue here if needed
        }
      });

      await Promise.all(tasks);
    } catch (error) {
      logger.error(`[WebhookService] Error in dispatch`, error);
    }
  }
}

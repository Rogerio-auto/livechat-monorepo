// src/queues/rabbit.ts
import {
  connect as amqpConnect,
  type Channel as AmqpChannel,
  type ChannelModel as AmqpConnection,
  type Options,
} from "amqplib";

const URL =
  process.env.RABBIT_URL || "amqp://app:app@127.0.0.1:5672/%2F?heartbeat=30";
const PREFETCH = Number(process.env.RABBIT_PREFETCH || 20);

export const EX_APP  = process.env.RABBIT_EXCHANGE_APP  || "livechat.app";
export const EX_META = process.env.RABBIT_EXCHANGE_META || "livechat.meta";
export const EX_DLX  = process.env.RABBIT_EXCHANGE_DLX  || "livechat.dlx";

export const Q_INBOUND        = process.env.RABBIT_Q_INBOUND        || "q.inbound.message";
export const Q_INBOUND_MEDIA  = process.env.RABBIT_Q_INBOUND_MEDIA  || "q.inbound.media";
export const Q_OUTBOUND       = process.env.RABBIT_Q_OUTBOUND       || "q.outbound.request";
export const Q_OUTBOUND_RETRY = process.env.RABBIT_Q_OUTBOUND_RETRY || "q.outbound.retry.10s";
export const Q_OUTBOUND_DLQ   = process.env.RABBIT_Q_OUTBOUND_DLQ   || "q.outbound.dlq";
export const Q_SOCKET_LIVECHAT =
  process.env.RABBIT_Q_SOCKET_LIVECHAT || "q.socket.livechat";
export const Q_CAMPAIGN_FOLLOWUP =
  process.env.RABBIT_Q_CAMPAIGN_FOLLOWUP || "campaign.followup";
export const Q_FLOW_EXECUTION =
  process.env.RABBIT_Q_FLOW_EXECUTION || "flow.execution";
export const Q_WEBHOOK_DISPATCH =
  process.env.RABBIT_Q_WEBHOOK_DISPATCH || "webhook.dispatch";

// singletons
let _conn: AmqpConnection | null = null;
let _ch: AmqpChannel | null = null;
let _connecting: Promise<AmqpChannel> | null = null;

function wireConnEvents(conn: AmqpConnection) {
  conn.on("close", () => {
    console.warn("[Rabbit] connection closed");
    _conn = null;
    _ch = null;
    _connecting = null;
  });
  conn.on("error", (err) => {
    console.error("[Rabbit] connection error:", (err as any)?.message || err);
  });
  conn.on("blocked", (reason) => console.warn("[Rabbit] blocked:", reason));
  conn.on("unblocked", () => console.warn("[Rabbit] unblocked"));
}

async function setupTopology(ch: AmqpChannel) {
  await ch.prefetch(PREFETCH);

  // Exchanges
  await ch.assertExchange(EX_APP,  "topic", { durable: true });
  await ch.assertExchange(EX_META, "topic", { durable: true });
  await ch.assertExchange(EX_DLX,  "topic", { durable: true });

  // INBOUND (Meta -> App)
  await ch.assertQueue(Q_INBOUND, {
    durable: true,
    deadLetterExchange: EX_DLX,
  });
  await ch.bindQueue(Q_INBOUND, EX_META, "inbound.message");

  await ch.assertQueue(Q_INBOUND_MEDIA, {
    durable: true,
    deadLetterExchange: EX_DLX,
  });
  await ch.bindQueue(Q_INBOUND_MEDIA, EX_APP, "inbound.media");

  // OUTBOUND (App -> processamento)
  // Se o worker der nack (rejeitar), manda pro DLX com rk "outbound.retry"
  await ch.assertQueue(Q_OUTBOUND, {
    durable: true,
    deadLetterExchange: EX_DLX,
    deadLetterRoutingKey: "outbound.retry", // => vai para fila de retry
  });
  // Normal: publicamos em EX_APP com "outbound.request"
  await ch.bindQueue(Q_OUTBOUND, EX_APP, "outbound.request");
  // Quando sair da fila de retry (após TTL) volta em EX_APP com "outbound.retry"
  // e cai de novo nesta mesma fila por este bind:
  await ch.bindQueue(Q_OUTBOUND, EX_APP, "outbound.retry");

  // RETRY (TTL -> volta pro EX_APP)
  await ch.assertQueue(Q_OUTBOUND_RETRY, {
    durable: true,
    deadLetterExchange: EX_APP, // ao expirar, reencaminha pro EX_APP
    // (sem deadLetterRoutingKey: mantém "outbound.retry", que já está bindado na Q_OUTBOUND)
    messageTtl: 10_000, // 10s de espera antes de reentregar
  });
  // Mensagens que o worker mandar para EX_DLX com rk "outbound.retry"
  // entram aqui para “dormir” o TTL:
  await ch.bindQueue(Q_OUTBOUND_RETRY, EX_DLX, "outbound.retry");

  // DLQ (falhas definitivas)
  await ch.assertQueue(Q_OUTBOUND_DLQ, { durable: true });
  await ch.bindQueue(Q_OUTBOUND_DLQ, EX_DLX, "outbound.dlq");

  // SOCKET (eventos do worker -> backend principal)
  await ch.assertQueue(Q_SOCKET_LIVECHAT, {
    durable: true,
    deadLetterExchange: EX_DLX,
  });
  await ch.bindQueue(Q_SOCKET_LIVECHAT, EX_APP, "socket.livechat.*");

  // Campaign follow-ups (worker.campaigns)
  await ch.assertQueue(Q_CAMPAIGN_FOLLOWUP, { durable: true });

  // Flow Builder executions
  await ch.assertQueue(Q_FLOW_EXECUTION, { durable: true });
  await ch.bindQueue(Q_FLOW_EXECUTION, EX_APP, "flow.execution");

  // Webhook Dispatcher
  await ch.assertQueue(Q_WEBHOOK_DISPATCH, { 
    durable: true,
    deadLetterExchange: EX_DLX 
  });
  await ch.bindQueue(Q_WEBHOOK_DISPATCH, EX_APP, "webhook.dispatch");
}


async function connectWithRetry(): Promise<AmqpChannel> {
  let delay = 1000;
  for (let i = 1; i <= 10; i++) {
    try {
      const conn: AmqpConnection = await amqpConnect(URL);
      wireConnEvents(conn);
      const ch = await conn.createChannel();
      await setupTopology(ch);
      _conn = conn;
      _ch = ch;
      _connecting = null;
      console.log("[Rabbit] connected & topology ready");
      return ch;
    } catch (e: any) {
      console.warn(`[Rabbit] connect failed (${i}/10): ${e?.message || e}`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10000);
    }
  }
  throw new Error("Rabbit connect failed after retries");
}

/** Garante channel inicializado. Nunca retorna null. */
export async function getChannel(): Promise<AmqpChannel> {
  if (_ch) return _ch;
  if (_connecting) return _connecting;
  _connecting = connectWithRetry();
  return _connecting;
}

/** Publish com channel garantido. */
export async function publish(
  exchange: string,
  routingKey: string,
  payload: unknown,
  opts: Options.Publish = {}
): Promise<void> {
  try {
    const ch = await getChannel();
    const buf = Buffer.from(JSON.stringify(payload));
    const ok = ch.publish(exchange, routingKey, buf, {
      contentType: "application/json",
      persistent: true,
      ...opts,
    });
    if (!ok) console.warn("[Rabbit] publish backpressure", { exchange, routingKey });
  } catch (error) {
    console.error("[Rabbit] publish failed:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      exchange,
      routingKey,
    });
    throw error; // Re-throw to let caller handle it
  }
}

/** Helper de consumo. */
type ConsumeSettings = {
  prefetch?: number;
  options?: Options.Consume;
};

async function ensureConnection(): Promise<AmqpConnection> {
  if (_conn) return _conn;
  await getChannel();
  if (_conn) return _conn;
  throw new Error("Rabbit connection not available after initialization");
}

export async function consume(
  queue: string,
  onMessage: (msg: import("amqplib").ConsumeMessage, ch: AmqpChannel) => Promise<void> | void,
  config?: ConsumeSettings | Options.Consume,
) {
  let settings: ConsumeSettings;
  if (!config) {
    settings = {};
  } else if ("prefetch" in (config as ConsumeSettings) || "options" in (config as ConsumeSettings)) {
    settings = config as ConsumeSettings;
  } else {
    settings = { options: config as Options.Consume };
  }

  const conn = await ensureConnection();
  const ch = await conn.createChannel();
  await setupTopology(ch);

  const prefetch = settings.prefetch ?? PREFETCH;
  if (prefetch > 0) {
    await ch.prefetch(prefetch);
  }

  const consumeOptions = settings.options ?? { noAck: false };

  await ch.consume(
    queue,
    async (msg) => {
      if (!msg) return;
      try {
        await onMessage(msg, ch);
      } catch (e) {
        console.error(`[Rabbit] consumer error on ${queue}:`, (e as any)?.message || e);
      }
    },
    consumeOptions,
  );
}

/** Fechamento (opcional p/ testes). */
export async function shutdown(): Promise<void> {
  try {
    if (_ch) {
      await _ch.close();
      _ch = null;
    }
  } catch {}
  try {
    if (_conn) {
      await _conn.close();
      _conn = null;
    }
  } catch {}
  _connecting = null;
  console.log("[Rabbit] shutdown complete");
}

// Atalhos (se quiser publicar com 2 args no resto do código)
export async function publishApp(routingKey: string, payload: unknown, opts?: Options.Publish) {
  return publish(EX_APP, routingKey, payload, opts);
}
export async function publishMeta(routingKey: string, payload: unknown, opts?: Options.Publish) {
  return publish(EX_META, routingKey, payload, opts);
}

export async function getQueueInfo(name: string): Promise<{ queue: string; messageCount: number; consumerCount: number }> {
  const ch = await getChannel();
  const info = await ch.checkQueue(name);
  return {
    queue: info.queue,
    messageCount: info.messageCount,
    consumerCount: info.consumerCount,
  };
}

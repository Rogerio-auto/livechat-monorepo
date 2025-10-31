#!/usr/bin/env tsx

process.env.SKIP_WORKER_AUTOSTART = "1";

async function main() {
  const mod = await import("../src/worker.ts");
  const handler = (mod as any).handleWahaOutboundRequest;
  if (typeof handler !== "function") {
    console.error("[waha:smoke] handleWahaOutboundRequest not available");
    process.exitCode = 1;
    return;
  }

  try {
    await handler({ provider: "WAHA" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("WAHA outbound sem inboxId")) {
      console.log("[waha:smoke] handler reachable (expected validation error)");
      return;
    }
    console.error("[waha:smoke] unexpected error:", message);
    process.exitCode = 1;
  }
}

void main();

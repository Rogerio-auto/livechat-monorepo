import { consume, Q_FLOW_EXECUTION } from "./queue/rabbit.js";
import { processFlowStep } from "./services/flow-engine.service.js";
import "./config/env.js";

export async function registerFlowWorker() {
  console.log("[worker-flows] Starting flow worker...");

  await consume(Q_FLOW_EXECUTION, async (msg: any, ch: any) => {
    const data = JSON.parse(msg.content?.toString?.() || "{}");
    const { executionId } = data;

    if (!executionId) {
      ch.ack(msg);
      return;
    }

    console.log(`[worker-flows] Processing execution: ${executionId}`);
    try {
      await processFlowStep(executionId);
      ch.ack(msg);
    } catch (error) {
      console.error(`[worker-flows] Error processing execution ${executionId}:`, error);
      ch.nack(msg, false, false); // Don't requue for now to avoid loops
    }
  });

  console.log("[worker-flows] Listening on queue:", Q_FLOW_EXECUTION);
}

// Bootstrap
if (process.argv[1]?.includes('worker.flows')) {
  (async () => {
    try {
      await registerFlowWorker();
      console.log("[worker-flows] Worker started successfully");
    } catch (error) {
      console.error("[worker-flows] Failed to start:", error);
      process.exit(1);
    }
  })();
}

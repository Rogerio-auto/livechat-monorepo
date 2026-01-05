
import "dotenv/config";
import { getQueueInfo, Q_FLOW_EXECUTION } from "./src/queue/rabbit.js";

async function checkQueue() {
  try {
    const info = await getQueueInfo(Q_FLOW_EXECUTION);
    console.log(`Queue: ${info.queue}`);
    console.log(`Messages: ${info.messageCount}`);
    console.log(`Consumers: ${info.consumerCount}`);
  } catch (error) {
    console.error("Error checking queue:", error);
  }
  process.exit(0);
}

checkQueue();

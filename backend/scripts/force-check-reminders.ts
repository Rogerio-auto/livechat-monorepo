
import { checkAndSendReminders } from "../src/jobs/taskReminders";

async function forceRun() {
  console.log("🚀 Forcing checkAndSendReminders execution...");
  await checkAndSendReminders();
  console.log("✅ Done!");
  process.exit(0);
}

forceRun();

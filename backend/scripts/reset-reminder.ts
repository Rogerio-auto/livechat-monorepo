
import { supabaseAdmin } from "../src/lib/supabase";

async function resetReminder() {
  const taskId = "a50321e1-30e7-4fc6-9883-2411ccd14231"; // ID from previous debug output
  console.log(`Resetting reminder for task: ${taskId}`);

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ reminder_sent: false })
    .eq("id", taskId);

  if (error) {
    console.error("Error resetting reminder:", error);
  } else {
    console.log("✅ Reminder reset successfully!");
  }
}

resetReminder();


import { supabaseAdmin } from "../src/lib/supabase";

async function debugTasks() {
  const companyId = "b9cb707c-49b2-43b6-bb02-e8f932ba8153";
  console.log(`Checking tasks for company: ${companyId}`);

  const { data: tasks, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching tasks:", error);
    return;
  }

  console.log(`Found ${tasks.length} recent tasks:`);
  tasks.forEach((task) => {
    console.log("---------------------------------------------------");
    console.log(`ID: ${task.id}`);
    console.log(`Title: ${task.title}`);
    console.log(`Status: ${task.status}`);
    console.log(`Reminder Enabled: ${task.reminder_enabled}`);
    console.log(`Reminder Time: ${task.reminder_time}`);
    console.log(`Reminder Sent: ${task.reminder_sent}`);
    console.log(`Reminder Channels: ${task.reminder_channels}`);
    console.log(`Due Date: ${task.due_date}`);
    console.log(`Created At: ${task.created_at}`);
    
    const now = new Date().toISOString();
    const isTime = task.reminder_time && task.reminder_time <= now;
    console.log(`Is Reminder Time <= Now (${now})? ${isTime}`);
  });
}

debugTasks();

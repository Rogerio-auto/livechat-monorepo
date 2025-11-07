import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const toolKey = process.argv[2] || "schedule_meeting";
  
  const { data, error } = await supabaseAdmin
    .from("tools_catalog")
    .select("*")
    .eq("key", toolKey)
    .single();

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main();

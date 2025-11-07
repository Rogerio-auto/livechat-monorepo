import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("tools_catalog")
    .select("key,name,handler_type")
    .order("key");

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.table(data);
}

main();

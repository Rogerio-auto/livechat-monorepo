
import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const { data, error } = await supabaseAdmin.from('users').select('id, name, email').limit(5);
  if (error) {
    console.error("Error fetching public.users:", error.message);
  } else {
    console.log("Users in public.users:", data);
  }
}

main();

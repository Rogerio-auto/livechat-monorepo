
import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const { data, error } = await supabaseAdmin.from('users').select('id, email, name');
  if (error) {
    console.error("Error fetching users:", error);
  } else {
    console.log("Users in DB:", JSON.stringify(data, null, 2));
  }
}

main();

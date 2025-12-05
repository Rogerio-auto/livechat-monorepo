import { supabaseAdmin } from "./src/lib/supabase.js";

async function checkTemplate() {
  const { data, error } = await supabaseAdmin
    .from("document_templates")
    .select("*")
    .eq("id", "cd943df7-d361-44df-aeb0-a77b99613e82")
    .single();
  
  if (error) {
    console.error("Erro:", error);
    return;
  }
  
  console.log(JSON.stringify(data, null, 2));
}

checkTemplate();

import { supabaseAdmin } from "./src/lib/supabase.js";

async function checkCatalogStructure() {
  const { data } = await supabaseAdmin
    .from('catalog_items')
    .select('id, name, power, size, specs, item_type')
    .eq('company_id', 'd56a5396-22df-486a-8fea-a82138e1f614')
    .limit(3);
  
  console.log("Estrutura dos produtos:");
  console.log(JSON.stringify(data, null, 2));
}

checkCatalogStructure();

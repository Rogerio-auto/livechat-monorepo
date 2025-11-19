import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function diagnose() {
  console.log("🔍 Diagnóstico de Auto-criação de Tarefas\n");

  // 1. Chats inativos
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: inactiveChats, error: chatsError } = await supabase
    .from("chats")
    .select("id, customer_id, last_message_at, status")
    .not("status", "eq", "CLOSED")
    .lt("last_message_at", threeDaysAgo.toISOString())
    .not("customer_id", "is", null);

  console.log(`📊 Chats inativos (3+ dias): ${inactiveChats?.length || 0}`);
  
  if (inactiveChats && inactiveChats.length > 0) {
    const withCustomer = inactiveChats.filter(c => c.customer_id).length;
    console.log(`   - Com customer_id: ${withCustomer}`);
    console.log(`   - Sem customer_id: ${inactiveChats.length - withCustomer}\n`);

    // 2. Customers com lead_id
    const customerIds = inactiveChats.map(c => c.customer_id).filter(Boolean);
    
    const { data: customers } = await supabase
      .from("customers")
      .select("id, lead_id")
      .in("id", customerIds);

    const withLeadId = customers?.filter(c => c.lead_id).length || 0;
    console.log(`👥 Customers analisados: ${customers?.length || 0}`);
    console.log(`   - Com lead_id: ${withLeadId}`);
    console.log(`   - Sem lead_id: ${(customers?.length || 0) - withLeadId}\n`);

    if (withLeadId > 0) {
      // 3. Status dos leads
      const leadIds = customers?.map(c => c.lead_id).filter(Boolean) || [];
      
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, status_client, assigned_to_id")
        .in("id", leadIds);

      console.log(`🎯 Leads encontrados: ${leads?.length || 0}`);
      
      const statusCount: Record<string, number> = {};
      leads?.forEach(lead => {
        const status = lead.status_client || "null";
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      console.log("   Status dos leads:");
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      });

      const activeLeads = leads?.filter(
        l => l.status_client !== "Ganho" && l.status_client !== "Perdido"
      ).length || 0;
      
      console.log(`\n✅ Leads ativos (não Ganho/Perdido): ${activeLeads}`);
      console.log(`❌ Leads inativos (Ganho/Perdido): ${(leads?.length || 0) - activeLeads}\n`);

      // Mostrar exemplos
      if (activeLeads > 0) {
        console.log("📋 Exemplo de leads que receberiam follow-up:");
        const examples = leads
          ?.filter(l => l.status_client !== "Ganho" && l.status_client !== "Perdido")
          .slice(0, 3);
        
        examples?.forEach(lead => {
          console.log(`   - ${lead.name} (${lead.status_client || "sem status"})`);
        });
      }
    }
  }

  // 4. Eventos para amanhã
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_time, status")
    .gte("start_time", tomorrow.toISOString())
    .lt("start_time", dayAfterTomorrow.toISOString());

  console.log(`\n📅 Eventos para amanhã: ${events?.length || 0}`);
  
  if (events && events.length > 0) {
    const notCancelled = events.filter(e => e.status !== "CANCELLED").length;
    console.log(`   - Ativos: ${notCancelled}`);
    console.log(`   - Cancelados: ${events.length - notCancelled}`);
  }

  console.log("\n✅ Diagnóstico concluído!");
}

diagnose().catch(console.error);

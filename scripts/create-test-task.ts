import { supabaseAdmin } from "../backend/src/lib/supabase";
import { v4 as uuidv4 } from "uuid";

async function createTestTask() {
  console.log("🚀 Criando tarefa de teste para disparar notificação...");

  // 1. Pegar um usuário e empresa válidos (o primeiro que achar)
  const { data: users, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, company_id, email")
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error("❌ Erro: Nenhum usuário encontrado para atribuir a tarefa.");
    return;
  }

  const user = users[0];
  console.log(`👤 Usuário encontrado: ${user.email} (${user.id})`);

  // 2. Criar tarefa com lembrete para 1 minuto atrás (para ser pego imediatamente)
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();

  const task = {
    id: uuidv4(),
    company_id: user.company_id,
    title: "Tarefa de Teste de Notificação 🔔",
    description: "Esta tarefa foi criada automaticamente para testar o sistema de notificações.",
    created_by: user.id,
    assigned_to: user.id,
    status: "PENDING",
    priority: "HIGH",
    type: "GENERAL",
    due_date: new Date(now.getTime() + 3600000).toISOString(), // Vence em 1h
    reminder_enabled: true,
    reminder_time: oneMinuteAgo, // Lembrete agendado para o passado (já venceu)
    reminder_sent: false,
    reminder_channels: ["IN_APP", "EMAIL"], // Testar canais
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert(task)
    .select()
    .single();

  if (error) {
    console.error("❌ Erro ao criar tarefa:", error);
  } else {
    console.log("✅ Tarefa criada com sucesso!");
    console.log(`🆔 ID: ${data.id}`);
    console.log(`⏰ Lembrete agendado para: ${task.reminder_time}`);
    console.log("👀 Fique de olho nos logs do worker nos próximos 60 segundos...");
  }
}

createTestTask();

// backend/src/jobs/autoAgentFollowup.ts
import { createClient } from "@supabase/supabase-js";
import { runAgentReply } from "../services/agents.runtime.js";
import { db } from "../pg.ts";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface IdleChat {
  id: string;
  customer_id: string;
  company_id: string;
  inbox_id: string;
  agent_id: string;
  last_message_at: string;
  last_message_from: string;
  idle_seconds: number;
  reply_if_idle_sec: number;
  customer_name: string;
  customer_phone: string;
}

/**
 * Buscar chats ociosos que precisam de follow-up automático
 * 
 * Critérios:
 * 1. Status do chat = 'AI' (controlado por agente)
 * 2. Última mensagem foi do CUSTOMER
 * 3. Tempo desde última mensagem > reply_if_idle_sec configurado no agente
 * 4. Agente tem reply_if_idle_sec > 0 configurado
 */
async function findIdleChats(): Promise<IdleChat[]> {
  try {
    console.log("[AutoAgentFollowup] 🔍 Buscando chats ociosos...");

    // Query que busca chats ociosos elegíveis para follow-up
    const query = `
      SELECT 
        c.id,
        c.customer_id,
        c.company_id,
        c.inbox_id,
        a.id as agent_id,
        c.last_message_at,
        c.last_message_from,
        a.reply_if_idle_sec,
        EXTRACT(EPOCH FROM (NOW() - c.last_message_at))::int as idle_seconds,
        cust.name as customer_name,
        cust.phone as customer_phone
      FROM chats c
      INNER JOIN agents a ON a.company_id = c.company_id 
        AND a.is_active = true 
        AND a.reply_if_idle_sec > 0
      LEFT JOIN customers cust ON cust.id = c.customer_id
      WHERE c.status = 'AI'
        AND c.last_message_from = 'CUSTOMER'
        AND c.last_message_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (NOW() - c.last_message_at)) > a.reply_if_idle_sec
        AND (
          -- Agente específico da inbox
          (c.inbox_id IS NOT NULL AND a.inbox_id = c.inbox_id)
          OR
          -- Agente padrão da empresa (sem inbox específica)
          (c.inbox_id IS NULL AND a.inbox_id IS NULL)
        )
      ORDER BY c.last_message_at ASC
      LIMIT 50
    `;

    const idleChats = await db.any<IdleChat>(query);

    if (!idleChats || idleChats.length === 0) {
      console.log("[AutoAgentFollowup] ℹ️  Nenhum chat ocioso encontrado");
      return [];
    }

    console.log(`[AutoAgentFollowup] 📊 Encontrados ${idleChats.length} chats ociosos:`, 
      idleChats.map(c => ({
        chatId: c.id,
        customer: c.customer_name,
        idleSeconds: c.idle_seconds,
        threshold: c.reply_if_idle_sec
      }))
    );

    return idleChats;
  } catch (error) {
    console.error("[AutoAgentFollowup] ❌ Erro ao buscar chats ociosos:", error);
    return [];
  }
}

/**
 * Enviar follow-up automático para um chat ocioso
 */
async function sendFollowup(chat: IdleChat): Promise<boolean> {
  try {
    console.log(`[AutoAgentFollowup] 💬 Enviando follow-up para chat ${chat.id}`, {
      customer: chat.customer_name,
      idleTime: `${Math.floor(chat.idle_seconds / 60)} minutos`,
      lastMessageFrom: chat.last_message_from,
    });

    // Mensagem de contexto indicando que é um follow-up automático
    const followupContext = `[Sistema: Cliente ficou ${Math.floor(chat.idle_seconds / 60)} minutos sem responder. Envie uma mensagem de follow-up amigável para retomar a conversa.]`;

    // Executar o agente para gerar resposta
    const result = await runAgentReply({
      companyId: chat.company_id,
      inboxId: chat.inbox_id,
      agentId: chat.agent_id,
      userMessage: followupContext,
      chatId: chat.id,
      contactId: chat.customer_id,
    });

    if (result.skipped) {
      console.log(`[AutoAgentFollowup] ⏭️  Follow-up pulado para chat ${chat.id}: ${result.reason}`);
      return false;
    }

    if (!result.reply) {
      console.log(`[AutoAgentFollowup] ⚠️  Agente não gerou resposta para chat ${chat.id}`);
      return false;
    }

    console.log(`[AutoAgentFollowup] ✅ Follow-up enviado para chat ${chat.id}`, {
      customer: chat.customer_name,
      replyLength: result.reply.length,
      model: result.model,
    });

    // Atualizar chat para marcar que o agente enviou o follow-up
    await db.none(
      `UPDATE chats 
       SET last_message_from = 'AGENT',
           last_message_at = NOW()
       WHERE id = $1`,
      [chat.id]
    );

    return true;
  } catch (error) {
    console.error(`[AutoAgentFollowup] ❌ Erro ao enviar follow-up para chat ${chat.id}:`, error);
    return false;
  }
}

/**
 * Processar todos os chats ociosos e enviar follow-ups
 */
export async function runAutoAgentFollowup(): Promise<void> {
  const startTime = Date.now();
  console.log("[AutoAgentFollowup] 🚀 Iniciando verificação de chats ociosos...");

  try {
    const idleChats = await findIdleChats();

    if (idleChats.length === 0) {
      console.log("[AutoAgentFollowup] ✅ Nenhum chat precisa de follow-up no momento");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Processar cada chat sequencialmente para evitar sobrecarga
    for (const chat of idleChats) {
      const sent = await sendFollowup(chat);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }

      // Delay pequeno entre follow-ups para não sobrecarregar APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = Date.now() - startTime;
    console.log(`[AutoAgentFollowup] 🏁 Processamento concluído em ${duration}ms`, {
      total: idleChats.length,
      success: successCount,
      failed: failCount,
    });
  } catch (error) {
    console.error("[AutoAgentFollowup] ❌ Erro geral no processamento:", error);
  }
}

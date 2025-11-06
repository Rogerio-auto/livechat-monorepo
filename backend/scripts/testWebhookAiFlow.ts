#!/usr/bin/env tsx
/**
 * End-to-end test (simplificada) do fluxo: webhook inbound -> processamento -> chamada de IA -> execução de ferramenta.
 * Nota: Em vez de acionar realmente o servidor HTTP e filas, simulamos:
 *  1. Garantir customer + chat com status 'AI'.
 *  2. Enviar mensagem que deve gerar tool call de update_customer_name.
 *  3. Chamar runAgentReply diretamente (representa parte final do worker).
 *  4. Ler agent_tool_logs e customers/leads para validar efeitos.
 */
import 'dotenv/config';
import { db } from '../src/pg.ts';
import { supabaseAdmin } from '../src/lib/supabase.ts';
import { runAgentReply } from '../src/services/agents.runtime.ts';

const COMPANY_ID = process.env.TEST_COMPANY_ID || 'd56a5396-22df-486a-8fea-a82138e1f614';
const AGENT_ID = process.env.TEST_AGENT_ID || '52c55a45-5ef1-45a1-8022-c3d980d6e8e1';
const PHONE = process.env.TEST_PHONE || '556999673660';
const CUSTOMER_ID = process.env.TEST_CUSTOMER_ID || '9001eb13-cf6d-4be5-bba7-064757c483a8';
const CHAT_ID = process.env.TEST_CHAT_ID || '103f5d1c-bf84-447b-9810-accb9b8c2b31';
const NEW_NAME = process.env.TEST_NEW_NAME || `Nome Teste Flow ${Date.now().toString().slice(-4)}`;

async function ensureCustomer() {
  const { data } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, company_id')
    .eq('id', CUSTOMER_ID)
    .maybeSingle();
  if (!data) {
    const { error } = await supabaseAdmin.from('customers').insert({
      id: CUSTOMER_ID,
      company_id: COMPANY_ID,
      phone: PHONE,
      name: 'Inicial'
    });
    if (error) throw new Error('create customer failed: ' + error.message);
  }
}

async function ensureChat() {
  const row = await db.oneOrNone<{ id: string | null }>(
    `select id from chats where id = $1`,
    [CHAT_ID]
  );
  if (!row) {
    await db.none(
      `insert into chats (id, company_id, inbox_id, customer_id, status, created_at, updated_at) values ($1,$2,$3,$4,'AI', now(), now())`,
      [CHAT_ID, COMPANY_ID, '57f08db5-fd48-4c0d-8fc8-56314b5673c3', CUSTOMER_ID]
    );
  } else {
    // Ensure status AI
    await db.none(`update chats set status = 'AI', updated_at = now() where id = $1`, [CHAT_ID]);
  }
}

async function linkAgentToChat() {
  // Ensure chat.ai_agent_id set
  await db.none(`update chats set ai_agent_id = $2 where id = $1`, [CHAT_ID, AGENT_ID]);
}

async function fetchToolLogs(): Promise<any[]> {
  // Use repo API contract: executed_at is the timestamp column
  const rows = await db.any(
    `SELECT id, executed_at, tool_id, error, params, result, action, chat_id
     FROM public.agent_tool_logs
     WHERE chat_id = $1
     ORDER BY executed_at DESC
     LIMIT 10`,
    [CHAT_ID]
  );
  return rows;
}

async function fetchCustomerLead(): Promise<any> {
  const { data: cust } = await supabaseAdmin
    .from('customers')
    .select('id, name, phone, lead_id')
    .eq('id', CUSTOMER_ID)
    .maybeSingle();
  let lead: any = null;
  if (cust?.lead_id) {
    const { data: leadRow } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone, cep, city, state')
      .eq('id', cust.lead_id)
      .maybeSingle();
    lead = leadRow;
  }
  return { customer: cust, lead };
}

async function main() {
  console.log('[FLOW TEST] Ensuring base data...');
  await ensureCustomer();
  await ensureChat();
  await linkAgentToChat();

  const userMessage = `Atualiza meu nome para ${NEW_NAME}`;
  console.log('[FLOW TEST] Simulating inbound message -> agent reply', { userMessage });

  // We call runAgentReply directly (simulating worker after inbound normalization)
  const ai = await runAgentReply({
    companyId: COMPANY_ID,
    inboxId: '57f08db5-fd48-4c0d-8fc8-56314b5673c3',
    agentId: AGENT_ID,
    userMessage,
    chatId: CHAT_ID,
    contactId: CUSTOMER_ID, // provides context for tool auto-fill
  });

  console.log('[FLOW TEST] AI reply meta:', {
    skipped: ai.skipped,
    model: ai.model,
    replyLength: (ai.reply || '').length,
  });
  console.log('[FLOW TEST] Raw reply:', ai.reply);

  // Fetch tool logs
  const logs = await fetchToolLogs();
  console.log('[FLOW TEST] Tool logs found:', logs.length);
  for (const l of logs) {
    console.log('[FLOW TEST][tool-log]', {
      id: l.id,
    executed_at: l.executed_at,
      action: l.action,
      error: l.error,
      params: l.params,
      result: l.result,
    });
  }

  // Fetch final customer + lead state
  const state = await fetchCustomerLead();
  console.log('[FLOW TEST] Final state:', state);

  // Simple assertions summary
  const usedUpdateTool = logs.some(l => String(l.action || '').includes('INTERNAL_DB'));
  const nameUpdated = state.customer?.name === NEW_NAME;

  console.log('[FLOW TEST] Summary:', {
    updateToolCalled: usedUpdateTool,
    nameUpdated,
    customerId: state.customer?.id,
    leadName: state.lead?.name,
  });
}

main().then(() => {
  console.log('[FLOW TEST] Done');
  process.exit(0);
}).catch(err => {
  console.error('[FLOW TEST] Error:', err);
  process.exit(1);
});

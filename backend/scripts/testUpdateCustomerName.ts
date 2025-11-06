#!/usr/bin/env tsx
import 'dotenv/config';
import { executeTool, ToolExecutionContext } from '../src/services/toolHandlers.ts';
import { getToolByKey, addToolToAgent, listAgentTools } from '../src/repos/tools.repo.ts';
import { db } from '../src/pg.ts';

async function main() {
  const AGENT_ID = process.env.TEST_AGENT_ID || '52c55a45-5ef1-45a1-8022-c3d980d6e8e1';
  const COMPANY_ID = process.env.TEST_COMPANY_ID || 'd56a5396-22df-486a-8fea-a82138e1f614';
  const CHAT_ID = process.env.TEST_CHAT_ID || '103f5d1c-bf84-447b-9810-accb9b8c2b31';
  const CONTACT_ID = process.env.TEST_CUSTOMER_ID || '9001eb13-cf6d-4be5-bba7-064757c483a8';
  const TOOL_KEY = process.env.TEST_TOOL_KEY || 'update_customer_name';
  const NEW_NAME = process.env.TEST_NEW_NAME || 'Rogério Eurique Viana';

  console.log('[TEST] Starting tool test', { TOOL_KEY, AGENT_ID, COMPANY_ID, CHAT_ID, CONTACT_ID, NEW_NAME });

  // Ensure tool exists
  const tool = await getToolByKey(TOOL_KEY);
  if (!tool) {
    console.error(`[TEST] Tool with key '${TOOL_KEY}' not found. Did you run SQL 016?`);
    process.exit(1);
  }

  // Ensure agent has the tool enabled
  const agentTools = await listAgentTools({ agent_id: AGENT_ID, is_enabled: true });
  const existing = agentTools.find((at: any) => at.tool.key === TOOL_KEY);
  let agentTool: any = existing;
  if (!existing) {
    console.log('[TEST] Tool not linked to agent. Adding temporarily...');
    agentTool = await addToolToAgent(AGENT_ID, tool.id, { is_enabled: true });
    // Re-fetch to include tool payload
    const ats = await listAgentTools({ agent_id: AGENT_ID, is_enabled: true });
    agentTool = ats.find((at: any) => at.tool_id === tool.id);
  }

  if (!agentTool) {
    console.error('[TEST] Failed to link tool to agent.');
    process.exit(1);
  }

  const params = { customer_id: CONTACT_ID, name: NEW_NAME };
  const context: ToolExecutionContext = {
    agentId: AGENT_ID,
    chatId: CHAT_ID,
    contactId: CONTACT_ID,
    companyId: COMPANY_ID,
  };

  console.log('[TEST] Executing tool...', { params });
  const result = await executeTool(tool as any, agentTool as any, params, context);
  console.log('[TEST] Result:', JSON.stringify(result, null, 2));
}

main().then(() => {
  console.log('[TEST] Done');
  // Close DB pool if any
  try { (db as any)?.$pool?.end?.(); } catch {}
  process.exit(0);
}).catch(err => {
  console.error('[TEST] Error', err);
  try { (db as any)?.$pool?.end?.(); } catch {}
  process.exit(1);
});

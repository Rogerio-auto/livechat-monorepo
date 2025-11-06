// services/toolHandlers.ts
// Executores de ferramentas com validação granular de acesso a colunas

import { supabaseAdmin } from "../lib/supabase";
import type { Tool, AgentTool } from "../repos/tools.repo";
import { logToolExecution } from "../repos/tools.repo";
import { getIO } from "../lib/io";

export type ToolExecutionContext = {
  agentId: string;
  chatId: string;
  contactId?: string;
  userId?: string;
  companyId?: string; // Added for knowledge base queries
};

export type ToolExecutionResult = {
  success: boolean;
  data?: any;
  error?: string;
};

// ====== Main executor ======
export async function executeTool(
  tool: Tool,
  agentTool: AgentTool,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // Merge tool.handler_config with agentTool.overrides
  const effectiveConfig = {
    ...tool.handler_config,
    ...agentTool.overrides,
  };

  let result: ToolExecutionResult;
  const startTime = Date.now();

  try {
    switch (tool.handler_type) {
      case "INTERNAL_DB":
        result = await handleInternalDB(tool, effectiveConfig, params, context);
        break;
      case "HTTP":
        result = await handleHTTP(tool, effectiveConfig, params, context);
        break;
      case "WORKFLOW":
        result = await handleWorkflow(tool, effectiveConfig, params, context);
        break;
      case "SOCKET":
        result = await handleSocket(tool, effectiveConfig, params, context);
        break;
      default:
        throw new Error(`Unknown handler type: ${tool.handler_type}`);
    }

    // Log success
    await logToolExecution({
      agent_id: context.agentId,
      tool_id: tool.id,
      chat_id: context.chatId,
      contact_id: context.contactId || null,
      action: effectiveConfig.action || tool.handler_type,
      table_name: effectiveConfig.table || null,
      columns_accessed: Object.keys(params),
      params,
      result: result.data || null,
      error: null,
    });

    return result;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Log error
    await logToolExecution({
      agent_id: context.agentId,
      tool_id: tool.id,
      chat_id: context.chatId,
      contact_id: context.contactId || null,
      action: effectiveConfig.action || tool.handler_type,
      table_name: effectiveConfig.table || null,
      columns_accessed: Object.keys(params),
      params,
      result: null,
      error: errorMsg,
    });

    return { success: false, error: errorMsg };
  }
}

// ====== Handler: INTERNAL_DB ======
async function handleInternalDB(
  tool: Tool,
  config: Record<string, any>,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { table, action, allowed_columns, restricted_columns, required_columns, default_values } = config;

  if (!table) throw new Error("handler_config.table is required for INTERNAL_DB");
  if (!action) throw new Error("handler_config.action is required for INTERNAL_DB");

  const restrictedCols = (restricted_columns as string[]) || [];
  const requiredCols = (required_columns as string[]) || [];
  const defaults = (default_values as Record<string, any>) || {};

  // ====== SPECIAL CASE: Knowledge Base Search with Full-Text ======
  if (table === "knowledge_base" && action === "select" && params.query_text) {
    const query_text = params.query_text;
    const category = params.category || null;
    const max_results = params.max_results || 5;

    if (!context.companyId) {
      throw new Error("companyId is required for Knowledge Base search");
    }

    // Use the RPC function for semantic search
    const { data, error } = await supabaseAdmin.rpc("search_knowledge_base", {
      p_company_id: context.companyId,
      p_query: query_text,
      p_category: category,
      p_max_results: max_results,
    });

    if (error) {
      console.error("[toolHandlers] search_knowledge_base RPC error:", error);
      throw new Error(`Knowledge Base search error: ${error.message}`);
    }

    // Increment usage count for each result
    if (data && Array.isArray(data)) {
      for (const item of data) {
        if (item.id) {
          try {
            await supabaseAdmin.rpc("increment_kb_usage", {
              p_company_id: context.companyId,
              p_kb_id: item.id,
            });
          } catch (usageError) {
            console.warn("[toolHandlers] Failed to increment KB usage:", usageError);
          }
        }
      }
    }

    return { success: true, data };
  }

  // ====== WRITE operations: validate allowed_columns.write ======
  if (action === "insert" || action === "update" || action === "upsert") {
    const writeColumns = (allowed_columns?.write as string[]) || [];

    // 1. Check restricted columns
    for (const col of Object.keys(params)) {
      if (restrictedCols.includes(col)) {
        throw new Error(`Access to column '${col}' is restricted.`);
      }
      // 2. Check allowed write columns (skip ID fields)
      if (!writeColumns.includes(col) && !["id", "contact_id", "agent_id", "chat_id"].includes(col)) {
        throw new Error(`Column '${col}' is not allowed for write in table '${table}'.`);
      }
    }

    // 3. Validate required columns
    for (const reqCol of requiredCols) {
      if (!(reqCol in params)) {
        throw new Error(`Required column '${reqCol}' is missing.`);
      }
    }

    // 4. Apply default values
    const finalParams = { ...defaults, ...params };

    // 5. Special handling for events: assign default calendar_id and created_by_id
    if (table === "events" && action === "insert") {
      if (!finalParams.calendar_id && context.userId) {
        // Buscar calendário padrão do usuário ou criar um default
        const { data: cal } = await supabaseAdmin
          .from("calendars")
          .select("id")
          .eq("owner_id", context.userId)
          .eq("is_default", true)
          .maybeSingle();
        
        if (cal) {
          finalParams.calendar_id = cal.id;
        } else {
          // Se não tem calendário padrão, buscar o primeiro calendário do usuário
          const { data: firstCal } = await supabaseAdmin
            .from("calendars")
            .select("id")
            .eq("owner_id", context.userId)
            .limit(1)
            .maybeSingle();
          
          if (firstCal) finalParams.calendar_id = firstCal.id;
        }
      }
      
      if (!finalParams.created_by_id && context.userId) {
        finalParams.created_by_id = context.userId;
      }
    }

    // 6. Execute operation
    if (action === "insert") {
      const { data, error } = await supabaseAdmin.from(table).insert(finalParams).select();
      if (error) throw new Error(`DB insert error: ${error.message}`);
      return { success: true, data };
    }

    if (action === "update") {
      // Identify the identifier key coming from the tool schema
      let idKey = requiredCols[0] || "id";
      const idValue = finalParams[idKey];
      if (!idValue) throw new Error(`Missing ${idKey} for update`);

      // Do not update the identifier column itself
      delete finalParams[idKey];

      // Map common alias parameters to the real primary key column when needed
      // Example: tools may require "customer_id" but the table column is "id"
      let filterColumn = idKey;
      if (table === "customers" && idKey === "customer_id") {
        filterColumn = "id";
      }

      // Execute the main update
      const { data, error } = await supabaseAdmin
        .from(table)
        .update(finalParams)
        .eq(filterColumn, idValue)
        .select();
      if (error) throw new Error(`DB update error: ${error.message}`);

      // ====== SYNC LOGIC: customers <-> leads ======
      // If sync_to_leads is enabled and we're updating customers, sync to related lead
      if (table === "customers" && config.sync_to_leads === true && data && data.length > 0) {
        const customer = data[0];
        try {
          // Find lead related to this customer (via lead.customer_id or matching phone)
          const { data: relatedLeads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .or(`customer_id.eq.${customer.id},phone.eq.${customer.phone}`)
            .limit(1);

          if (relatedLeads && relatedLeads.length > 0) {
            const leadId = relatedLeads[0].id;
            const leadUpdates: Record<string, any> = {};
            
            // Sync common fields
            if (finalParams.name !== undefined) leadUpdates.name = finalParams.name;
            if (finalParams.phone !== undefined) leadUpdates.phone = finalParams.phone;
            
            if (Object.keys(leadUpdates).length > 0) {
              await supabaseAdmin
                .from("leads")
                .update(leadUpdates)
                .eq("id", leadId);
              
              console.log(`[toolHandlers] Synced customer ${customer.id} to lead ${leadId}`, leadUpdates);
            }
          }
        } catch (syncError) {
          console.warn("[toolHandlers] Failed to sync customer to lead:", syncError);
          // Don't fail the whole operation if sync fails
        }
      }

      return { success: true, data };
    }

    if (action === "upsert") {
      const { data, error } = await supabaseAdmin.from(table).upsert(finalParams).select();
      if (error) throw new Error(`DB upsert error: ${error.message}`);
      return { success: true, data };
    }
  }

  // ====== READ operations: validate allowed_columns.read ======
  if (action === "select") {
    const readColumns = (allowed_columns?.read as string[]) || ["*"];

    // Check restricted columns in params (filter conditions)
    for (const col of Object.keys(params)) {
      if (restrictedCols.includes(col)) {
        throw new Error(`Cannot filter by restricted column '${col}'.`);
      }
    }

    // Map alias parameters to real columns for customers table
    const queryParams = { ...params };
    if (table === "customers" && "customer_id" in queryParams) {
      queryParams.id = queryParams.customer_id;
      delete queryParams.customer_id;
    }

    const selectCols = readColumns.join(",");
    let query = supabaseAdmin.from(table).select(selectCols);

    // Apply filters from params
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    // Apply max_results if configured
    const maxResults = config.max_results || 100;
    query = query.limit(maxResults);

    const { data, error } = await query;
    if (error) throw new Error(`DB select error: ${error.message}`);

    // ====== MERGE LOGIC: customers + leads ======
    // If querying customers, try to enrich with lead data
    if (table === "customers" && data && data.length > 0) {
      try {
        const enrichedData = await Promise.all(
          data.map(async (customer: any) => {
            // Try to find related lead
            const { data: relatedLeads } = await supabaseAdmin
              .from("leads")
              .select("id, name, email, phone, cpf, city, state, status_client, observacao")
              .or(`customer_id.eq.${customer.id},phone.eq.${customer.phone}`)
              .limit(1);

            if (relatedLeads && relatedLeads.length > 0) {
              const lead = relatedLeads[0];
              return {
                ...customer,
                // Prefer lead data if available, fallback to customer
                name: lead.name || customer.name,
                email: lead.email || null,
                cpf: lead.cpf || null,
                city: lead.city || null,
                state: lead.state || null,
                status_client: lead.status_client || null,
                lead_id: lead.id,
                lead_observacao: lead.observacao,
              };
            }
            return customer;
          })
        );
        return { success: true, data: enrichedData };
      } catch (mergeError) {
        console.warn("[toolHandlers] Failed to merge customer with lead data:", mergeError);
        // Return customer data only if merge fails
        return { success: true, data };
      }
    }

    return { success: true, data };
  }

  throw new Error(`Unsupported action '${action}' for INTERNAL_DB handler.`);
}

// ====== Handler: HTTP ======
async function handleHTTP(
  tool: Tool,
  config: Record<string, any>,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { url, method, headers } = config;
  if (!url) throw new Error("handler_config.url is required for HTTP");

  const fetchHeaders = new Headers(headers || {});
  if (!fetchHeaders.has("Content-Type")) fetchHeaders.set("Content-Type", "application/json");

  const res = await fetch(url, {
    method: method || "POST",
    headers: fetchHeaders,
    body: JSON.stringify(params),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${data?.error || res.statusText}`);
  }

  return { success: true, data };
}

// ====== Handler: WORKFLOW ======
async function handleWorkflow(
  tool: Tool,
  config: Record<string, any>,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { action, emit_event, target_queue } = config;

  if (action === "handoff") {
    const targetAgentId = params.target_agent_id || null;
    
    // Se handoff é para outro agente de IA, atualizar chat.ai_agent_id
    if (targetAgentId && typeof targetAgentId === "string") {
      try {
        const { supabaseAdmin } = await import("../lib/supabase.ts");
        
        // Validar se target_agent_id é um agente válido e ativo
        const { data: targetAgent } = await supabaseAdmin
          .from("agents")
          .select("id, name, status")
          .eq("id", targetAgentId)
          .maybeSingle();

        if (targetAgent && targetAgent.status === "ACTIVE") {
          // Atualizar o agente do chat
          await supabaseAdmin
            .from("chats")
            .update({ ai_agent_id: targetAgentId })
            .eq("id", context.chatId);

          // Invalidar cache
          const { rDel, k } = await import("../lib/redis.ts");
          await rDel(k.chat(context.chatId));

          // Emitir evento socket
          const io = getIO();
          if (io) {
            io.to(`chat:${context.chatId}`).emit("chat:agent-changed", {
              kind: "livechat.chat.agent-changed",
              chatId: context.chatId,
              ai_agent_id: targetAgentId,
              ai_agent_name: targetAgent.name,
              reason: params.reason || "Transferência automática",
            });
          }

          console.log(`[handoff] Chat ${context.chatId} transferred from agent ${context.agentId} to ${targetAgentId}`);
          
          return { 
            success: true, 
            data: { 
              message: `Chat transferido para agente ${targetAgent.name}`,
              target_agent_id: targetAgentId,
              target_agent_name: targetAgent.name,
            } 
          };
        }
      } catch (error) {
        console.error("[handoff] Failed to transfer to AI agent:", error);
      }
    }

    // Fallback: handoff para humano/fila (comportamento antigo)
    const io = getIO();
    if (emit_event && io) {
      io.to(`chat:${context.chatId}`).emit(emit_event, {
        agent_id: context.agentId,
        target_agent_id: targetAgentId,
        reason: params.reason,
        context_summary: params.context_summary,
        target_queue: target_queue || "human_support",
      });
    }
    return { success: true, data: { message: "Handoff requested", target_queue } };
  }

  throw new Error(`Unsupported workflow action: ${action}`);
}

// ====== Handler: SOCKET ======
async function handleSocket(
  tool: Tool,
  config: Record<string, any>,
  params: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { event, room } = config;
  if (!event) throw new Error("handler_config.event is required for SOCKET");

  const targetRoom = room || `chat:${context.chatId}`;
  const io = getIO();
  if (io) {
    io.to(targetRoom).emit(event, params);
  }

  return { success: true, data: { message: `Event '${event}' emitted to '${targetRoom}'` } };
}

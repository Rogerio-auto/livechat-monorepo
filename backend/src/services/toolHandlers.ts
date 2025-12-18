// services/toolHandlers.ts
// Executores de ferramentas com validação granular de acesso a colunas

import { supabaseAdmin } from "../lib/supabase";
import type { Tool, AgentTool } from "../repos/tools.repo";
import { logToolExecution } from "../repos/tools.repo";
import { getIO, hasIO } from "../lib/io";
import { sendInteractiveButtons, sendInteractiveList } from "./meta/graph";

export type ToolExecutionContext = {
  agentId: string;
  chatId: string;
  contactId?: string;
  leadId?: string;
  userId?: string;
  companyId?: string; // Added for knowledge base queries
  isPlayground?: boolean;
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

  // Auto-preencher identificadores ausentes vindos do contexto
  // Ex.: ferramentas que exigem customer_id, mas o LLM não passou (ou passou 'undefined')
  if ((requiredCols.includes("customer_id") || table === "customers") && (params.customer_id === undefined || params.customer_id === null || params.customer_id === "undefined" || params.customer_id === "")) {
    if (context.contactId) {
      params.customer_id = context.contactId;
    }
    // Fallback: tentar buscar customer_id via chat se ainda não definido
    if (!params.customer_id && context.chatId) {
      try {
        const { data: chatRow, error: chatErr } = await supabaseAdmin
          .from("chats")
          .select("customer_id")
          .eq("id", context.chatId)
          .maybeSingle();
        if (!chatErr && chatRow?.customer_id) {
          params.customer_id = chatRow.customer_id;
        }
      } catch {}
    }

    // Fallback para Playground: se ainda não tem customer_id, pega o primeiro da empresa
    if (!params.customer_id && context.isPlayground && context.companyId) {
      try {
        const { data: firstCustomer } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("company_id", context.companyId)
          .limit(1)
          .maybeSingle();
        if (firstCustomer?.id) {
          params.customer_id = firstCustomer.id;
          console.log(`[toolHandlers] Playground mode: using fallback customer_id ${params.customer_id}`);
        }
      } catch {}
    }
  }
  if ((requiredCols.includes("chat_id") || table === "chats") && (params.chat_id === undefined || params.chat_id === null || params.chat_id === "undefined" || params.chat_id === "")) {
    if (context.chatId) {
      params.chat_id = context.chatId;
    }
  }
  if ((requiredCols.includes("agent_id") || table === "agents") && (params.agent_id === undefined || params.agent_id === null || params.agent_id === "undefined" || params.agent_id === "")) {
    if (context.agentId) {
      params.agent_id = context.agentId;
    }
  }

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

  // ====== SPECIAL CASE: List Departments (READ-ONLY) ======
  if (table === "departments" && action === "select") {
    if (!context.companyId) {
      throw new Error("companyId is required to list departments");
    }

    // Auto-filtrar apenas departamentos da empresa do agente
    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("id, name, description, color, icon")
      .eq("company_id", context.companyId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("[toolHandlers] list_departments error:", error);
      throw new Error(`Failed to list departments: ${error.message}`);
    }

    console.log(`[toolHandlers] Listed ${data?.length || 0} departments for company ${context.companyId}`);
    return { success: true, data: data || [] };
  }

  // ====== WRITE operations: validate allowed_columns.write ======
  if (action === "insert" || action === "update" || action === "upsert") {
    const writeColumns = (allowed_columns?.write as string[]) || [];

    // 1. Check restricted columns
    for (const col of Object.keys(params)) {
      if (restrictedCols.includes(col)) {
        throw new Error(`Access to column '${col}' is restricted.`);
      }
      // 2. Check allowed write columns (skip ID fields and identifier aliases)
      const idAliases = ["id", "contact_id", "agent_id", "chat_id", ...requiredCols];
      if (!writeColumns.includes(col) && !idAliases.includes(col)) {
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

    // 5. Special handling for events: assign default calendar_id, created_by_id, customer_id, lead_id
    if (table === "events" && action === "insert") {
      if (!finalParams.calendar_id) {
        // Try user default calendar first
        if (context.userId) {
          const { data: cal } = await supabaseAdmin
            .from("calendars")
            .select("id")
            .eq("owner_id", context.userId)
            .eq("is_default", true)
            .maybeSingle();
          if (cal?.id) {
            finalParams.calendar_id = cal.id;
          } else {
            const { data: firstCal } = await supabaseAdmin
              .from("calendars")
              .select("id")
              .eq("owner_id", context.userId)
              .limit(1)
              .maybeSingle();
            if (firstCal?.id) finalParams.calendar_id = firstCal.id;
          }
        }
        // Fallback to company default calendar
        if (!finalParams.calendar_id && context.companyId) {
          const { data: companyDefault } = await supabaseAdmin
            .from("calendars")
            .select("id")
            .eq("company_id", context.companyId)
            .eq("is_default", true)
            .maybeSingle();
          if (companyDefault?.id) {
            finalParams.calendar_id = companyDefault.id;
          } else {
            const { data: companyFirst } = await supabaseAdmin
              .from("calendars")
              .select("id")
              .eq("company_id", context.companyId)
              .limit(1)
              .maybeSingle();
            if (companyFirst?.id) finalParams.calendar_id = companyFirst.id;
          }
        }
        if (!finalParams.calendar_id) {
          throw new Error("No calendar available. Call list_calendars first to choose a calendar_id.");
        }
      }
      if (!finalParams.created_by_id && context.userId) {
        finalParams.created_by_id = context.userId;
      }
      // Auto-preencher customer_id do contexto (contactId)
      if (!finalParams.customer_id && context.contactId) {
        finalParams.customer_id = context.contactId;
      }
      // Auto-preencher lead_id se disponível no contexto
      if (!finalParams.lead_id && context.leadId) {
        finalParams.lead_id = context.leadId;
      }
    }

    // Adicionar company_id automaticamente se a tabela requer e não foi fornecido
    if (table === "customers" && !finalParams.company_id && context.companyId) {
      finalParams.company_id = context.companyId;
    }

    // ====== SPECIAL CASE: Transfer to Department (SECURITY VALIDATION) ======
    if (table === "chats" && action === "update" && finalParams.department_id) {
      if (!context.companyId) {
        throw new Error("companyId is required to transfer to department");
      }

      // SECURITY: Validate that department belongs to the same company as the agent
      const { data: dept, error: deptError } = await supabaseAdmin
        .from("departments")
        .select("id, company_id, name")
        .eq("id", finalParams.department_id)
        .eq("is_active", true)
        .maybeSingle();

      if (deptError) {
        console.error("[toolHandlers] transfer_to_department validation error:", deptError);
        throw new Error(`Failed to validate department: ${deptError.message}`);
      }

      if (!dept) {
        throw new Error(`Department not found or inactive: ${finalParams.department_id}`);
      }

      if (dept.company_id !== context.companyId) {
        console.error("[toolHandlers] SECURITY: Attempt to transfer to department from different company", {
          agentCompanyId: context.companyId,
          departmentCompanyId: dept.company_id,
          departmentId: finalParams.department_id,
          chatId: context.chatId
        });
        throw new Error("Security violation: Cannot transfer to department from another company");
      }

      console.log(`[toolHandlers] Transferring chat ${context.chatId} to department ${dept.name} (${dept.id})`);

      // Set default routing metadata
      if (!finalParams.routed_at) {
        finalParams.routed_at = new Date().toISOString();
      }
      
      // Store the reason in routing_reason field
      if (finalParams.reason) {
        finalParams.routing_reason = finalParams.reason;
        delete finalParams.reason; // Remove 'reason' as it's not a column in chats table
      }

      // Log to chat_routing_history after successful update
      // We'll do this after the update succeeds (see below)
    }

    // 6. Execute operation
    if (context.isPlayground && (action === "insert" || action === "update" || action === "upsert" || action === "delete")) {
      console.log(`[toolHandlers] Playground mode: SIMULATING ${action} on table ${table}`, finalParams);
      
      // Retornar um mock que parece um resultado real do banco
      return { 
        success: true, 
        data: action === "delete" ? null : [{ 
          id: finalParams.id || "playground-mock-id", 
          ...finalParams, 
          created_at: new Date().toISOString() 
        }] 
      };
    }

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

      // ====== POST-UPDATE: Log department transfer to routing history ======
      if (table === "chats" && finalParams.department_id && data && data.length > 0) {
        try {
          const chat = data[0];
          await supabaseAdmin
            .from("chat_routing_history")
            .insert({
              chat_id: chat.id,
              from_department_id: null, // Could track previous department if needed
              to_department_id: finalParams.department_id,
              routed_by_type: "AI_AGENT",
              routed_by_id: context.agentId,
              reason: finalParams.routing_reason || "Transferred by AI agent",
              priority: 0
            });
          
          console.log(`[toolHandlers] Logged routing history for chat ${chat.id} to department ${finalParams.department_id}`);
        } catch (historyError) {
          console.warn("[toolHandlers] Failed to log routing history:", historyError);
          // Don't fail the operation if logging fails
        }
      }

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
            
            // Use custom lead_mapping if provided, otherwise default mapping
            const leadMapping = config.lead_mapping || {
              name: "name",
              phone: "phone",
              email: "email",
              address: "street",
              city: "city",
              state: "state",
              zip_code: "cep",
              birth_date: "birthDate"
            };

            // Apply mapping: customers.field_name → leads.mapped_field_name
            for (const [customerField, leadField] of Object.entries(leadMapping)) {
              if (finalParams[customerField] !== undefined) {
                leadUpdates[leadField as string] = finalParams[customerField];
              }
            }
            
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
      // Map alias parameters to real columns for customers table
      if (table === "customers" && "customer_id" in finalParams) {
        finalParams.id = finalParams.customer_id;
        delete finalParams.customer_id;
      }

      // Adicionar company_id automaticamente se não foi fornecido
      if (table === "customers" && !finalParams.company_id && context.companyId) {
        finalParams.company_id = context.companyId;
      }

      // Use conflict_target from handler_config, or default to 'phone' for customers
      let upsertOptions: any = {};
      const conflictTarget = config.conflict_target || (table === "customers" ? "phone" : undefined);
      
      if (conflictTarget) {
        upsertOptions.onConflict = conflictTarget;
      }

      const { data, error } = await supabaseAdmin
        .from(table)
        .upsert(finalParams, upsertOptions)
        .select();
      
      if (error) throw new Error(`DB upsert error: ${error.message}`);

      // ====== SYNC LOGIC: customers <-> leads ======
      // If sync_to_leads is enabled and we're upserting customers, sync to related lead
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
              
              console.log(`[toolHandlers] Synced upserted customer ${customer.id} to lead ${leadId}`, leadUpdates);
            }
          }
        } catch (syncError) {
          console.warn("[toolHandlers] Failed to sync upserted customer to lead:", syncError);
          // Don't fail the whole operation if sync fails
        }
      }

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

    // Automatically scope calendars to company
    if (table === "calendars" && context.companyId) {
      query = query.eq("company_id", context.companyId);
    }

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

  // Simulação para Playground em métodos de escrita
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes((method || "POST").toUpperCase());
  if (context.isPlayground && isWrite) {
    console.log(`[toolHandlers] Playground mode: SIMULATING HTTP ${method || 'POST'} to ${url}`);
    return { 
      success: true, 
      data: { 
        message: "Simulação de chamada externa (Playground)",
        url: url,
        method: method || "POST",
        params: params 
      } 
    };
  }

  const fetchHeaders = new Headers(headers || {});
  if (!fetchHeaders.has("Content-Type")) fetchHeaders.set("Content-Type", "application/json");

  const res = await fetch(url, {
    method: method || "POST",
    headers: fetchHeaders,
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // If response is not JSON, treat as text
    data = text;
  }

  if (!res.ok) {
    const errorDetails = (typeof data === 'object' && data?.error) 
      ? data.error 
      : (typeof data === 'string' ? data : res.statusText);
    throw new Error(`HTTP error ${res.status}: ${errorDetails}`);
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

  // Simulação para Playground
  if (context.isPlayground && action === "handoff") {
    console.log(`[toolHandlers] Playground mode: SIMULATING handoff to ${target_queue || 'human'}`);
    return { 
      success: true, 
      data: { 
        message: "Simulação de transferência (Playground)",
        target_queue: target_queue || "human_support",
        reason: params.reason
      } 
    };
  }

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

          // Emitir evento socket (se disponível)
          if (hasIO()) {
            const io = getIO();
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

    // Fallback: handoff para humano/fila (atualizar status do chat)
    try {
      const { supabaseAdmin } = await import("../lib/supabase.ts");
      
      // Atualizar status do chat para OPEN (aguardando humano)
      await supabaseAdmin
        .from("chats")
        .update({ 
          status: "OPEN",
          ai_agent_id: null // Remove o agente IA
        })
        .eq("id", context.chatId);

      // Invalidar cache
      const { rDel, k } = await import("../lib/redis.ts");
      await rDel(k.chat(context.chatId));

      console.log(`[handoff] Chat ${context.chatId} transferred to human support`);
    } catch (error) {
      console.error("[handoff] Failed to update chat status:", error);
    }

    // Emitir evento socket (se disponível)
    if (hasIO() && emit_event) {
      const io = getIO();
      io.to(`chat:${context.chatId}`).emit(emit_event, {
        agent_id: context.agentId,
        target_agent_id: targetAgentId,
        reason: params.reason,
        context_summary: params.context_summary,
        target_queue: target_queue || "human_support",
      });
    }
    
    return { 
      success: true, 
      data: { 
        message: "Chat transferido para atendimento humano", 
        target_queue: target_queue || "human_support",
        reason: params.reason,
      } 
    };
  }

  // ====== ACTION: availability ======
  if (action === "availability") {
    if (!context.companyId) {
      throw new Error("companyId is required for availability check");
    }

    const {
      date,
      interval_minutes = 60,
      turno = 'FULL',
      owner_id = null,
      calendar_id = null,
      min_notice_minutes = 30,
      max_slots = 10
    } = params;

    if (!date) {
      throw new Error("Parameter 'date' is required for availability check");
    }

    // Chamar RPC compute_available_slots
    const { data: slots, error } = await supabaseAdmin.rpc("compute_available_slots", {
      p_company_id: context.companyId,
      p_date: date,
      p_interval_minutes: interval_minutes,
      p_owner_id: owner_id,
      p_calendar_id: calendar_id,
      p_turno: turno,
      p_min_notice_minutes: min_notice_minutes,
      p_max_slots: max_slots
    });

    if (error) {
      console.error("[availability] RPC error:", error);
      throw new Error(`Availability check error: ${error.message}`);
    }

    // Formatar resposta
    return {
      success: true,
      data: {
        slots: slots || [],
        meta: {
          date,
          interval_minutes,
          turno,
          total_slots: (slots || []).length,
          calendar_id: calendar_id || 'auto-detected',
          owner_id: owner_id || 'default'
        }
      }
    };
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
  const { event, room, validate_inbox, allowed_providers } = config;
  if (!event) throw new Error("handler_config.event is required for SOCKET");

  let inboxId: string | undefined;
  let provider: string | undefined;
  let customerPhone: string | undefined;

  // 1. Validar provider da inbox se necessário (para ferramentas interativas)
  if (validate_inbox) {
    // No Playground, simulamos os dados da inbox para não quebrar a execução
    if (context.isPlayground) {
      inboxId = "playground-inbox";
      customerPhone = "5511999999999";
      provider = "META_CLOUD";
    } else {
      // Join com customers para pegar o telefone
      const { data: chatData, error } = await supabaseAdmin
        .from("chats")
        .select("inbox_id, customers(phone), inboxes!inner(provider)")
        .eq("id", context.chatId)
        .single();

      if (error || !chatData?.inboxes) {
        console.error("[SOCKET] Error fetching chat data:", error);
        throw new Error("Não foi possível identificar a inbox do chat (Erro DB)");
      }

      inboxId = chatData.inbox_id;
      // Acessar telefone via relação customers
      customerPhone = (chatData.customers as any)?.phone;
      provider = (chatData.inboxes as any).provider?.toUpperCase();
    }

    const allowedProviders = Array.isArray(allowed_providers) ? allowed_providers : ["META_CLOUD"];

    if (!allowedProviders.includes(provider)) {
      throw new Error(
        `Interatividade só funciona com providers: ${allowedProviders.join(", ")}. ` +
        `Provider atual: ${provider}.`
      );
    }
  }

  // 2. Enviar via Meta API se for o caso
  if (provider === "META_CLOUD" && inboxId && customerPhone) {
    // No Playground, apenas simulamos o envio com sucesso
    if (context.isPlayground) {
      console.log(`[SOCKET] Playground mode: skipping real Meta API call for ${event}`);
      return { 
        success: true, 
        data: { 
          message: "Simulação de envio interativo (Playground)",
          params: params 
        } 
      };
    }

    try {
      if (event === "send:interactive_message") {
        // Validação básica de botões
        if (!params.message || !Array.isArray(params.buttons)) {
          throw new Error("Parâmetros inválidos para botões (message, buttons)");
        }
        
        await sendInteractiveButtons({
          inboxId,
          chatId: context.chatId,
          customerPhone,
          message: params.message,
          buttons: params.buttons,
          footer: params.footer,
          senderSupabaseId: context.userId,
        });
      } else if (event === "send:interactive_list") {
        // Validação básica de lista
        if (!params.message || !Array.isArray(params.sections)) {
          throw new Error("Parâmetros inválidos para lista (message, sections)");
        }

        await sendInteractiveList({
          inboxId,
          chatId: context.chatId,
          customerPhone,
          message: params.message,
          buttonText: params.buttonText || "Abrir Menu",
          sections: params.sections,
          footer: params.footer,
          senderSupabaseId: context.userId,
        });
      }
    } catch (error: any) {
      console.error(`[SOCKET] Failed to send interactive message via Meta API:`, error);
      throw new Error(`Erro ao enviar mensagem interativa: ${error.message}`);
    }
  }

  // 3. Emitir Socket para Frontend (UI)
  // Isso garante que o operador veja os botões/listas que foram enviados
  const targetRoom = room || `chat:${context.chatId}`;
  
  if (hasIO()) {
    const io = getIO();
    const payload = {
      chatId: context.chatId,
      agentId: context.agentId,
      contactId: context.contactId,
      ...params,
      timestamp: new Date().toISOString()
    };

    io.to(targetRoom).emit(event, payload);
    console.log(`[SOCKET] Event '${event}' emitted to room '${targetRoom}'`);
  } else {
    console.warn(`[SOCKET] Socket.IO not available, event '${event}' not emitted to '${targetRoom}'`);
  }

  return { 
    success: true, 
    data: { 
      message: `Mensagem interativa enviada com sucesso`,
      event,
      room: targetRoom,
      provider: provider || "SOCKET_ONLY"
    } 
  };
}

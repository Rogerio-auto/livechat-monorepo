import { supabaseAdmin } from "../lib/supabase.js";
import * as flowsRepo from "../repos/flows.repo.js";
import { EX_APP, publish, publishApp } from "../queue/rabbit.js";
import { logger } from "../lib/logger.js";
import { sendInteractiveButtons, sendInteractiveList } from "./meta/graph.ts";
import { NotificationService } from "./NotificationService.ts";
import { normalizeMsisdn } from "../util.ts";
import * as store from "./meta/store.ts";

/**
 * Replace variables in a string
 */
function replaceVariables(text: string, variables: any): string {
  if (!text) return "";
  return text.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}

/**
 * Get or create a contact ID for a system user (responsible)
 */
export async function getContactIdForUser(userId: string, companyId: string): Promise<string | null> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("phone, name")
    .eq("id", userId)
    .maybeSingle();

  if (!user || !user.phone) {
    logger.warn(`[FlowEngine] User ${userId} has no phone number, cannot create contact`);
    return null;
  }

  // Find existing customer with this phone
  const msisdn = normalizeMsisdn(user.phone);
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("company_id", companyId)
    .eq("phone", msisdn)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new customer
  const { data: created, error } = await supabaseAdmin
    .from("customers")
    .insert({
      company_id: companyId,
      phone: msisdn,
      name: user.name || "Usuário do Sistema",
      source: "SYSTEM"
    })
    .select("id")
    .single();

  if (error) {
    logger.error("[FlowEngine] Error creating customer for user", error);
    return null;
  }

  return created.id;
}

/**
 * Trigger a flow for a contact based on an event
 */
export async function triggerFlow(params: {
  companyId: string;
  contactId: string | null;
  chatId?: string;
  triggerType: 'STAGE_CHANGE' | 'TAG_ADDED' | 'KEYWORD' | 'LEAD_CREATED' | 'NEW_MESSAGE' | 'SYSTEM_EVENT' | 'MANUAL';
  triggerData: any;
}) {
  let { companyId, contactId, chatId, triggerType, triggerData } = params;

  logger.info(`[FlowEngine] ⚡ Triggering flow: type=${triggerType}, event=${triggerData?.event}, company=${companyId}`);

  // 1. Resolve Rich context for SYSTEM_EVENT
  if (triggerType === 'SYSTEM_EVENT') {
    try {
      const richContext = await resolveRichSystemContext(companyId, triggerData);
      triggerData = { ...triggerData, ...richContext };
      
      // If we don't have a contactId but we have a responsible phone, we might use that as default contact
      if (!contactId && triggerData.responsible_phone) {
        // We will resolve/create contact in a moment or within the loop if needed
        // For now, let's keep it null and handle it per-flow targeting
      }
    } catch (err) {
      logger.error("[FlowEngine] Error resolving rich system context", err);
    }
  }

  // 1.1 Find active flows for this company
  const { data: flows, error } = await supabaseAdmin
    .from("automation_flows")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "ACTIVE");

  if (error || !flows) {
    logger.warn(`[FlowEngine] No active flows found for company ${companyId}`);
    return;
  }

  logger.info(`[FlowEngine] Found ${flows.length} active flows. Checking filters...`);

  // Cache for contact context (tags and stage) to avoid multiple DB calls
  let contactContext: { stageId: string | null, tags: string[] } | null = null;

  for (const flow of flows) {
    const config = flow.trigger_config || {};
    let shouldTrigger = false;

    if (config.type === triggerType) {
      if (triggerType === 'STAGE_CHANGE') {
        if (config.column_id === triggerData.column_id) shouldTrigger = true;
      } else if (triggerType === 'TAG_ADDED') {
        if (config.tag_id === triggerData.tag_id) shouldTrigger = true;
      } else if (triggerType === 'KEYWORD') {
        if (config.keyword && triggerData.text?.toLowerCase().includes(config.keyword.toLowerCase())) {
          shouldTrigger = true;
        }
      } else if (triggerType === 'LEAD_CREATED') {
        const inboxMatch = !config.inbox_id || config.inbox_id === triggerData.inbox_id;
        if (inboxMatch) shouldTrigger = true;
      } else if (triggerType === 'NEW_MESSAGE') {
        // Check inbox filter
        const inboxMatch = !config.inbox_id || config.inbox_id === triggerData.inbox_id;
        
        // Check message type filter
        const typeMatch = !config.message_types?.length || 
                         config.message_types.includes(triggerData.type?.toLowerCase());

        if (inboxMatch && typeMatch) shouldTrigger = true;
      } else if (triggerType === 'SYSTEM_EVENT') {
        // Match specific system event (e.g. TASK_CREATED)
        if (!config.event || config.event === triggerData.event) {
          shouldTrigger = true;
        } else {
          logger.debug(`[FlowEngine] Flow ${flow.id} event mismatch: expected ${config.event}, got ${triggerData.event}`);
        }
      }

      // Apply additional conditions (Stage and Tags) if any
      if (shouldTrigger) {
        if (!contactId && triggerType !== 'MANUAL') {
          logger.warn(`[FlowEngine] Flow ${flow.id} matched but contactId is NULL. Skipping execution.`);
          continue;
        }

        // Check if we have conditions that require contact context
        const hasStageCondition = !!config.filter_stage_id;
        const hasTagsCondition = !!(config.filter_tag_ids && config.filter_tag_ids.length > 0);

        if (hasStageCondition || hasTagsCondition) {
          if (!contactId) {
             logger.warn(`[FlowEngine] Flow ${flow.id} has conditions but contactId is NULL. Skipping.`);
             continue;
          }
          // Fetch context if not already cached
          if (!contactContext) {
            try {
              const [tagsRes, cardRes] = await Promise.all([
                supabaseAdmin.from("customer_tags").select("tag_id").eq("customer_id", contactId),
                supabaseAdmin.from("kanban_cards").select("kanban_column_id").eq("lead_id", contactId).maybeSingle()
              ]);
              contactContext = {
                stageId: cardRes.data?.kanban_column_id || null,
                tags: tagsRes.data?.map(t => t.tag_id) || []
              };
            } catch (err) {
              logger.error("[FlowEngine] Error fetching contact context for filters", err);
              // If we can't fetch context, we fail safe and don't trigger
              shouldTrigger = false;
            }
          }

          if (shouldTrigger && contactContext) {
            // 1. Stage Filter
            if (hasStageCondition && config.filter_stage_id !== contactContext.stageId) {
              shouldTrigger = false;
            }

            // 2. Tags Filter (OR logic: must have at least one of the specified tags)
            if (shouldTrigger && hasTagsCondition) {
              const hasMatch = config.filter_tag_ids.some((tid: string) => contactContext!.tags.includes(tid));
              if (!hasMatch) shouldTrigger = false;
            }
          }
        }
      }
    }

    if (shouldTrigger) {
      await startFlowExecution(flow, contactId, triggerData, chatId, triggerType);
    }
  }
}

/**
 * Manually trigger a specific flow for a contact
 */
export async function triggerManualFlow(params: {
  companyId: string;
  flowId: string;
  contactId: string;
  chatId?: string;
  variables?: any;
  userId?: string; // User who triggered it
}) {
  const { companyId, flowId, contactId, chatId, variables, userId } = params;

  const { data: flow, error } = await supabaseAdmin
    .from("automation_flows")
    .select("*")
    .eq("id", flowId)
    .eq("company_id", companyId)
    .single();

  if (error || !flow) {
    throw new Error("Flow not found or inactive");
  }

  let finalVariables = { ...variables };

  // 1. Create a system message in the chat
  if (chatId) {
    // Ensure we have the inbox_id in variables if it's missing
    if (!finalVariables.inbox_id) {
      const { data: chat } = await supabaseAdmin
        .from("chats")
        .select("inbox_id")
        .eq("id", chatId)
        .maybeSingle();
      if (chat?.inbox_id) {
        finalVariables.inbox_id = chat.inbox_id;
      }
    }

    let senderName = "Sistema";
    if (userId) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      if (user?.name) senderName = user.name;
    }

    await supabaseAdmin.from("chat_messages").insert({
      chat_id: chatId,
      content: `${senderName} iniciou o fluxo "${flow.name}"`,
      type: "SYSTEM",
      is_from_customer: false,
      view_status: "Sent"
    });
  }

  // 2. Notify the user (if provided)
  if (userId) {
    await NotificationService.create({
      title: "Fluxo Iniciado",
      message: `O fluxo "${flow.name}" foi iniciado com sucesso.`,
      type: "SYSTEM",
      userId: userId,
      companyId: companyId,
      category: "system",
      priority: "NORMAL"
    }).catch(err => logger.error("[FlowEngine] Notification error:", err));
  }

  await startFlowExecution(flow, contactId, finalVariables, chatId, 'MANUAL');
}

/**
 * Start a new execution of a flow for a contact
 */
async function startFlowExecution(
  flow: any, 
  contactId: string, 
  triggerData: any, 
  chatId?: string, 
  triggerType?: string
) {
  // Check if contact is already in this flow
  const { data: existing } = await supabaseAdmin
    .from("flow_executions")
    .select("id, status, updated_at")
    .eq("flow_id", flow.id)
    .eq("contact_id", contactId)
    .in("status", ["RUNNING", "WAITING"])
    .maybeSingle();

  if (existing) {
    const updatedAt = new Date(existing.updated_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
    
    // Production Logic:
    // 1. Keywords ALWAYS restart the flow (high priority)
    // 2. Manual triggers ALWAYS restart
    // 3. If the flow is stuck for more than 15 minutes, restart it
    const shouldRestart = triggerType === 'KEYWORD' || triggerType === 'MANUAL' || diffMinutes > 15;

    if (shouldRestart) {
      logger.info(`[FlowEngine] Restarting flow ${flow.id} for contact ${contactId}. Reason: ${triggerType || 'Stuck'}`);
      await supabaseAdmin
        .from("flow_executions")
        .update({ 
          status: 'CANCELLED', 
          last_error: `Superseded by ${triggerType} trigger` 
        })
        .eq("id", existing.id);
    } else {
      // For NEW_MESSAGE or LEAD_CREATED, if already running, we skip to avoid duplicates
      logger.info(`[FlowEngine] Contact ${contactId} already active in flow ${flow.id}. Skipping new ${triggerType} trigger.`);
      return;
    }
  }

  // Find the start node
  const startNode = flow.nodes.find((n: any) => n.type === 'trigger' || n.data?.isStart);
  if (!startNode) {
    logger.error(`[FlowEngine] No start node found for flow ${flow.id}`);
    return;
  }

  // Create execution
  const execution = await flowsRepo.createExecution({
    flow_id: flow.id,
    contact_id: contactId,
    status: 'RUNNING',
    current_node_id: startNode.id,
    variables: { 
      ...triggerData, 
      chat_id: chatId || contactId,
      inbox_id: triggerData?.inbox_id || flow.trigger_config?.inbox_id 
    }
  });

  logger.info(`[FlowEngine] Started execution ${execution.id} for flow ${flow.id} (Trigger: ${triggerType})`);

  // Queue the first step
  await queueNextStep(execution.id);
}

/**
 * Queue the next step of an execution
 */
export async function queueNextStep(executionId: string) {
  await publish(EX_APP, "flow.execution", { executionId });
}

/**
 * Resume flows that are waiting for a customer response
 */
export async function resumeFlowWithResponse(chatId: string, message: any): Promise<boolean> {
  // 1. Fetch WAITING executions. 
  // We fetch all and filter in memory or use complex JSONB queries
  const { data: executions } = await supabaseAdmin
    .from("flow_executions")
    .select("id, variables")
    .eq("status", "WAITING");

  if (!executions || executions.length === 0) return false;

  let resumedAny = false;

  for (const exec of executions) {
    const vars = exec.variables || {};
    let shouldResume = false;

    // Check standard wait
    if (vars.waiting_for_response && vars.chat_id === chatId) {
      shouldResume = true;
    } 
    // Check external wait (manager/responsible)
    else if (vars.waiting_for_external) {
      // If we have external_chat_id (phone) or external_chat_uuid
      if (vars.external_chat_uuid === chatId) {
        shouldResume = true;
      } else if (vars.external_chat_id) {
        // If the message came from exactly the same identifier (e.g. phone)
        // This is useful for providers where chatId isn't a UUID yet
        if (vars.external_chat_id === chatId) shouldResume = true;
      }
    }

    if (shouldResume) {
      resumedAny = true;
      
      // Map button response if any
      let lastResponse = message.content;
      let edgeHandle = undefined;

      // If it's a Meta Button response, it might have a payload
      if (message.type === 'interactive' || message.payload) {
        lastResponse = message.payload || message.content;
        edgeHandle = lastResponse; // For branching
      }

      await supabaseAdmin
        .from("flow_executions")
        .update({ 
          status: 'RUNNING', 
          next_step_at: null,
          variables: { 
            ...vars, 
            responded: true,
            last_response: lastResponse,
            last_response_type: message.type,
            response_edge: edgeHandle
          } 
        })
        .eq("id", exec.id);
      
      await queueNextStep(exec.id);
    }
  }

  return resumedAny;
}

/**
 * Process a single step of a flow execution
 */
export async function processFlowStep(executionId: string) {
  const execution = await supabaseAdmin
    .from("flow_executions")
    .select("*, automation_flows(*)")
    .eq("id", executionId)
    .single();

  if (!execution.data || execution.data.status !== 'RUNNING') return;

  const flow = execution.data.automation_flows;
  const currentNodeId = execution.data.current_node_id;
  const currentNode = flow.nodes.find((n: any) => n.id === currentNodeId);

  if (!currentNode) {
    await flowsRepo.updateExecution(executionId, { status: 'FAILED', last_error: 'Node not found' });
    return;
  }

  try {
    // Execute current node logic
    const result = await executeNode(currentNode, execution.data);

    if (result.status === 'WAITING') {
      await flowsRepo.updateExecution(executionId, { 
        status: 'WAITING', 
        next_step_at: result.next_step_at 
      });
      return;
    }

    // Find next node
    const edge = flow.edges.find((e: any) => e.source === currentNodeId && (!result.edgeHandle || e.sourceHandle === result.edgeHandle));
    
    if (!edge) {
      // Flow finished
      await flowsRepo.updateExecution(executionId, { 
        status: 'COMPLETED', 
        finished_at: new Date().toISOString() 
      });
      return;
    }

    // Move to next node
    await flowsRepo.updateExecution(executionId, { 
      current_node_id: edge.target,
      variables: { ...execution.data.variables, ...result.variables }
    });

    // Queue next step immediately
    await queueNextStep(executionId);

  } catch (error: any) {
    logger.error(`[FlowEngine] Error executing node ${currentNodeId}: ${error.message}`);
    await flowsRepo.updateExecution(executionId, { 
      status: 'FAILED', 
      last_error: error.message 
    });
  }
}

async function sendFlowMessage(args: {
  nodeData: any,
  execution: any,
  customer: any
}) {
  const { nodeData: data, execution, customer } = args;
  const contactId = execution.contact_id;
  const inboxId = execution.variables?.inbox_id || execution.variables?.triggerData?.inbox_id;
  const chatId = execution.variables?.chat_id || contactId;
  const customerPhone = customer?.phone;
  const companyId = execution.automation_flows?.company_id;

  // Replace variables in text
  const textContent = replaceVariables(data.text || "", execution.variables || {});

  logger.info(`[FlowEngine] Sending message for execution ${execution.id}`, {
    inboxId,
    chatId,
    customerPhone,
    companyId,
    nodeType: data.type
  });

  // ... (rest of the content remains but needs to use textContent instead of data.text)

  // Fetch inbox to check provider for Smart Fallback
  let inboxProvider = 'META';
  if (inboxId) {
    const { data: inbox } = await supabaseAdmin
      .from("inboxes")
      .select("provider")
      .eq("id", inboxId)
      .maybeSingle();
    if (inbox?.provider) inboxProvider = inbox.provider;
  }

  const isMeta = inboxProvider === 'META' || inboxProvider === 'META_CLOUD';

  if (data.buttons?.length > 0 && inboxId && customerPhone && isMeta) {
    try {
      logger.info(`[FlowEngine] Attempting to send Meta buttons to ${customerPhone}`);
      const { message } = await sendInteractiveButtons({
        inboxId,
        chatId,
        customerPhone,
        message: textContent,
        buttons: data.buttons.map((b: any, i: number) => ({
          id: b.id || `btn_${i}`,
          title: b.text
        })),
        senderSupabaseId: null // System message
      });

      if (message && companyId) {
        await publishApp("socket.livechat.outbound", {
          kind: "livechat.outbound.message",
          chatId,
          companyId,
          inboxId,
          message: {
            ...message,
            body: message.content,
            sender_type: 'AI',
            is_private: false
          },
          chatUpdate: {
            chatId,
            inboxId,
            last_message: message.content,
            last_message_at: message.created_at,
            last_message_from: 'AI',
            last_message_type: message.type
          }
        });
      }

      return true;
    } catch (err) {
      logger.error(`[FlowEngine] Failed to send Meta buttons, falling back to text: ${err}`);
      // Fall through to text fallback
    }
  } 
  
  if (data.list_sections && inboxId && customerPhone && isMeta) {
    try {
      logger.info(`[FlowEngine] Attempting to send Meta list to ${customerPhone}`);
      const { message } = await sendInteractiveList({
        inboxId,
        chatId,
        customerPhone,
        message: textContent,
        buttonText: data.list_button_text || 'Ver Opções',
        sections: data.list_sections,
        senderSupabaseId: null
      });

      if (message && companyId) {
        await publishApp("socket.livechat.outbound", {
          kind: "livechat.outbound.message",
          chatId,
          companyId,
          inboxId,
          message: {
            ...message,
            body: message.content,
            sender_type: 'AI',
            is_private: false
          },
          chatUpdate: {
            chatId,
            inboxId,
            last_message: message.content,
            last_message_at: message.created_at,
            last_message_from: 'AI',
            last_message_type: message.type
          }
        });
      }

      return true;
    } catch (err) {
      logger.error(`[FlowEngine] Failed to send Meta list, falling back to text: ${err}`);
      // Fall through to text fallback
    }
  }

  if (data.media_url) {
    logger.info(`[FlowEngine] Sending media message to ${chatId}`);
    await publish(EX_APP, "outbound.request", {
      jobType: "meta.sendMedia",
      chatId,
      inboxId,
      companyId,
      public_url: data.media_url,
      caption: textContent,
      mime_type: data.media_type === 'IMAGE' ? 'image/png' : undefined,
      filename: data.media_name || (data.media_type === 'IMAGE' ? 'image.png' : (data.media_type === 'AUDIO' || data.media_type === 'VOICE' ? 'audio.ogg' : 'file')),
      is_voice: data.media_type === 'VOICE' || data.media_type === 'AUDIO'
    });
  } else {
    // Smart Fallback: Convert buttons/lists to text if not Meta or if Meta failed
    let finalContent = textContent;
    if (data.buttons?.length > 0) {
      finalContent += "\n\n" + data.buttons.map((b: any, i: number) => `${i + 1}️⃣ ${b.text}`).join("\n");
    } else if (data.list_sections) {
      const options = data.list_sections.flatMap((s: any) => 
        s.rows.map((r: any) => `🔹 ${r.title}${r.description ? ` (${r.description})` : ''}`)
      ).join("\n");
      finalContent += "\n\n" + options;
    }

    logger.info(`[FlowEngine] Sending text message to ${chatId}`);
    await publish(EX_APP, "outbound.request", {
      jobType: "message.send",
      customerId: contactId,
      chatId,
      companyId,
      content: finalContent,
      inboxId
    });
  }
  return true;
}

async function sendNotificationMessages(args: {
  inbox: any,
  customer: any,
  textContent: string,
  buttons: any[],
  companyId: string,
  chatId: string
}) {
  const { inbox, customer, textContent, buttons, companyId, chatId } = args;
  const isMeta = inbox.provider?.startsWith('META');

  // 1. Send Text Message first if BOTH exist, or if only text exists
  // User requested: "enviando duas mensagem caso os dois campos forem preenchido"
  if (textContent && buttons?.length > 0) {
    if (isMeta) {
      // Send text message first
      await publish(EX_APP, "outbound.request", {
        jobType: "message.send",
        customerId: customer.id,
        chatId,
        companyId,
        content: textContent,
        inboxId: inbox.id
      });
      // Small delay between messages would be nice but publish is async anyway
      // Now send buttons without text in the body (Meta requires body, so we use a generic header or the title)
      try {
        await sendInteractiveButtons({
          inboxId: inbox.id,
          chatId,
          customerPhone: customer.phone,
          message: "Escolha uma opção:", // Generic title for buttons when text was already sent
          buttons: buttons.map((b: any, i: number) => ({
            id: b.id || `btn_${i}`,
            title: b.text
          })),
          senderSupabaseId: null
        });
      } catch (err) {
        logger.error("[FlowEngine] Error sending buttons after text", err);
      }
    } else {
      // Non-Meta: Combine both in one message
      const finalContent = textContent + "\n\n" + buttons.map((b: any, i: number) => `${i + 1}️⃣ ${b.text}`).join("\n");
      await publish(EX_APP, "outbound.request", {
        jobType: "message.send",
        customerId: customer.id,
        chatId,
        companyId,
        content: finalContent,
        inboxId: inbox.id
      });
    }
  } else if (buttons?.length > 0) {
    // Only buttons
    if (isMeta) {
      try {
        await sendInteractiveButtons({
          inboxId: inbox.id,
          chatId,
          customerPhone: customer.phone,
          message: "Selecione uma opção:",
          buttons: buttons.map((b: any, i: number) => ({
            id: b.id || `btn_${i}`,
            title: b.text
          })),
          senderSupabaseId: null
        });
      } catch (err) {
        // Fallback to text
        const finalContent = buttons.map((b: any, i: number) => `${i + 1}️⃣ ${b.text}`).join("\n");
        await publish(EX_APP, "outbound.request", {
          jobType: "message.send",
          customerId: customer.id,
          chatId,
          companyId,
          content: finalContent,
          inboxId: inbox.id
        });
      }
    } else {
      const finalContent = buttons.map((b: any, i: number) => `${i + 1}️⃣ ${b.text}`).join("\n");
      await publish(EX_APP, "outbound.request", {
        jobType: "message.send",
        customerId: customer.id,
        chatId,
        companyId,
        content: finalContent,
        inboxId: inbox.id
      });
    }
  } else if (textContent) {
    // Only text
    await publish(EX_APP, "outbound.request", {
      jobType: "message.send",
      customerId: customer.id,
      chatId,
      companyId,
      content: textContent,
      inboxId: inbox.id
    });
  }
}

async function executeNode(node: any, execution: any): Promise<{ status: string, next_step_at?: string, variables?: any, edgeHandle?: string }> {
  const { type, data } = node;
  const contactId = execution.contact_id;

  // Fetch customer data for nodes that need it (like phone for Meta interactive messages)
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", contactId)
    .single();

  await flowsRepo.logFlowStep({
    execution_id: execution.id,
    flow_id: execution.flow_id,
    contact_id: contactId,
    node_id: node.id,
    action_type: type,
    status: 'INFO',
    message: `Executing node ${type}`
  });

  switch (type) {
    case 'interactive':
    case 'message':
      await sendFlowMessage({ nodeData: data, execution, customer });
      return { status: 'SUCCESS' };

    case 'wait_for_response':
      // Check if we were already waiting
      if (execution.variables?.waiting_for_response) {
        const hasResponded = execution.variables?.responded;
        
        // Clean up wait variables
        const cleanVars = { ...execution.variables };
        delete cleanVars.waiting_for_response;
        delete cleanVars.responded;

        if (hasResponded) {
          return { status: 'SUCCESS', edgeHandle: 'response', variables: cleanVars };
        } else {
          return { status: 'SUCCESS', edgeHandle: 'timeout', variables: cleanVars };
        }
      }

      // First time: Send message (if any) and set wait state
      if (data.text || data.media_url) {
        await sendFlowMessage({ nodeData: data, execution, customer });
      }

      const timeout = data.timeoutMinutes || 60;
      const timeoutAt = new Date();
      timeoutAt.setMinutes(timeoutAt.getMinutes() + timeout);

      return { 
        status: 'WAITING', 
        next_step_at: timeoutAt.toISOString(),
        variables: { 
          ...execution.variables, 
          waiting_for_response: true 
        } 
      };

    case 'switch':
      const switchVar = data.variable || 'last_response';
      const switchVal = execution.variables?.[switchVar] || '';
      return { status: 'SUCCESS', edgeHandle: String(switchVal).toLowerCase().trim() };

    case 'wait':
      const delayMinutes = data.delayMinutes || 1;
      const nextAt = new Date();
      nextAt.setMinutes(nextAt.getMinutes() + delayMinutes);
      return { status: 'WAITING', next_step_at: nextAt.toISOString() };

    case 'add_tag':
      // Add tag logic
      if (data.tag_id) {
        await supabaseAdmin.from("customer_tags").upsert({ customer_id: contactId, tag_id: data.tag_id });
      }
      return { status: 'SUCCESS' };

    case 'move_stage':
      // Move stage logic
      if (data.column_id) {
        await supabaseAdmin.from("kanban_cards").update({ kanban_column_id: data.column_id }).eq("lead_id", contactId);
      }
      return { status: 'SUCCESS' };

    case 'external_notify':
      const target = data.target || 'RESPONSIBLE'; // RESPONSIBLE, ENTITY_CUSTOMER, FLOW_CONTACT, CUSTOM
      let targetPhone = '';
      let targetName = '';

      if (target === 'RESPONSIBLE') {
        targetPhone = execution.variables?.responsible_phone;
        targetName = execution.variables?.responsible_name || 'Responsável';
      } else if (target === 'ENTITY_CUSTOMER') {
        targetPhone = execution.variables?.customer_phone;
        targetName = execution.variables?.customer_name || 'Cliente';
      } else if (target === 'FLOW_CONTACT') {
        targetPhone = customer?.phone;
        targetName = customer?.name || 'Contato';
      } else if (target === 'CUSTOM') {
        targetPhone = replaceVariables(data.custom_phone || '', execution.variables);
        targetName = 'Destinatário';
      }

      if (targetPhone) {
        const companyId = execution.automation_flows?.company_id;
        const phone = normalizeMsisdn(targetPhone);
        
        // 1. Find or Create Customer for the target
        let { data: finalCustomer } = await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("company_id", companyId)
          .eq("phone", phone)
          .maybeSingle();

        if (!finalCustomer) {
          const { data: created } = await supabaseAdmin
            .from("customers")
            .insert({
              company_id: companyId,
              phone: phone,
              name: targetName,
              source: "SYSTEM_FLOW"
            })
            .select("*")
            .single();
          finalCustomer = created;
        }

        if (finalCustomer) {
          // 2. Determine Inbox
          let selectedInboxId = data.inbox_id;
          
          if (!selectedInboxId) {
            // Fallback: Find first active non-META inbox
            const { data: fallbackInbox } = await supabaseAdmin
              .from("inboxes")
              .select("id")
              .eq("company_id", companyId)
              .eq("is_active", true)
              .not("provider", "ilike", "META%")
              .limit(1)
              .maybeSingle();
            selectedInboxId = fallbackInbox?.id;
          }

          if (selectedInboxId) {
            const { data: inbox } = await supabaseAdmin
              .from("inboxes")
              .select("*")
              .eq("id", selectedInboxId)
              .maybeSingle();

            if (inbox) {
              const textContent = replaceVariables(data.text || "", execution.variables);
              const isMeta = inbox.provider?.startsWith('META');
              const chatJid = `${phone}@c.us`; 
              const waChatId = isMeta ? phone : chatJid;

              // Check if we should wait for response
              if (data.wait_for_response && !execution.variables?.waiting_for_external) {
                // Try to find if a chat already exists to get the UUID (more reliable for resume)
                const { data: existingChat } = await supabaseAdmin
                  .from("chats")
                  .select("id")
                  .eq("customer_id", finalCustomer.id)
                  .eq("inbox_id", inbox.id)
                  .maybeSingle();

                // First time: Send message and set wait state
                await sendNotificationMessages({
                  inbox,
                  customer: finalCustomer,
                  textContent,
                  buttons: data.buttons,
                  companyId,
                  chatId: waChatId
                });

                const timeout = data.timeoutMinutes || 60;
                const timeoutAt = new Date();
                timeoutAt.setMinutes(timeoutAt.getMinutes() + timeout);

                return { 
                  status: 'WAITING', 
                  next_step_at: timeoutAt.toISOString(),
                  variables: { 
                    ...execution.variables, 
                    waiting_for_external: true,
                    external_customer_id: finalCustomer.id,
                    external_chat_id: waChatId,
                    external_chat_uuid: existingChat?.id
                  } 
                };
              } else if (execution.variables?.waiting_for_external) {
                // We are resuming
                const hasResponded = execution.variables?.responded;
                const edgeHandle = execution.variables?.response_edge;

                const cleanVars = { ...execution.variables };
                delete cleanVars.waiting_for_external;
                delete cleanVars.external_customer_id;
                delete cleanVars.external_chat_id;
                delete cleanVars.external_chat_uuid;
                delete cleanVars.responded;
                delete cleanVars.response_edge;

                if (hasResponded) {
                  return { status: 'SUCCESS', edgeHandle: edgeHandle || 'response', variables: cleanVars };
                } else {
                  return { status: 'SUCCESS', edgeHandle: 'timeout', variables: cleanVars };
                }
              }

              // Normal fire-and-forget send
              await sendNotificationMessages({
                inbox,
                customer: finalCustomer,
                textContent,
                buttons: data.buttons,
                companyId,
                chatId: waChatId
              });
            }
          }
        }
      }
      return { status: 'SUCCESS' };

    case 'change_status':
      const statusChatId = execution.variables?.chat_id;
      if (statusChatId && data.status) {
        await supabaseAdmin.from("chats").update({ status: data.status }).eq("id", statusChatId);
      }
      return { status: 'SUCCESS' };

    case 'ai_action':
      const chat_id = execution.variables?.chat_id;
      if (!chat_id) {
        logger.warn(`[FlowEngine] No chat_id found for ai_action in execution ${execution.id}`);
        return { status: 'SUCCESS' };
      }

      const { action, agent_id, destination_status, change_chat_status } = data;

      if (action === 'ACTIVATE') {
        const updateData: any = { ai_agent_id: agent_id };
        if (change_chat_status) updateData.status = change_chat_status;
        else updateData.status = 'AI'; // Default for activate

        await supabaseAdmin
          .from("chats")
          .update(updateData)
          .eq("id", chat_id);
      } else if (action === 'DEACTIVATE') {
        const updateData: any = { ai_agent_id: null };
        if (change_chat_status) updateData.status = change_chat_status;
        else updateData.status = destination_status || 'OPEN';

        await supabaseAdmin
          .from("chats")
          .update(updateData)
          .eq("id", chat_id);
      } else if (action === 'TRANSFER') {
        const updateData: any = { ai_agent_id: agent_id };
        if (change_chat_status) updateData.status = change_chat_status;
        else updateData.status = 'AI';

        await supabaseAdmin
          .from("chats")
          .update(updateData)
          .eq("id", chat_id);
      }
      return { status: 'SUCCESS' };

    case 'condition':
      let conditionMet = false;

      if (data.condition_type === 'HAS_TAG') {
        const { data: hasTag } = await supabaseAdmin
          .from("customer_tags")
          .select("id")
          .eq("customer_id", contactId)
          .eq("tag_id", data.tag_id)
          .maybeSingle();
        conditionMet = !!hasTag;
      } else if (data.condition_type === 'IN_STAGE') {
        const { data: card } = await supabaseAdmin
          .from("kanban_cards")
          .select("kanban_column_id")
          .eq("lead_id", contactId)
          .maybeSingle();
        conditionMet = card?.kanban_column_id === data.column_id;
      } else if (data.condition_type === 'BUSINESS_HOURS') {
        const now = new Date();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = now.getHours();
        // Simple business hours: Mon-Fri, 8am-6pm
        conditionMet = day >= 1 && day <= 5 && hour >= 8 && hour < 18;
      } else if (data.condition_type === 'HAS_VALUE') {
        const { data: contact } = await supabaseAdmin
          .from("customers")
          .select(data.field)
          .eq("id", contactId)
          .single();
        conditionMet = !!contact?.[data.field];
      } else if (data.condition_type === 'MSG_CONTAINS') {
        const msgText = execution.variables?.triggerData?.text || '';
        conditionMet = msgText.toLowerCase().includes((data.value || '').toLowerCase());
      } else if (data.condition_type === 'MSG_EQUALS') {
        const msgText = execution.variables?.triggerData?.text || '';
        conditionMet = msgText.toLowerCase().trim() === (data.value || '').toLowerCase().trim();
      }
      
      return { status: 'SUCCESS', edgeHandle: conditionMet ? 'true' : 'false' };

    default:
      return { status: 'SUCCESS' };
  }
}

/**
 * Resolves rich data for system events (tasks, projects)
 */
async function resolveRichSystemContext(companyId: string, triggerData: any): Promise<any> {
  const result: any = {};
  const entityType = triggerData.entity_type;
  const entityId = triggerData.entity_id;

  if (!entityId) return result;

  if (entityType === 'TASK') {
    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select(`
        *,
        assigned_to_user:users!tasks_assigned_to_fkey(name, phone),
        lead:leads(name, phone),
        customer:customers(name, phone)
      `)
      .eq("id", entityId)
      .maybeSingle();

    if (task) {
      result.task_title = task.title;
      result.task_status = task.status;
      result.task_priority = task.priority;
      result.task_due_date = task.due_date;
      
      if (task.assigned_to_user) {
        result.responsible_name = task.assigned_to_user.name;
        result.responsible_phone = task.assigned_to_user.phone;
      }
      
      const client = task.customer || task.lead;
      if (client) {
        result.customer_name = client.name;
        result.customer_phone = client.phone;
      }
    }
  } else if (entityType === 'PROJECT') {
    const { data: project } = await supabaseAdmin
      .from("projects")
      .select(`
        *,
        owner:users!projects_owner_user_id_fkey(name, phone),
        customer:customers(id, name, phone)
      `)
      .eq("id", entityId)
      .maybeSingle();

    if (project) {
      result.project_title = project.title;
      result.project_status = project.status;
      result.project_number = project.project_number;
      
      if (project.owner) {
        result.responsible_name = project.owner.name;
        result.responsible_phone = project.owner.phone;
      }
      
      if (project.customer) {
        result.customer_name = project.customer.name;
        result.customer_phone = project.customer.phone;
      } else {
        result.customer_name = project.customer_name;
        result.customer_phone = project.customer_phone;
      }
    }
  }

  return result;
}


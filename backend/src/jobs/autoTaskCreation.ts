import { createClient } from "@supabase/supabase-js";
import { createTask, type CreateTaskInput } from "../repos/tasks.repo.js";
import { getIO } from "../lib/io.js";
import { processRulesByTrigger, type RuleContext } from "./ruleEngine.js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface InactiveLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_id: string;
  kanban_column_id?: string;
  last_interaction_date?: string;
  assigned_to_id?: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
  company_id: string;
  customer_id?: string;
  lead_id?: string;
  created_by_id?: string;
  event_type: string;
}

/**
 * Buscar leads inativos (sem interação há 3+ dias)
 * Verifica última mensagem no chat (de qualquer origem: cliente, lead ou agente)
 */
async function findInactiveLeads(): Promise<InactiveLead[]> {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoISO = threeDaysAgo.toISOString();

    console.log("[AutoTask] 🔍 Buscando leads inativos desde:", threeDaysAgoISO);

    // Buscar chats com última mensagem antiga (3+ dias) e que tenham lead associado
    const { data: inactiveChats, error: chatsError } = await supabase
      .from("chats")
      .select(`
        id,
        customer_id,
        last_message_at,
        last_message_from,
        status,
        company_id
      `)
      .not("status", "eq", "CLOSED")
      .lt("last_message_at", threeDaysAgoISO)
      .not("customer_id", "is", null);

    if (chatsError) {
      console.error("[AutoTask] ❌ Erro ao buscar chats inativos:", chatsError);
      return [];
    }

    if (!inactiveChats || inactiveChats.length === 0) {
      console.log("[AutoTask] ℹ️ Nenhum chat inativo encontrado");
      return [];
    }

    console.log(`[AutoTask] 📊 Encontrados ${inactiveChats.length} chats inativos`);

    // Buscar dados dos leads associados aos customers desses chats
    const customerIds = inactiveChats.map(c => c.customer_id).filter(Boolean);
    
    if (customerIds.length === 0) {
      console.log("[AutoTask] ℹ️ Nenhum customer_id válido nos chats inativos");
      return [];
    }

    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select(`
        id,
        lead_id
      `)
      .in("id", customerIds)
      .not("lead_id", "is", null);

    if (customersError) {
      console.error("[AutoTask] ❌ Erro ao buscar customers:", customersError);
      return [];
    }

    if (!customers || customers.length === 0) {
      console.log("[AutoTask] ℹ️ Nenhum customer com lead_id encontrado");
      return [];
    }

    const leadIds = customers.map(c => c.lead_id).filter(Boolean);

    // Buscar dados completos dos leads
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        id,
        name,
        email,
        phone,
        company_id,
        kanban_column_id,
        assigned_to_id,
        updated_at
      `)
      .in("id", leadIds)
      .not("status_client", "in", '("Ganho","Perdido")');

    if (leadsError) {
      console.error("[AutoTask] ❌ Erro ao buscar leads:", leadsError);
      return [];
    }

    if (!leads || leads.length === 0) {
      console.log("[AutoTask] ℹ️ Nenhum lead ativo encontrado");
      return [];
    }

    // Para cada lead, verificar se já tem task de follow-up criada
    const leadsWithoutFollowupTask: InactiveLead[] = [];

    for (const lead of leads) {
      // Verificar se já existe uma task de follow-up pendente para este lead
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("related_lead_id", lead.id)
        .eq("type", "FOLLOW_UP")
        .in("status", ["PENDING", "IN_PROGRESS"])
        .limit(1);

      if (!existingTasks || existingTasks.length === 0) {
        // Buscar informação do chat para incluir na descrição
        const chatInfo = inactiveChats.find(chat => {
          const customer = customers.find(c => c.id === chat.customer_id);
          return customer?.lead_id === lead.id;
        });

        leadsWithoutFollowupTask.push({
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company_id: lead.company_id,
          kanban_column_id: lead.kanban_column_id,
          assigned_to_id: lead.assigned_to_id,
          last_interaction_date: chatInfo?.last_message_at || lead.updated_at,
        });
      }
    }

    console.log(`[AutoTask] 📋 Encontrados ${leadsWithoutFollowupTask.length} leads para follow-up`);
    return leadsWithoutFollowupTask;
  } catch (error) {
    console.error("[AutoTask] ❌ Erro ao processar leads inativos:", error);
    return [];
  }
}

/**
 * Buscar eventos que acontecerão amanhã e ainda não têm task de preparação
 */
async function findUpcomingEvents(): Promise<UpcomingEvent[]> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    console.log("[AutoTask] 🔍 Buscando eventos para amanhã:", tomorrow.toISOString());

    const { data: events, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_time,
        company_id,
        customer_id,
        lead_id,
        created_by_id,
        event_type
      `)
      .gte("start_time", tomorrow.toISOString())
      .lt("start_time", dayAfterTomorrow.toISOString())
      .neq("status", "CANCELLED");

    if (error) {
      console.error("[AutoTask] ❌ Erro ao buscar eventos:", error);
      return [];
    }

    if (!events || events.length === 0) {
      console.log("[AutoTask] ℹ️ Nenhum evento para amanhã");
      return [];
    }

    // Filtrar eventos que já têm task de preparação
    const eventsWithoutPrepTask: UpcomingEvent[] = [];

    for (const event of events) {
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("related_event_id", event.id)
        .eq("type", "MEETING")
        .in("status", ["PENDING", "IN_PROGRESS"])
        .limit(1);

      if (!existingTasks || existingTasks.length === 0) {
        eventsWithoutPrepTask.push(event);
      }
    }

    console.log(`[AutoTask] 📋 Encontrados ${eventsWithoutPrepTask.length} eventos para preparação`);
    return eventsWithoutPrepTask;
  } catch (error) {
    console.error("[AutoTask] ❌ Erro ao processar eventos:", error);
    return [];
  }
}

/**
 * Criar task de follow-up para lead inativo
 */
async function createFollowUpTask(lead: InactiveLead): Promise<void> {
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Vencimento para amanhã

    // Calcular dias desde última interação
    const lastInteraction = lead.last_interaction_date 
      ? new Date(lead.last_interaction_date) 
      : new Date();
    const daysSinceInteraction = Math.floor(
      (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
    );

    const lastInteractionStr = lead.last_interaction_date
      ? new Date(lead.last_interaction_date).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Data desconhecida";

    const taskInput: CreateTaskInput = {
      title: `Follow-up: ${lead.name}`,
      description: `Lead sem interação há ${daysSinceInteraction} dias. Entrar em contato para dar seguimento.

⏰ Última interação: ${lastInteractionStr}
📞 Telefone: ${lead.phone || "Não informado"}
📧 Email: ${lead.email || "Não informado"}

💡 Sugestões de abordagem:
- Verificar se há interesse ainda
- Oferecer novidades ou promoções
- Entender possíveis objeções
- Reagendar contato se necessário`,
      type: "FOLLOW_UP",
      status: "PENDING",
      priority: "MEDIUM",
      due_date: dueDate.toISOString(),
      company_id: lead.company_id,
      related_lead_id: lead.id,
      assigned_to: lead.assigned_to_id,
      created_by: "SYSTEM", // Marcado como criado pelo sistema
      is_auto_generated: true,
    };

    const task = await createTask(taskInput);
    console.log(`[AutoTask] ✅ Task de follow-up criada: ${task.id} para lead ${lead.name} (${daysSinceInteraction} dias sem interação)`);

    // Emitir evento Socket.io
    const io = getIO();
    io.emit("task:created", {
      task,
      companyId: lead.company_id,
    });

    if (task.assigned_to) {
      io.emit("task:assigned", {
        taskId: task.id,
        assignedTo: task.assigned_to,
        task,
        companyId: lead.company_id,
      });
    }
  } catch (error) {
    console.error(`[AutoTask] ❌ Erro ao criar task de follow-up para lead ${lead.id}:`, error);
  }
}

/**
 * Criar task de preparação para evento
 */
async function createEventPrepTask(event: UpcomingEvent): Promise<void> {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Final do dia de hoje

    const eventDate = new Date(event.start_time);
    const eventDateStr = eventDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const taskInput: CreateTaskInput = {
      title: `Preparar: ${event.title}`,
      description: `Preparação para evento agendado para amanhã.
      
📅 Data/Hora: ${eventDateStr}
🎯 Tipo: ${event.event_type}

✅ Checklist de preparação:
- [ ] Revisar informações do cliente
- [ ] Preparar materiais necessários
- [ ] Confirmar disponibilidade
- [ ] Enviar lembrete ao cliente`,
      type: "MEETING",
      status: "PENDING",
      priority: "HIGH",
      due_date: today.toISOString(), // Vencimento hoje para preparar
      company_id: event.company_id,
      related_event_id: event.id,
      related_customer_id: event.customer_id,
      related_lead_id: event.lead_id,
      assigned_to: event.created_by_id,
      created_by: "SYSTEM",
      is_auto_generated: true,
    };

    const task = await createTask(taskInput);
    console.log(`[AutoTask] ✅ Task de preparação criada: ${task.id} para evento ${event.title}`);

    // Emitir evento Socket.io
    const io = getIO();
    io.emit("task:created", {
      task,
      companyId: event.company_id,
    });

    if (task.assigned_to) {
      io.emit("task:assigned", {
        taskId: task.id,
        assignedTo: task.assigned_to,
        task,
        companyId: event.company_id,
      });
    }
  } catch (error) {
    console.error(`[AutoTask] ❌ Erro ao criar task de preparação para evento ${event.id}:`, error);
  }
}

/**
 * Job principal que executa as verificações
 */
export async function runAutoTaskCreation(): Promise<void> {
  console.log("[AutoTask] 🚀 Iniciando verificação de auto-criação de tarefas...");

  try {
    // 1. Processar leads inativos (modo legacy + regras configuráveis)
    const inactiveLeads = await findInactiveLeads();
    for (const lead of inactiveLeads) {
      // Criar task legacy (compatibilidade)
      await createFollowUpTask(lead);

      // Processar regras configuráveis tipo LEAD_INACTIVE
      const context: RuleContext = {
        lead: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          company_id: lead.company_id,
          stage: lead.kanban_column_id,
        },
        chat: {
          id: "",
          last_message_at: lead.last_interaction_date ? new Date(lead.last_interaction_date) : undefined,
        },
        config: {
          days: 3, // Padrão: 3 dias sem interação
        },
      };

      await processRulesByTrigger(lead.company_id, "LEAD_INACTIVE", context);
    }

    // 2. Processar eventos próximos (modo legacy + regras configuráveis)
    const upcomingEvents = await findUpcomingEvents();
    for (const event of upcomingEvents) {
      // Criar task legacy (compatibilidade)
      await createEventPrepTask(event);

      // Processar regras configuráveis tipo EVENT_UPCOMING
      if (event.lead_id) {
        const context: RuleContext = {
          event: {
            id: event.id,
            title: event.title,
            start_date: event.start_time,
          },
          lead: {
            id: event.lead_id,
            name: event.title,
            phone: "",
            company_id: event.company_id,
          },
          config: {
            hours_before: 24, // 24 horas antes
          },
        };

        await processRulesByTrigger(event.company_id, "EVENT_UPCOMING", context);
      }
    }

    console.log("[AutoTask] ✅ Verificação concluída com sucesso");
  } catch (error) {
    console.error("[AutoTask] ❌ Erro durante a execução:", error);
  }
}

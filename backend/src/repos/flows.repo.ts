import { supabaseAdmin } from "../lib/supabase.js";
import {
  AutomationFlow,
  FlowExecution,
  FlowStatus,
  ExecutionStatus,
  CreateFlowDTO,
  UpdateFlowDTO
} from "../types/index.js";

/**
 * List flows for a company
 */
export async function listFlows(companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("automation_flows")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as AutomationFlow[];
}

/**
 * Get flow by ID
 */
export async function getFlowById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("automation_flows")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as AutomationFlow | null;
}

/**
 * Create a new flow
 */
export async function createFlow(input: CreateFlowDTO) {
  const { data, error } = await supabaseAdmin
    .from("automation_flows")
    .insert([input])
    .select()
    .single();

  if (error) throw error;
  return data as AutomationFlow;
}

/**
 * Update an existing flow
 */
export async function updateFlow(id: string, input: UpdateFlowDTO) {
  const { data, error } = await supabaseAdmin
    .from("automation_flows")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as AutomationFlow;
}

/**
 * Delete a flow
 */
export async function deleteFlow(id: string) {
  const { error } = await supabaseAdmin
    .from("automation_flows")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
}

/**
 * Create a flow execution
 */
export async function createExecution(input: Partial<FlowExecution>) {
  const { data, error } = await supabaseAdmin
    .from("flow_executions")
    .insert([input])
    .select()
    .single();

  if (error) throw error;
  return data as FlowExecution;
}

/**
 * Update execution state
 */
export async function updateExecution(id: string, input: Partial<FlowExecution>) {
  const { data, error } = await supabaseAdmin
    .from("flow_executions")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as FlowExecution;
}

/**
 * Log a flow step
 */
export async function logFlowStep(log: {
  execution_id?: string;
  flow_id?: string;
  contact_id?: string;
  node_id?: string;
  action_type: string;
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
  data?: unknown;
}) {
  const { error } = await supabaseAdmin
    .from("flow_logs")
    .insert([log]);

  if (error) console.error("Error logging flow step:", error);
}

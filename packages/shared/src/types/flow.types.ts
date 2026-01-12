export type FlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type ExecutionStatus = 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AutomationFlow {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  status: FlowStatus;
  trigger_config: unknown;
  nodes: unknown[];
  edges: unknown[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  contact_id: string;
  current_node_id?: string;
  status: ExecutionStatus;
  variables: unknown;
  next_step_at?: string;
  last_error?: string;
  started_at: string;
  updated_at: string;
  finished_at?: string;
}

export interface CreateFlowDTO extends Partial<Omit<AutomationFlow, 'id' | 'created_at' | 'updated_at'>> {
  name: string;
  company_id: string;
}

export interface UpdateFlowDTO extends Partial<Omit<AutomationFlow, 'id' | 'company_id' | 'created_at' | 'updated_at'>> {}

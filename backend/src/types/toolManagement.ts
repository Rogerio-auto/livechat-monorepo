// backend/src/types/toolManagement.ts
import { Tool } from "./agentTemplate.ts";

export interface ToolWithStats extends Tool {
  agents_using: number;
  templates_using: number;
  invocations_last_7_days: number;
  failures_last_7_days: number;
  failure_rate_7_days: number;
}

export interface ToolInvocation {
  id: string;
  company_id: string;
  agent_id?: string;
  tool_id?: string;
  agent_tool_id?: string;
  conversation_id?: string;
  message_id?: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  request: Record<string, any>;
  response?: Record<string, any>;
  error?: string;
  started_at?: Date;
  finished_at?: Date;
  created_at: Date;
}

export interface AgentTool {
  id: string;
  agent_id: string;
  tool_id: string;
  is_enabled: boolean;
  overrides: Record<string, any>;
  created_at: Date;
}

export interface ToolLog {
  id: string;
  agent_id: string;
  tool_id: string;
  status: 'success' | 'error';
  latency_ms: number;
  error_message?: string;
  request_payload?: any;
  response_payload?: any;
  created_at: Date;
}

export interface ToolStats {
  tool_id: string;
  total_calls: number;
  error_count: number;
  avg_latency_ms: number;
  last_executed_at?: Date;
  updated_at: Date;
}

export interface ToolTest {
  id: string;
  tool_id: string;
  tester_id: string;
  test_name: string;
  test_input: any;
  expected_output?: any;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
  actual_output?: any;
  error_message?: string;
  execution_time_ms?: number;
  validation_passed?: boolean;
  validation_details?: any;
  created_at: Date;
}

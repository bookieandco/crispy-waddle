export type AgentId = "janet" | "delia" | "marisa";

export type AgentStatus = "online" | "degraded" | "offline";

export interface AgentContext {
  requestId: string;
  userId: string;
  goal: string;
  context?: Record<string, unknown>;
}

export interface AgentResult {
  agent: AgentId;
  requestId: string;
  status: "completed" | "needs_approval" | "blocked";
  summary: string;
  data: Record<string, unknown>;
  next?: AgentId;
  audit: {
    action: string;
    timestamp: string;
  };
}

export interface Agent {
  readonly id: AgentId;
  readonly name: string;
  readonly role: string;
  health(): Promise<AgentStatus>;
  handle(context: AgentContext): Promise<AgentResult>;
}

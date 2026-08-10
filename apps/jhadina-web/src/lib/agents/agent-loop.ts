export type AgentName = "JANET" | "DELIA" | "MARISA";

export type HandoffType = "CONTEXT_TO_STRATEGY" | "STRATEGY_TO_EXECUTION";

export interface ApprovedContext {
  userId: string;
  sourceMemoryIds: string[];
  context: unknown[];
  approvedAt: string;
}

export interface StrategyPacket {
  strategyId: string;
  userId: string;
  objective: string;
  contextMemoryIds: string[];
  recommendations: string[];
  createdAt: string;
}

export interface AgentHandoffAudit {
  id: string;
  type: HandoffType;
  from: AgentName;
  to: AgentName;
  userId: string;
  inputId: string;
  occurredAt: string;
  status: "CREATED";
}

export interface AgentAuditSink {
  record(event: AgentHandoffAudit): Promise<void>;
}

export class InMemoryAgentAuditSink implements AgentAuditSink {
  readonly events: AgentHandoffAudit[] = [];
  async record(event: AgentHandoffAudit): Promise<void> {
    this.events.push(event);
  }
}

export interface JanetContextProvider {
  getContext(userId: string): Promise<unknown[]>;
  getApprovedMemoryIds?(userId: string): Promise<string[]>;
}

export interface DeliaStrategyProvider {
  createStrategy(input: {
    userId: string;
    objective: string;
    context: ApprovedContext;
  }): Promise<StrategyPacket>;
}

export interface MarisaExecutionProvider {
  prepareExecution(strategy: StrategyPacket): Promise<{
    executionId: string;
    status: "READY" | "BLOCKED";
    strategyId: string;
  }>;
}

export class JhadinaOperatingLoop {
  constructor(
    private readonly janet: JanetContextProvider,
    private readonly delia: DeliaStrategyProvider,
    private readonly marisa: MarisaExecutionProvider,
    private readonly audit: AgentAuditSink,
  ) {}

  async run(input: { userId: string; objective: string }) {
    const context = await this.janet.getContext(input.userId);
    const sourceMemoryIds = this.janet.getApprovedMemoryIds
      ? await this.janet.getApprovedMemoryIds(input.userId)
      : [];

    const approvedContext: ApprovedContext = {
      userId: input.userId,
      sourceMemoryIds,
      context,
      approvedAt: new Date().toISOString(),
    };

    const strategy = await this.delia.createStrategy({
      userId: input.userId,
      objective: input.objective,
      context: approvedContext,
    });

    await this.audit.record({
      id: `handoff:${strategy.strategyId}:janet-delia`,
      type: "CONTEXT_TO_STRATEGY",
      from: "JANET",
      to: "DELIA",
      userId: input.userId,
      inputId: strategy.strategyId,
      occurredAt: new Date().toISOString(),
      status: "CREATED",
    });

    const execution = await this.marisa.prepareExecution(strategy);

    await this.audit.record({
      id: `handoff:${execution.executionId}:delia-marisa`,
      type: "STRATEGY_TO_EXECUTION",
      from: "DELIA",
      to: "MARISA",
      userId: input.userId,
      inputId: strategy.strategyId,
      occurredAt: new Date().toISOString(),
      status: "CREATED",
    });

    return {
      context: approvedContext,
      strategy,
      execution,
    };
  }
}

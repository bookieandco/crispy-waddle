export type AgentName = "JANET" | "DELIA" | "MARISA"
export type HandoffType = "CONTEXT_TO_STRATEGY" | "STRATEGY_TO_EXECUTION"

export interface ApprovedContext {
  userId: string
  sourceMemoryIds: string[]
  context: unknown[]
  codebase?: unknown
  approvedAt: string
}

export interface StrategyPacket {
  strategyId: string
  userId: string
  objective: string
  contextMemoryIds: string[]
  recommendations: string[]
  createdAt: string
}

export interface AgentHandoffAudit {
  id: string
  type: HandoffType
  from: AgentName
  to: AgentName
  userId: string
  inputId: string
  occurredAt: string
  status: "CREATED" | "COMPLETED" | "FAILED"
  metadata?: Record<string, unknown>
}

export interface AgentAuditSink {
  record(event: AgentHandoffAudit): Promise<void>
}

export class InMemoryAgentAuditSink implements AgentAuditSink {
  readonly events: AgentHandoffAudit[] = []
  async record(event: AgentHandoffAudit): Promise<void> { this.events.push(event) }
}

export interface JanetContextProvider {
  getContext(userId: string): Promise<unknown[]>
  getApprovedMemoryIds?(userId: string): Promise<string[]>
  getAgentContext?(userId: string, objective?: string): Promise<{
    approvedMemories: unknown[]
    sourceMemoryIds: string[]
    codebase: unknown
  }>
}

export interface DeliaStrategyProvider {
  createStrategy(input: {
    userId: string
    objective: string
    context: ApprovedContext
  }): Promise<StrategyPacket>
}

export type MarisaExecutionStatus = "EXECUTED" | "FAILED"

export interface MarisaExecutionResult {
  executionId: string
  strategyId: string
  status: MarisaExecutionStatus
  result?: unknown
  error?: string
}

export interface MarisaExecutionProvider {
  prepareExecution(strategy: StrategyPacket): Promise<MarisaExecutionResult>
}

export class JhadinaOperatingLoop {
  constructor(
    private readonly janet: JanetContextProvider,
    private readonly delia: DeliaStrategyProvider,
    private readonly marisa: MarisaExecutionProvider,
    private readonly audit: AgentAuditSink,
  ) {}

  async run(input: { userId: string; objective: string }) {
    const bundle = this.janet.getAgentContext
      ? await this.janet.getAgentContext(input.userId, input.objective)
      : {
          approvedMemories: await this.janet.getContext(input.userId),
          sourceMemoryIds: this.janet.getApprovedMemoryIds ? await this.janet.getApprovedMemoryIds(input.userId) : [],
          codebase: undefined,
        }

    const approvedContext: ApprovedContext = {
      userId: input.userId,
      sourceMemoryIds: bundle.sourceMemoryIds,
      context: bundle.approvedMemories,
      codebase: bundle.codebase,
      approvedAt: new Date().toISOString(),
    }

    const strategy = await this.delia.createStrategy({ userId: input.userId, objective: input.objective, context: approvedContext })

    await this.audit.record({
      id: `handoff:${strategy.strategyId}:janet-delia`,
      type: "CONTEXT_TO_STRATEGY",
      from: "JANET",
      to: "DELIA",
      userId: input.userId,
      inputId: strategy.strategyId,
      occurredAt: new Date().toISOString(),
      status: "COMPLETED",
    })

    const handoffId = `handoff:${strategy.strategyId}:delia-marisa`
    await this.audit.record({
      id: handoffId,
      type: "STRATEGY_TO_EXECUTION",
      from: "DELIA",
      to: "MARISA",
      userId: input.userId,
      inputId: strategy.strategyId,
      occurredAt: new Date().toISOString(),
      status: "CREATED",
    })

    try {
      const execution = await this.marisa.prepareExecution(strategy)
      await this.audit.record({
        id: `${handoffId}:result`,
        type: "STRATEGY_TO_EXECUTION",
        from: "DELIA",
        to: "MARISA",
        userId: input.userId,
        inputId: execution.executionId,
        occurredAt: new Date().toISOString(),
        status: execution.status === "EXECUTED" ? "COMPLETED" : "FAILED",
        metadata: { strategyId: strategy.strategyId, error: execution.error },
      })
      return { context: approvedContext, strategy, execution }
    } catch (error) {
      await this.audit.record({
        id: `${handoffId}:failed`,
        type: "STRATEGY_TO_EXECUTION",
        from: "DELIA",
        to: "MARISA",
        userId: input.userId,
        inputId: strategy.strategyId,
        occurredAt: new Date().toISOString(),
        status: "FAILED",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      })
      throw error
    }
  }
}

import { randomUUID } from 'node:crypto';

export type AgentRunStatus =
  | 'planning'
  | 'awaiting_policy'
  | 'executing'
  | 'awaiting_approval'
  | 'replanning'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type AgentStepKind = 'plan' | 'execute' | 'observe' | 'replan' | 'approval';

export type AgentRun = { id: string; objective: string; status: AgentRunStatus; planRevision: number; currentStepId?: string; policyDecisionId?: string; createdAt: string; updatedAt: string; version: number };
export type AgentPlanStep = { id: string; ordinal: number; capability: string; operation: string; input: unknown; consequenceLevel: 'low' | 'medium' | 'high' | 'critical' };
export type AgentPlan = { id: string; runId: string; revision: number; objective: string; rationale: string; steps: AgentPlanStep[]; supersedesPlanId?: string; createdAt: string };
export type AgentStep = { id: string; runId: string; planId: string; planRevision: number; ordinal: number; kind: AgentStepKind; status: AgentStepStatus; capability?: string; operation?: string; input?: unknown; output?: unknown; error?: string; policyDecisionId?: string; startedAt?: string; completedAt?: string; attempt: number };
export type AgentCheckpoint = { id: string; runId: string; stepId?: string; planId?: string; planRevision: number; reason: 'created' | 'step-completed' | 'awaiting-policy' | 'awaiting-approval' | 'replan' | 'terminal' | 'recovery'; state: Record<string, unknown>; createdAt: string };
export type AgentPolicyDecision = { id: string; runId: string; stepId?: string; allowed: boolean; requiredApproval: boolean; reason: string; evaluatedAt: string };

export interface AgentRuntimeRepository {
  createRun(run: AgentRun): Promise<void>;
  getRun(runId: string): Promise<AgentRun | undefined>;
  updateRun(run: AgentRun, expectedVersion: number): Promise<boolean>;
  savePlan(plan: AgentPlan): Promise<void>;
  getLatestPlan(runId: string): Promise<AgentPlan | undefined>;
  saveStep(step: AgentStep): Promise<void>;
  getStep(stepId: string): Promise<AgentStep | undefined>;
  saveCheckpoint(checkpoint: AgentCheckpoint): Promise<void>;
  getLatestCheckpoint(runId: string): Promise<AgentCheckpoint | undefined>;
  savePolicyDecision(decision: AgentPolicyDecision): Promise<void>;
}

export interface AgentPolicyGate { evaluate(input: { run: AgentRun; step: AgentPlanStep; plan: AgentPlan }): Promise<AgentPolicyDecision>; }
export interface AgentExecutor { execute(input: { run: AgentRun; step: AgentPlanStep; plan: AgentPlan; policy: AgentPolicyDecision }): Promise<unknown>; }
export type PlanFactory = (input: { run: AgentRun; revision: number; previousPlan?: AgentPlan; reason: 'initial' | 'replan' }) => Promise<AgentPlan>;

export class InMemoryAgentRuntimeRepository implements AgentRuntimeRepository {
  private readonly runs = new Map<string, AgentRun>(); private readonly plans = new Map<string, AgentPlan>(); private readonly steps = new Map<string, AgentStep>(); private readonly checkpoints = new Map<string, AgentCheckpoint>(); private readonly policies = new Map<string, AgentPolicyDecision>();
  async createRun(run: AgentRun): Promise<void> { this.runs.set(run.id, structuredClone(run)); }
  async getRun(runId: string): Promise<AgentRun | undefined> { const run = this.runs.get(runId); return run ? structuredClone(run) : undefined; }
  async updateRun(run: AgentRun, expectedVersion: number): Promise<boolean> { const current = this.runs.get(run.id); if (!current || current.version !== expectedVersion) return false; this.runs.set(run.id, structuredClone({ ...run, version: expectedVersion + 1 })); return true; }
  async savePlan(plan: AgentPlan): Promise<void> { this.plans.set(plan.id, structuredClone(plan)); }
  async getLatestPlan(runId: string): Promise<AgentPlan | undefined> { const plans = [...this.plans.values()].filter((plan) => plan.runId === runId).sort((a, b) => b.revision - a.revision); return plans[0] ? structuredClone(plans[0]) : undefined; }
  async saveStep(step: AgentStep): Promise<void> { this.steps.set(step.id, structuredClone(step)); }
  async getStep(stepId: string): Promise<AgentStep | undefined> { const step = this.steps.get(stepId); return step ? structuredClone(step) : undefined; }
  async saveCheckpoint(checkpoint: AgentCheckpoint): Promise<void> { this.checkpoints.set(checkpoint.id, structuredClone(checkpoint)); }
  async getLatestCheckpoint(runId: string): Promise<AgentCheckpoint | undefined> { const checkpoints = [...this.checkpoints.values()].filter((checkpoint) => checkpoint.runId === runId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); return checkpoints[0] ? structuredClone(checkpoints[0]) : undefined; }
  async savePolicyDecision(decision: AgentPolicyDecision): Promise<void> { this.policies.set(decision.id, structuredClone(decision)); }
}

export class DurableAgentRuntime {
  constructor(private readonly repository: AgentRuntimeRepository, private readonly policy: AgentPolicyGate, private readonly executor: AgentExecutor, private readonly planFactory: PlanFactory, private readonly ids: { next(prefix: string): string } = { next: (prefix) => `${prefix}:${randomUUID()}` }, private readonly clock: () => string = () => new Date().toISOString()) {}

  async createRun(objective: string): Promise<AgentRun> { const now = this.clock(); const run: AgentRun = { id: this.ids.next('agent-run'), objective, status: 'planning', planRevision: 0, createdAt: now, updatedAt: now, version: 0 }; await this.repository.createRun(run); await this.checkpoint(run, undefined, 'created', { objective }); return run; }

  async plan(runId: string): Promise<AgentPlan> { const run = await this.requireRun(runId); const previous = await this.repository.getLatestPlan(runId); const revision = previous ? previous.revision + 1 : 1; const planningRun = await this.transition(run, 'planning', { planRevision: revision }); const plan = await this.planFactory({ run: planningRun, revision, previousPlan: previous, reason: previous ? 'replan' : 'initial' }); if (plan.runId !== runId || plan.revision !== revision) throw new Error('Plan factory returned a plan for the wrong run or revision'); await this.repository.savePlan(plan); await this.checkpoint(planningRun, undefined, previous ? 'replan' : 'created', { planId: plan.id, revision: plan.revision }); return plan; }

  async executeNext(runId: string): Promise<AgentStep> { const run = await this.requireRun(runId); const plan = await this.repository.getLatestPlan(runId); if (!plan) throw new Error(`No plan exists for agent run ${runId}`); const ordinal = await this.nextOrdinal(runId, plan.revision); const planStep = plan.steps.find((step) => step.ordinal === ordinal); if (!planStep) { const completed = await this.transition(run, 'completed'); await this.checkpoint(completed, undefined, 'terminal', { planId: plan.id }); return { id: this.ids.next('agent-step'), runId, planId: plan.id, planRevision: plan.revision, ordinal, kind: 'execute', status: 'completed', attempt: 0, completedAt: this.clock() }; }
    const step: AgentStep = { id: this.ids.next('agent-step'), runId, planId: plan.id, planRevision: plan.revision, ordinal, kind: 'execute', status: 'running', capability: planStep.capability, operation: planStep.operation, input: planStep.input, attempt: 1, startedAt: this.clock() }; await this.repository.saveStep(step); const awaitingPolicy = await this.transition(run, 'awaiting_policy', { currentStepId: step.id }); const decision = await this.policy.evaluate({ run: awaitingPolicy, step: planStep, plan }); await this.repository.savePolicyDecision(decision); step.policyDecisionId = decision.id;
    if (!decision.allowed) { step.status = decision.requiredApproval ? 'pending' : 'failed'; step.error = decision.reason; step.completedAt = this.clock(); await this.repository.saveStep(step); const blocked = await this.transition(awaitingPolicy, decision.requiredApproval ? 'awaiting_approval' : 'failed', { policyDecisionId: decision.id }); await this.checkpoint(blocked, step.id, decision.requiredApproval ? 'awaiting-approval' : 'terminal', { reason: decision.reason }); return step; }
    const running = await this.transition(awaitingPolicy, 'executing', { policyDecisionId: decision.id }); try { step.output = await this.executor.execute({ run: running, step: planStep, plan, policy: decision }); step.status = 'completed'; step.completedAt = this.clock(); await this.repository.saveStep(step); await this.checkpoint(running, step.id, 'step-completed', { output: step.output, ordinal }); return step; } catch (error) { step.status = 'failed'; step.error = error instanceof Error ? error.message : String(error); step.completedAt = this.clock(); await this.repository.saveStep(step); const failed = await this.transition(running, 'failed'); await this.checkpoint(failed, step.id, 'terminal', { error: step.error }); return step; } }

  async replan(runId: string): Promise<AgentPlan> { const run = await this.requireRun(runId); const replanning = await this.transition(run, 'replanning'); await this.checkpoint(replanning, replanning.currentStepId, 'replan', { previousRevision: replanning.planRevision }); return this.plan(runId); }
  async recover(runId: string): Promise<AgentCheckpoint | undefined> { const run = await this.requireRun(runId); const checkpoint = await this.repository.getLatestCheckpoint(runId); if (!checkpoint) return undefined; await this.transition(run, run.status, { currentStepId: checkpoint.stepId }); return checkpoint; }
  private async requireRun(runId: string): Promise<AgentRun> { const run = await this.repository.getRun(runId); if (!run) throw new Error(`Unknown agent run ${runId}`); return run; }
  private async transition(run: AgentRun, status: AgentRunStatus, patch: Partial<AgentRun> = {}): Promise<AgentRun> { const next: AgentRun = { ...run, ...patch, status, updatedAt: this.clock() }; const saved = await this.repository.updateRun(next, run.version); if (!saved) throw new Error(`Agent run ${run.id} changed concurrently; refusing stale transition`); return { ...next, version: run.version + 1 }; }
  private async checkpoint(run: AgentRun, stepId: string | undefined, reason: AgentCheckpoint['reason'], state: Record<string, unknown>): Promise<void> { await this.repository.saveCheckpoint({ id: this.ids.next('agent-checkpoint'), runId: run.id, stepId, planId: state.planId as string | undefined, planRevision: run.planRevision, reason, state, createdAt: this.clock() }); }
  private async nextOrdinal(runId: string, revision: number): Promise<number> { const latest = await this.repository.getLatestCheckpoint(runId); return latest && latest.planRevision === revision && latest.state.ordinal !== undefined ? Number(latest.state.ordinal) + 1 : 1; }
}

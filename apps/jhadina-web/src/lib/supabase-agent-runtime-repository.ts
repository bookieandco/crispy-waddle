import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgentCheckpoint,
  AgentPlan,
  AgentPolicyDecision,
  AgentRun,
  AgentRuntimeRepository,
  AgentStep,
} from '@jhadina/agent-runtime-core';

type RunRow = { id: string; objective: string; status: AgentRun['status']; plan_revision: number; current_step_id: string | null; policy_decision_id: string | null; created_at: string; updated_at: string; version: number };
type PlanRow = { id: string; run_id: string; revision: number; objective: string; rationale: string; steps: AgentPlan['steps']; supersedes_plan_id: string | null; created_at: string };
type StepRow = { id: string; run_id: string; plan_id: string; plan_revision: number; ordinal: number; kind: AgentStep['kind']; status: AgentStep['status']; capability: string | null; operation: string | null; input: unknown; output: unknown; error: string | null; policy_decision_id: string | null; started_at: string | null; completed_at: string | null; attempt: number };
type CheckpointRow = { id: string; run_id: string; step_id: string | null; plan_id: string | null; plan_revision: number; reason: AgentCheckpoint['reason']; state: Record<string, unknown>; created_at: string };
type PolicyRow = { id: string; run_id: string; step_id: string | null; allowed: boolean; required_approval: boolean; reason: string; evaluated_at: string };

const toRun = (row: RunRow): AgentRun => ({ id: row.id, objective: row.objective, status: row.status, planRevision: row.plan_revision, currentStepId: row.current_step_id ?? undefined, policyDecisionId: row.policy_decision_id ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version });
const toPlan = (row: PlanRow): AgentPlan => ({ id: row.id, runId: row.run_id, revision: row.revision, objective: row.objective, rationale: row.rationale, steps: row.steps, supersedesPlanId: row.supersedes_plan_id ?? undefined, createdAt: row.created_at });
const toStep = (row: StepRow): AgentStep => ({ id: row.id, runId: row.run_id, planId: row.plan_id, planRevision: row.plan_revision, ordinal: row.ordinal, kind: row.kind, status: row.status, capability: row.capability ?? undefined, operation: row.operation ?? undefined, input: row.input ?? undefined, output: row.output ?? undefined, error: row.error ?? undefined, policyDecisionId: row.policy_decision_id ?? undefined, startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined, attempt: row.attempt });
const toCheckpoint = (row: CheckpointRow): AgentCheckpoint => ({ id: row.id, runId: row.run_id, stepId: row.step_id ?? undefined, planId: row.plan_id ?? undefined, planRevision: row.plan_revision, reason: row.reason, state: row.state, createdAt: row.created_at });

export function createSupabaseAgentRuntimeRepository(client: SupabaseClient): AgentRuntimeRepository {
  return {
    async createRun(run) {
      const { error } = await client.from('jhadina_agent_runs').insert({ id: run.id, objective: run.objective, status: run.status, plan_revision: run.planRevision, current_step_id: run.currentStepId ?? null, policy_decision_id: run.policyDecisionId ?? null, created_at: run.createdAt, updated_at: run.updatedAt, version: run.version });
      if (error) throw error;
    },
    async getRun(runId) {
      const { data, error } = await client.from('jhadina_agent_runs').select('*').eq('id', runId).maybeSingle();
      if (error) throw error;
      return data ? toRun(data as RunRow) : undefined;
    },
    async updateRun(run, expectedVersion) {
      const { data, error } = await client.rpc('update_jhadina_agent_run', { p_id: run.id, p_expected_version: expectedVersion, p_objective: run.objective, p_status: run.status, p_plan_revision: run.planRevision, p_current_step_id: run.currentStepId ?? null, p_policy_decision_id: run.policyDecisionId ?? null, p_updated_at: run.updatedAt });
      if (error) throw error;
      return Boolean(data);
    },
    async savePlan(plan) {
      const { error } = await client.from('jhadina_agent_plans').insert({ id: plan.id, run_id: plan.runId, revision: plan.revision, objective: plan.objective, rationale: plan.rationale, steps: plan.steps, supersedes_plan_id: plan.supersedesPlanId ?? null, created_at: plan.createdAt });
      if (error) throw error;
    },
    async getLatestPlan(runId) {
      const { data, error } = await client.from('jhadina_agent_plans').select('*').eq('run_id', runId).order('revision', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? toPlan(data as PlanRow) : undefined;
    },
    async saveStep(step) {
      const { error } = await client.from('jhadina_agent_steps').upsert({ id: step.id, run_id: step.runId, plan_id: step.planId, plan_revision: step.planRevision, ordinal: step.ordinal, kind: step.kind, status: step.status, capability: step.capability ?? null, operation: step.operation ?? null, input: step.input ?? null, output: step.output ?? null, error: step.error ?? null, policy_decision_id: step.policyDecisionId ?? null, started_at: step.startedAt ?? null, completed_at: step.completedAt ?? null, attempt: step.attempt }, { onConflict: 'id' });
      if (error) throw error;
    },
    async getStep(stepId) {
      const { data, error } = await client.from('jhadina_agent_steps').select('*').eq('id', stepId).maybeSingle();
      if (error) throw error;
      return data ? toStep(data as StepRow) : undefined;
    },
    async saveCheckpoint(checkpoint) {
      const { error } = await client.from('jhadina_agent_checkpoints').insert({ id: checkpoint.id, run_id: checkpoint.runId, step_id: checkpoint.stepId ?? null, plan_id: checkpoint.planId ?? null, plan_revision: checkpoint.planRevision, reason: checkpoint.reason, state: checkpoint.state, created_at: checkpoint.createdAt });
      if (error) throw error;
    },
    async getLatestCheckpoint(runId) {
      const { data, error } = await client.from('jhadina_agent_checkpoints').select('*').eq('run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? toCheckpoint(data as CheckpointRow) : undefined;
    },
    async savePolicyDecision(decision) {
      const { error } = await client.from('jhadina_agent_policy_decisions').insert({ id: decision.id, run_id: decision.runId, step_id: decision.stepId ?? null, allowed: decision.allowed, required_approval: decision.requiredApproval, reason: decision.reason, evaluated_at: decision.evaluatedAt });
      if (error) throw error;
    },
  };
}

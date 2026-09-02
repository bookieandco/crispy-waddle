import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgentCheckpoint,
  AgentPlan,
  AgentPolicyDecision,
  AgentRun,
  AgentRuntimeRepository,
  AgentStep,
} from '@jhadina/agent-runtime-core';

type RunRow = AgentRun;
type PlanRow = AgentPlan;
type StepRow = AgentStep;
type CheckpointRow = AgentCheckpoint;

type PolicyRow = AgentPolicyDecision;

export function createSupabaseAgentRuntimeRepository(client: SupabaseClient): AgentRuntimeRepository {
  return {
    async createRun(run) {
      const { error } = await client.from('jhadina_agent_runs').insert(run);
      if (error) throw error;
    },
    async getRun(runId) {
      const { data, error } = await client.from('jhadina_agent_runs').select('*').eq('id', runId).maybeSingle();
      if (error) throw error;
      return data ? (data as RunRow) : undefined;
    },
    async updateRun(run, expectedVersion) {
      const { data, error } = await client.rpc('update_jhadina_agent_run', {
        p_id: run.id,
        p_expected_version: expectedVersion,
        p_objective: run.objective,
        p_status: run.status,
        p_plan_revision: run.planRevision,
        p_current_step_id: run.currentStepId ?? null,
        p_policy_decision_id: run.policyDecisionId ?? null,
        p_updated_at: run.updatedAt,
      });
      if (error) throw error;
      return Boolean(data);
    },
    async savePlan(plan) {
      const { error } = await client.from('jhadina_agent_plans').insert(plan);
      if (error) throw error;
    },
    async getLatestPlan(runId) {
      const { data, error } = await client.from('jhadina_agent_plans').select('*').eq('run_id', runId).order('revision', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? (data as PlanRow) : undefined;
    },
    async saveStep(step) {
      const { error } = await client.from('jhadina_agent_steps').upsert(step, { onConflict: 'id' });
      if (error) throw error;
    },
    async getStep(stepId) {
      const { data, error } = await client.from('jhadina_agent_steps').select('*').eq('id', stepId).maybeSingle();
      if (error) throw error;
      return data ? (data as StepRow) : undefined;
    },
    async saveCheckpoint(checkpoint) {
      const { error } = await client.from('jhadina_agent_checkpoints').insert(checkpoint);
      if (error) throw error;
    },
    async getLatestCheckpoint(runId) {
      const { data, error } = await client.from('jhadina_agent_checkpoints').select('*').eq('run_id', runId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data ? (data as CheckpointRow) : undefined;
    },
    async savePolicyDecision(decision) {
      const { error } = await client.from('jhadina_agent_policy_decisions').insert(decision);
      if (error) throw error;
    },
  };
}

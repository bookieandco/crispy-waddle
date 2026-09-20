import { buildResearchQueuePlan, startResearchTask, type ResearchTask } from "./research-queue.js";
import { assertResearchRuntimeAdmission, researchPlanToQueue } from "./runtime-reconciliation.js";
import type {
  ResearchProviderSubmission,
  ResearchRuntimeRepository,
  ResearchUsageDelta,
} from "./runtime-repository.js";

export type ResearchProviderEvidence = {
  sourceUri: string;
  contentHash: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
};

export type ResearchProviderResult = {
  providerJobId?: string;
  evidence: ResearchProviderEvidence[];
  usage: ResearchUsageDelta;
  payload?: Record<string, unknown>;
};

export interface ResearchProvider {
  id: string;
  execute(task: ResearchTask, context: {
    planId: string;
    idempotencyKey: string;
  }): Promise<ResearchProviderResult>;
}

export type GovernedResearchExecutionResult =
  | { status: "completed"; taskId: string; evidence: ResearchProviderEvidence[]; submission: ResearchProviderSubmission }
  | { status: "no_ready_task" }
  | { status: "fenced"; reason: string }
  | { status: "stopped"; reason: string };

export class GovernedResearchExecutor {
  constructor(
    private readonly repository: ResearchRuntimeRepository,
    private readonly provider: ResearchProvider,
  ) {}

  async executeNext(input: {
    planId: string;
    policyDecisionId: string;
    workerId: string;
    leaseSeconds?: number;
  }): Promise<GovernedResearchExecutionResult> {
    const plan = await this.repository.loadPlan(input.planId);
    if (!plan) return { status: "fenced", reason: "plan_not_found" };

    const admission = await this.repository.claimExecution({
      planId: input.planId,
      policyDecisionId: input.policyDecisionId,
      workerId: input.workerId,
      leaseSeconds: input.leaseSeconds ?? 300,
    });
    if (!admission) return { status: "fenced", reason: "execution_not_admitted" };

    const queue = researchPlanToQueue(plan);
    assertResearchRuntimeAdmission(queue, admission);

    const next = buildResearchQueuePlan(queue).ready[0];
    if (!next) {
      await this.repository.releaseExecution(admission, "released");
      return { status: "no_ready_task" };
    }

    const runningQueue = startResearchTask(queue, next.taskId);
    const task = runningQueue.tasks.find((candidate) => candidate.id === next.taskId);
    if (!task) throw new Error("Research queue exposed a task that does not exist");

    const idempotencyKey = [plan.id, plan.planVersion, task.id, this.provider.id].join(":");
    const requestHash = stableTaskHash(plan.id, plan.planVersion, task);

    const submission = await this.repository.reserveProviderSubmission({
      admission,
      taskId: task.id,
      providerId: this.provider.id,
      idempotencyKey,
      requestHash,
    });
    if (!submission || submission.status === "submitted") {
      await this.repository.releaseExecution(admission, "fenced");
      return { status: "fenced", reason: submission ? "provider_submission_already_submitted" : "provider_submission_not_reserved" };
    }

    const started = await this.repository.commitExecutionEvent({
      admission,
      eventType: "task_started",
      taskId: task.id,
      payload: { providerId: this.provider.id, submissionId: submission.id },
    });
    if (!started.accepted) {
      await this.repository.releaseExecution(admission, "fenced");
      return { status: started.stopped ? "stopped" : "fenced", reason: started.reason ?? "task_start_rejected" };
    }

    try {
      const providerResult = await this.provider.execute(task, { planId: plan.id, idempotencyKey });

      const renewed = await this.repository.renewExecutionLease(admission, input.leaseSeconds ?? 300);
      if (!renewed) {
        await this.repository.markProviderRecoveryRequired({
          admission,
          submissionId: submission.id,
          error: "lease_lost_after_provider_call",
        });
        return { status: "fenced", reason: "lease_lost_after_provider_call" };
      }

      const committed = await this.repository.commitExecutionEvent({
        admission: renewed,
        eventType: "task_completed",
        taskId: task.id,
        payload: {
          providerId: this.provider.id,
          submissionId: submission.id,
          evidenceCount: providerResult.evidence.length,
          ...(providerResult.payload ?? {}),
        },
        usage: {
          ...providerResult.usage,
          evidence: providerResult.usage.evidence ?? providerResult.evidence.length,
        },
      });
      if (!committed.accepted) {
        await this.repository.markProviderRecoveryRequired({
          admission: renewed,
          submissionId: submission.id,
          error: committed.reason ?? "execution_commit_rejected",
        });
        return { status: committed.stopped ? "stopped" : "fenced", reason: committed.reason ?? "execution_commit_rejected" };
      }

      const acknowledged = await this.repository.acknowledgeProviderSubmission({
        admission: renewed,
        submissionId: submission.id,
        providerJobId: providerResult.providerJobId,
      });
      if (!acknowledged) return { status: "fenced", reason: "provider_acknowledgement_rejected" };

      // Completing one task does not imply the whole plan is complete. The DB
      // closes the plan only after every durable task state is terminal.
      await this.repository.releaseExecution(renewed, "released");
      return { status: "completed", taskId: task.id, evidence: providerResult.evidence, submission: acknowledged };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.markProviderRecoveryRequired({ admission, submissionId: submission.id, error: message });
      await this.repository.commitExecutionEvent({
        admission,
        eventType: "failed",
        taskId: task.id,
        payload: { error: message, providerId: this.provider.id },
        usage: { retries: 1 },
      }).catch(() => undefined);
      await this.repository.releaseExecution(admission, "failed").catch(() => false);
      throw error;
    }
  }
}

function stableTaskHash(planId: string, version: number, task: ResearchTask): string {
  return JSON.stringify({
    planId,
    version,
    task: {
      id: task.id,
      objective: task.objective,
      dependencies: [...task.dependencies].sort(),
      authorizationClass: task.authorizationClass,
      cost: task.cost,
      risk: task.risk,
    },
  });
}

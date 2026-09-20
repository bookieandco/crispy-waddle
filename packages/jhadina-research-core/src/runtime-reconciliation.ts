import type {
  ResearchAuthorizationClass,
  ResearchBudget,
  ResearchQueue,
  ResearchTask,
} from "./research-queue.js";

export interface PersistedResearchPlanTask {
  id: string;
  objective: string;
  dependencies?: string[];
  priority?: number;
  expectedValue?: number;
  cost?: number;
  risk?: number;
  authorizationClass?: ResearchAuthorizationClass;
  estimatedDurationMs?: number;
}

export interface PersistedResearchPlan {
  id: string;
  intentId: string;
  planVersion: number;
  tasks: PersistedResearchPlanTask[];
  budget: Record<string, unknown>;
  status: string;
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

function budgetNumber(budget: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = budget[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return undefined;
}

/**
 * K-1.4.6G canonical bridge.
 *
 * Persisted ResearchPlan is the durable plan contract. ResearchQueue is its
 * application/runtime projection; it is not a second source of authority.
 * Policy/admission must occur before this projection is executed.
 */
export function researchPlanToQueue(plan: PersistedResearchPlan): ResearchQueue {
  if (!plan.id || !plan.intentId) throw new Error("Research plan identity is required");
  if (!Number.isInteger(plan.planVersion) || plan.planVersion < 1) {
    throw new Error("Research plan version is invalid");
  }
  if (!Array.isArray(plan.tasks)) throw new Error("Research plan tasks must be an array");

  const maxCost = budgetNumber(plan.budget, "maxCost", "max_cost");
  const maxRisk = budgetNumber(plan.budget, "maxRisk", "max_risk");

  // Missing persisted limits fail closed. They do not become infinity.
  const budget: ResearchBudget = {
    maxCost: maxCost ?? 0,
    maxRisk: maxRisk ?? 0,
    spentCost: 0,
    accruedRisk: 0,
  };

  const tasks: ResearchTask[] = plan.tasks.map((task) => ({
    id: task.id,
    objective: task.objective,
    dependencies: task.dependencies ?? [],
    priority: numberOr(task.priority, 0),
    expectedValue: numberOr(task.expectedValue, 0),
    cost: numberOr(task.cost, 0),
    risk: numberOr(task.risk, 0),
    authorizationClass: task.authorizationClass ?? "analysis",
    state: "ready",
    evidenceIds: [],
    estimatedDurationMs: task.estimatedDurationMs,
  }));

  return {
    id: plan.id,
    objective: `research-intent:${plan.intentId}`,
    tasks,
    budget,
    revision: plan.planVersion,
  };
}

export interface ResearchRuntimeAdmission {
  planId: string;
  policyDecisionId: string;
  leaseId: string;
  leaseToken: string;
  workerId: string;
  expiresAt: string;
}

/**
 * Execution code must carry admission separately from the queue. A queue alone
 * can never be interpreted as permission to execute.
 */
export function assertResearchRuntimeAdmission(
  queue: ResearchQueue,
  admission: ResearchRuntimeAdmission,
  now = new Date(),
): void {
  if (queue.id !== admission.planId) throw new Error("Research admission does not match queue plan");
  if (!admission.policyDecisionId || !admission.leaseId || !admission.leaseToken || !admission.workerId) {
    throw new Error("Research execution admission is incomplete");
  }
  const expiresAt = new Date(admission.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new Error("Research execution lease is expired or invalid");
  }
}

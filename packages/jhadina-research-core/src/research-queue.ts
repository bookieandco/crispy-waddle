export type ResearchTaskState = "blocked" | "ready" | "running" | "completed" | "failed" | "abstained";
export type ResearchAuthorizationClass = "analysis" | "simulation" | "restoration" | "production";

export interface ResearchTask {
  id: string;
  objective: string;
  dependencies: string[];
  priority: number;
  expectedValue: number;
  cost: number;
  risk: number;
  authorizationClass: ResearchAuthorizationClass;
  state: ResearchTaskState;
  evidenceIds: string[];
  estimatedDurationMs?: number;
}

export interface ResearchBudget {
  maxCost: number;
  maxRisk: number;
  spentCost: number;
  accruedRisk: number;
}

export interface ResearchQueue {
  id: string;
  objective: string;
  tasks: ResearchTask[];
  budget: ResearchBudget;
  revision: number;
}

export interface ResearchQueueItem {
  taskId: string;
  rank: number;
  score: number;
  unmetDependencies: string[];
  etaMs?: number;
}

export interface ResearchQueuePlan {
  revision: number;
  ready: ResearchQueueItem[];
  blocked: ResearchQueueItem[];
}

const finiteNonNegative = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`);
};

export function validateResearchQueue(queue: ResearchQueue): void {
  if (!queue.id || !queue.objective) throw new Error("Research queue identity is required");
  if (!Number.isInteger(queue.revision) || queue.revision < 0) throw new Error("Research queue revision is invalid");
  finiteNonNegative(queue.budget.maxCost, "Maximum research cost");
  finiteNonNegative(queue.budget.maxRisk, "Maximum research risk");
  finiteNonNegative(queue.budget.spentCost, "Spent research cost");
  finiteNonNegative(queue.budget.accruedRisk, "Accrued research risk");

  const ids = new Set<string>();
  for (const task of queue.tasks) {
    if (!task.id || ids.has(task.id)) throw new Error("Research task IDs must be unique");
    ids.add(task.id);
    if (!task.objective) throw new Error("Research task objective is required");
    finiteNonNegative(task.priority, "Research task priority");
    finiteNonNegative(task.expectedValue, "Research task expected value");
    finiteNonNegative(task.cost, "Research task cost");
    finiteNonNegative(task.risk, "Research task risk");
    if (task.estimatedDurationMs !== undefined) finiteNonNegative(task.estimatedDurationMs, "Research task duration");
    if (task.dependencies.includes(task.id)) throw new Error(`Research task ${task.id} cannot depend on itself`);
  }

  for (const task of queue.tasks) {
    for (const dependency of task.dependencies) {
      if (!ids.has(dependency)) throw new Error(`Research task ${task.id} references missing dependency ${dependency}`);
    }
  }

  assertAcyclic(queue.tasks);
}

export function buildResearchQueuePlan(queue: ResearchQueue, nowRunningDurationMs = 0): ResearchQueuePlan {
  validateResearchQueue(queue);
  const byId = new Map(queue.tasks.map((task) => [task.id, task]));
  const plan: ResearchQueueItem[] = [];

  for (const task of queue.tasks) {
    const unmetDependencies = task.dependencies.filter((dependency) => byId.get(dependency)?.state !== "completed");
    const budgetAllows = queue.budget.spentCost + task.cost <= queue.budget.maxCost
      && queue.budget.accruedRisk + task.risk <= queue.budget.maxRisk;
    const ready = task.state === "ready" && unmetDependencies.length === 0 && budgetAllows;
    const score = ready ? scoreResearchTask(task) : -1;
    plan.push({
      taskId: task.id,
      rank: 0,
      score,
      unmetDependencies,
      etaMs: ready && task.estimatedDurationMs !== undefined
        ? nowRunningDurationMs + task.estimatedDurationMs
        : undefined,
    });
  }

  const ready = plan
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.taskId.localeCompare(b.taskId))
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const blocked = plan
    .filter((item) => item.score < 0)
    .sort((a, b) => a.taskId.localeCompare(b.taskId));

  return { revision: queue.revision, ready, blocked };
}

/** Starts only a task that the current queue plan explicitly exposes as ready. */
export function startResearchTask(queue: ResearchQueue, taskId: string): ResearchQueue {
  const plan = buildResearchQueuePlan(queue);
  if (!plan.ready.some((item) => item.taskId === taskId)) {
    throw new Error("Research task is not currently ready or exceeds queue constraints");
  }
  return {
    ...queue,
    revision: queue.revision + 1,
    tasks: queue.tasks.map((task) => task.id === taskId ? { ...task, state: "running" } : task),
  };
}

export function scoreResearchTask(task: ResearchTask): number {
  // Deterministic value-per-cost score with explicit risk penalty.
  // A queue may prioritize discovery, but cannot convert a disallowed class into authority.
  const denominator = Math.max(task.cost, 1e-9);
  return (task.expectedValue + task.priority) / denominator - task.risk;
}

export function applyResearchOutcome(input: {
  queue: ResearchQueue;
  taskId: string;
  outcome: "completed" | "failed" | "abstained";
  evidenceIds?: string[];
  cost?: number;
  risk?: number;
}): ResearchQueue {
  validateResearchQueue(input.queue);
  const task = input.queue.tasks.find((candidate) => candidate.id === input.taskId);
  if (!task) throw new Error("Research task does not belong to the queue");
  if (task.state !== "running") throw new Error("Only a running research task can accept an outcome");

  const cost = input.cost ?? task.cost;
  const risk = input.risk ?? task.risk;
  finiteNonNegative(cost, "Research outcome cost");
  finiteNonNegative(risk, "Research outcome risk");

  const nextBudget = {
    ...input.queue.budget,
    spentCost: input.queue.budget.spentCost + cost,
    accruedRisk: input.queue.budget.accruedRisk + risk,
  };
  if (nextBudget.spentCost > nextBudget.maxCost || nextBudget.accruedRisk > nextBudget.maxRisk) {
    throw new Error("Research outcome exceeds queue budget");
  }

  return {
    ...input.queue,
    revision: input.queue.revision + 1,
    budget: nextBudget,
    tasks: input.queue.tasks.map((candidate) => candidate.id === input.taskId
      ? { ...candidate, state: input.outcome, evidenceIds: [...candidate.evidenceIds, ...(input.evidenceIds ?? [])] }
      : candidate),
  };
}

function assertAcyclic(tasks: ResearchTask[]): void {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error("Research dependency graph contains a cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };

  for (const task of tasks) visit(task.id);
}

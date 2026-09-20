import { describe, expect, it } from "vitest";
import { assertResearchRuntimeAdmission, researchPlanToQueue } from "./runtime-reconciliation.js";
import { buildResearchQueuePlan } from "./research-queue.js";

describe("K-1.4.6G research runtime reconciliation", () => {
  it("projects a persisted plan into the existing deterministic queue model", () => {
    const queue = researchPlanToQueue({
      id: "plan-1", intentId: "intent-1", planVersion: 3, status: "approved",
      budget: { maxCost: 10, maxRisk: 2 },
      tasks: [
        { id: "a", objective: "primary source", cost: 2, risk: 0.2, priority: 5, expectedValue: 8 },
        { id: "b", objective: "corroborate", dependencies: ["a"], cost: 2, risk: 0.2 },
      ],
    });
    expect(queue.id).toBe("plan-1");
    expect(queue.revision).toBe(3);
    expect(buildResearchQueuePlan(queue).ready.map((x) => x.taskId)).toEqual(["a"]);
  });

  it("fails closed when persisted budget limits are absent", () => {
    const queue = researchPlanToQueue({
      id: "plan-1", intentId: "intent-1", planVersion: 1, status: "approved",
      budget: {}, tasks: [{ id: "a", objective: "query", cost: 1, risk: 0 }],
    });
    expect(buildResearchQueuePlan(queue).ready).toHaveLength(0);
  });

  it("does not treat a queue as execution authority", () => {
    const queue = researchPlanToQueue({
      id: "plan-1", intentId: "intent-1", planVersion: 1, status: "approved",
      budget: { maxCost: 1, maxRisk: 1 }, tasks: [],
    });
    expect(() => assertResearchRuntimeAdmission(queue, {
      planId: "plan-1", policyDecisionId: "decision-1", leaseId: "lease-1",
      leaseToken: "token", workerId: "worker-1", expiresAt: "2026-09-20T17:00:00Z",
    }, new Date("2026-09-20T16:00:00Z"))).not.toThrow();
    expect(() => assertResearchRuntimeAdmission(queue, {
      planId: "other", policyDecisionId: "decision-1", leaseId: "lease-1",
      leaseToken: "token", workerId: "worker-1", expiresAt: "2026-09-20T17:00:00Z",
    }, new Date("2026-09-20T16:00:00Z"))).toThrow(/does not match/);
  });
});

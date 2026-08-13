import { describe, expect, it, vi } from "vitest";
import { GuardedPlanningExecutor } from "./executor-adapter";
import type { PlanningProposal } from "./index";
import type { PlanningEventBus } from "./events";
import type { PlanningPolicyGateway } from "./policy-gateway";

const proposal: PlanningProposal = {
  id: "proposal-1",
  planId: "plan-1",
  description: "test",
  requestedAt: new Date().toISOString(),
  requestedBy: "user-1",
  actionType: "example",
  payload: { value: true },
};

describe("GuardedPlanningExecutor", () => {
  it("never invokes the executor when policy denies", async () => {
    const policy = {
      evaluate: vi.fn().mockResolvedValue({ allowed: false, reason: "denied" }),
    } as unknown as PlanningPolicyGateway;
    const executor = { execute: vi.fn() };
    const events = { publish: vi.fn() } as unknown as PlanningEventBus;
    const guarded = new GuardedPlanningExecutor(policy, executor, events);

    await expect(guarded.execute(proposal, "user-1")).rejects.toThrow("denied");
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("executes only after policy allows", async () => {
    const policy = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, reason: "allowed" }),
    } as unknown as PlanningPolicyGateway;
    const executor = { execute: vi.fn().mockResolvedValue({ executionId: "exec-1" }) };
    const events = { publish: vi.fn().mockResolvedValue(undefined) } as unknown as PlanningEventBus;
    const guarded = new GuardedPlanningExecutor(policy, executor, events);

    await expect(guarded.execute(proposal, "user-1")).resolves.toBe("exec-1");
    expect(executor.execute).toHaveBeenCalledWith({
      proposalId: proposal.id,
      actionType: proposal.actionType,
      payload: proposal.payload,
      actorId: "user-1",
    });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ACTION_EXECUTED", planId: proposal.planId }),
    );
  });
});

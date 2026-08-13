import { describe, expect, it, vi } from "vitest";
import { SupabasePlanningRegistry } from "./supabase-registry";
import type { PlanningPlan } from "./index";

describe("SupabasePlanningRegistry", () => {
  it("loads a plan document", async () => {
    const plan: PlanningPlan = {
      id: "plan-1",
      name: "Test plan",
      version: 1,
      layers: [],
      markers: [],
      routes: [],
      annotations: [],
      measurements: [],
      scenarios: [],
      timeline: [],
    };

    const single = vi.fn().mockResolvedValue({
      data: { id: plan.id, name: plan.name, version: plan.version, document: plan },
      error: null,
    });
    const query = { select: () => ({ eq: () => ({ single }) }) };
    const db = { from: () => query } as never;

    const events = { publish: vi.fn().mockResolvedValue(undefined) };
    const registry = new SupabasePlanningRegistry(db, events, { actorId: "system" });
    await expect(registry.getPlan("plan-1")).resolves.toEqual(plan);
    expect(single).toHaveBeenCalled();
  });
});

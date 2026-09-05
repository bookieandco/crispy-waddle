import { describe, expect, it } from "vitest";
import { buildMusicResearchQueue, completeMusicResearch, planMusicResearch, startMusicResearch } from "./music-research-adapter.js";
import type { RestorationHypothesisSet } from "./restoration-hypothesis.js";

const hypotheses: RestorationHypothesisSet = {
  id: "hyp-set-1",
  caseId: "case-1",
  sourceVersionId: "source-v1",
  evidenceIds: ["e1"],
  hypotheses: [
    { id: "damage", kind: "damage", label: "Possible click damage", prior: 0.5, observations: [{ evidenceId: "e1", likelihood: 0.7 }] },
    { id: "intentional", kind: "intentional", label: "Possible intentional transient", prior: 0.5, observations: [{ evidenceId: "e1", likelihood: 0.3 }] },
  ],
};

describe("music research adapter", () => {
  it("binds research tasks to the Music case and source version", () => {
    const result = buildMusicResearchQueue({ hypotheses, maxCost: 4, maxRisk: 1 });
    expect(result.queue.id).toBe("music-research-queue:hyp-set-1");
    expect(result.binding.caseId).toBe("case-1");
    expect(result.binding.sourceVersionId).toBe("source-v1");
    expect(result.binding.hypothesisTaskIds).toHaveLength(2);
    expect(result.queue.tasks[0]?.authorizationClass).toBe("analysis");
  });

  it("uses the global queue lifecycle rather than executing Music work directly", () => {
    const { queue } = buildMusicResearchQueue({ hypotheses, maxCost: 4, maxRisk: 1 });
    const plan = planMusicResearch(queue);
    const first = plan.ready[0];
    expect(first).toBeDefined();

    const running = startMusicResearch(queue, first!.taskId);
    expect(running.tasks.find((task) => task.id === first!.taskId)?.state).toBe("running");

    const completed = completeMusicResearch({
      queue: running,
      taskId: first!.taskId,
      outcome: "completed",
      evidenceIds: ["research-evidence-1"],
    });
    expect(completed.revision).toBe(running.revision + 1);
    expect(completed.tasks.find((task) => task.id === first!.taskId)?.state).toBe("completed");
    expect(completed.tasks.find((task) => task.id === first!.taskId)?.evidenceIds).toContain("research-evidence-1");
  });

  it("cannot start a blocked task through the Music adapter", () => {
    const { queue } = buildMusicResearchQueue({ hypotheses, maxCost: 0, maxRisk: 0 });
    expect(() => startMusicResearch(queue, queue.tasks[0]!.id)).toThrow("not currently ready");
  });
});

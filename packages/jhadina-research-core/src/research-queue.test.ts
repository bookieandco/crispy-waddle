import {
  applyResearchOutcome,
  buildResearchQueuePlan,
  validateResearchQueue,
  type ResearchQueue,
} from "./research-queue.js";

const baseQueue = (): ResearchQueue => ({
  id: "rq:test",
  objective: "restore source artifact",
  revision: 0,
  budget: { maxCost: 10, maxRisk: 5, spentCost: 0, accruedRisk: 0 },
  tasks: [
    {
      id: "ingest",
      objective: "inspect source",
      dependencies: [],
      priority: 1,
      expectedValue: 2,
      cost: 1,
      risk: 0.1,
      authorizationClass: "analysis",
      state: "completed",
      evidenceIds: ["e1"],
    },
    {
      id: "spectral",
      objective: "analyze spectral damage",
      dependencies: ["ingest"],
      priority: 2,
      expectedValue: 4,
      cost: 2,
      risk: 0.2,
      authorizationClass: "analysis",
      state: "ready",
      evidenceIds: [],
      estimatedDurationMs: 100,
    },
    {
      id: "repair",
      objective: "test restoration hypothesis",
      dependencies: ["spectral"],
      priority: 3,
      expectedValue: 8,
      cost: 4,
      risk: 0.8,
      authorizationClass: "restoration",
      state: "blocked",
      evidenceIds: [],
    },
  ],
});

const queue = baseQueue();
validateResearchQueue(queue);
const plan = buildResearchQueuePlan(queue);
if (plan.ready[0]?.taskId !== "spectral") throw new Error("Ready task ordering is not deterministic");
if (!plan.blocked.some((item) => item.taskId === "repair")) throw new Error("Dependent task was not blocked");

const running = {
  ...queue,
  tasks: queue.tasks.map((task) => task.id === "spectral" ? { ...task, state: "running" as const } : task),
};
const completed = applyResearchOutcome({
  queue: running,
  taskId: "spectral",
  outcome: "completed",
  evidenceIds: ["e2"],
});
if (completed.revision !== 1) throw new Error("Queue revision did not advance");
if (completed.tasks.find((task) => task.id === "spectral")?.evidenceIds[1] !== "e2") {
  throw new Error("Returned evidence was not attached to the task");
}

let cycleRejected = false;
try {
  validateResearchQueue({
    ...queue,
    tasks: queue.tasks.map((task) => task.id === "ingest" ? { ...task, dependencies: ["repair"] } : task),
  });
} catch {
  cycleRejected = true;
}
if (!cycleRejected) throw new Error("Dependency cycle was accepted");

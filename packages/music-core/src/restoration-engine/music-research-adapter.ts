import type { ResearchQueue, ResearchTask } from "../../../jhadina-research-core/src/research-queue.js";
import type { RestorationHypothesis, RestorationHypothesisSet } from "./restoration-hypothesis.js";
import type { DamageAssessment } from "./damage-assessment.js";
import { applyResearchOutcome, buildResearchQueuePlan, startResearchTask } from "../../../jhadina-research-core/src/research-queue.js";

export interface MusicResearchQueueInput {
  hypotheses: RestorationHypothesisSet;
  assessments?: DamageAssessment[];
  maxCost: number;
  maxRisk: number;
}

export interface MusicResearchQueueBinding {
  queueId: string;
  caseId: string;
  sourceVersionId: string;
  sourceArtifactIds: string[];
  hypothesisTaskIds: string[];
}

/**
 * Adapts Music restoration hypotheses into the global Jhadina Research Core.
 * The adapter creates research work only; it never grants restoration authority.
 */
export function buildMusicResearchQueue(input: MusicResearchQueueInput): {
  queue: ResearchQueue;
  binding: MusicResearchQueueBinding;
} {
  if (!input.hypotheses.id || !input.hypotheses.caseId || !input.hypotheses.sourceVersionId) {
    throw new Error("Music research hypothesis identity is required");
  }
  if (!Number.isFinite(input.maxCost) || input.maxCost < 0) throw new Error("Music research maximum cost is invalid");
  if (!Number.isFinite(input.maxRisk) || input.maxRisk < 0) throw new Error("Music research maximum risk is invalid");

  const assessmentsByType = new Map<string, DamageAssessment[]>();
  for (const assessment of input.assessments ?? []) {
    const current = assessmentsByType.get(assessment.type) ?? [];
    current.push(assessment);
    assessmentsByType.set(assessment.type, current);
  }

  const tasks: ResearchTask[] = input.hypotheses.hypotheses.map((hypothesis) => {
    const assessmentEvidence = [...new Set((assessmentsByType.get(hypothesis.kind) ?? [])
      .flatMap((assessment) => assessment.evidenceIds))];
    const evidenceIds = [...new Set([
      ...input.hypotheses.evidenceIds,
      ...hypothesis.observations.map((observation) => observation.evidenceId),
      ...assessmentEvidence,
    ])];
    const posterior = hypothesis.posterior ?? hypothesis.prior;
    const investigationValue = 1 - posterior;

    return {
      id: `music-research:${input.hypotheses.id}:${hypothesis.id}`,
      objective: `Investigate music restoration hypothesis: ${hypothesis.label}`,
      dependencies: [],
      priority: investigationValue,
      expectedValue: investigationValue,
      cost: 1,
      risk: hypothesis.kind === "intentional" || hypothesis.kind === "performance" ? 0.05 : 0.1,
      authorizationClass: "analysis",
      state: "ready",
      evidenceIds,
    };
  });

  const queue: ResearchQueue = {
    id: `music-research-queue:${input.hypotheses.id}`,
    objective: `Research restoration hypotheses for ${input.hypotheses.caseId}`,
    tasks,
    budget: { maxCost: input.maxCost, maxRisk: input.maxRisk, spentCost: 0, accruedRisk: 0 },
    revision: 0,
  };

  const sourceArtifactIds = [...new Set((input.assessments ?? []).map((assessment) => assessment.sourceArtifactId))];
  return {
    queue,
    binding: {
      queueId: queue.id,
      caseId: input.hypotheses.caseId,
      sourceVersionId: input.hypotheses.sourceVersionId,
      sourceArtifactIds,
      hypothesisTaskIds: tasks.map((task) => task.id),
    },
  };
}

/** Recomputes the global queue after Music evidence changes the research state. */
export function planMusicResearch(queue: ResearchQueue) {
  return buildResearchQueuePlan(queue);
}

/** Starts only a queue task that the global scheduler currently exposes as ready. */
export function startMusicResearch(queue: ResearchQueue, taskId: string): ResearchQueue {
  return startResearchTask(queue, taskId);
}

/** Returns research evidence to the global queue; it does not mutate Music source audio. */
export function completeMusicResearch(input: {
  queue: ResearchQueue;
  taskId: string;
  outcome: "completed" | "failed" | "abstained";
  evidenceIds: string[];
  cost?: number;
  risk?: number;
}): ResearchQueue {
  return applyResearchOutcome(input);
}

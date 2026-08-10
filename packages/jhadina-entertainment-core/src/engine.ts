import type {
  CreativeFeedback,
  CreativeObservation,
  CreativePreference,
  TasteHypothesis,
} from "./domain";

const WEIGHTS = {
  technique: 1,
  segment: 0.85,
  scene: 0.85,
  media: 0.6,
} as const;

export class InMemoryEntertainmentCore {
  private readonly observations = new Map<string, CreativeObservation>();
  private readonly feedback: CreativeFeedback[] = [];
  private readonly approved = new Map<string, CreativePreference>();

  addObservation(observation: CreativeObservation): void {
    if (observation.confidence < 0 || observation.confidence > 1) {
      throw new Error("Observation confidence must be between 0 and 1");
    }
    this.observations.set(observation.id, observation);
  }

  recordFeedback(input: Omit<CreativeFeedback, "id"> & { id?: string }): CreativeFeedback {
    const feedback: CreativeFeedback = {
      ...input,
      id: input.id ?? `feedback_${this.feedback.length + 1}`,
    };
    if (!this.observations.has(feedback.targetId)) {
      throw new Error(`Unknown observation: ${feedback.targetId}`);
    }
    this.feedback.push(feedback);
    return feedback;
  }

  detectHypotheses(): TasteHypothesis[] {
    const grouped = new Map<string, { positive: number; negative: number; evidence: Set<string>; domain: CreativeObservation["domain"] }>();

    for (const feedback of this.feedback) {
      const observation = this.observations.get(feedback.targetId);
      if (!observation) continue;
      const key = `${observation.domain}:${observation.technique}`;
      const group = grouped.get(key) ?? {
        positive: 0,
        negative: 0,
        evidence: new Set<string>(),
        domain: observation.domain,
      };
      const weight = WEIGHTS[feedback.scope];
      if (feedback.signal === "positive") group.positive += weight;
      else group.negative += weight;
      group.evidence.add(feedback.id);
      grouped.set(key, group);
    }

    return [...grouped.entries()].map(([key, group]) => {
      const total = group.positive + group.negative;
      const confidence = total === 0 ? 0 : Math.min(1, Math.abs(group.positive - group.negative) / total);
      return {
        id: `taste_${key.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
        domain: group.domain,
        pattern: key.slice(key.indexOf(":") + 1),
        supportingEvidence: [...group.evidence],
        positiveCount: group.positive,
        negativeCount: group.negative,
        confidence,
        status: "candidate" as const,
      };
    });
  }

  approve(hypothesis: TasteHypothesis, approvedAt = new Date().toISOString()): CreativePreference {
    if (hypothesis.status !== "candidate") {
      throw new Error("Only candidate taste hypotheses can be approved");
    }
    const preference: CreativePreference = {
      id: `preference_${hypothesis.id}`,
      hypothesisId: hypothesis.id,
      domain: hypothesis.domain,
      preference: hypothesis.pattern,
      confidence: hypothesis.confidence,
      provenance: hypothesis.supportingEvidence,
      approvedAt,
    };
    this.approved.set(preference.id, preference);
    return preference;
  }

  reject(hypothesis: TasteHypothesis): TasteHypothesis {
    return { ...hypothesis, status: "rejected" };
  }

  getApprovedPreferences(domain?: CreativeObservation["domain"]): CreativePreference[] {
    return [...this.approved.values()].filter((item) => !domain || item.domain === domain);
  }

  getContext(domain: CreativeObservation["domain"], task: string) {
    return {
      domain,
      task,
      approvedPreferences: this.getApprovedPreferences(domain),
      relevantObservations: [...this.observations.values()].filter((item) => item.domain === domain),
    };
  }
}

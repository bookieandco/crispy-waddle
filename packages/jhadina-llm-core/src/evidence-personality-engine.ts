import type { PersonalityEvidence, PersonalityObservationEngine } from "./personality-contract";

export class HeuristicPersonalityObservationEngine implements PersonalityObservationEngine {
  async observe(input: {
    userId: string;
    sourceId: string;
    text: string;
    context?: string;
  }): Promise<PersonalityEvidence[]> {
    const statement = input.text.trim();
    if (!statement) return [];

    return [{
      id: `pe_${crypto.randomUUID()}`,
      type: "conversation-pattern",
      statement,
      sourceId: input.sourceId,
      observedAt: new Date().toISOString(),
      context: input.context,
      confidence: 0.2,
      userConfirmed: false,
    }];
  }
}

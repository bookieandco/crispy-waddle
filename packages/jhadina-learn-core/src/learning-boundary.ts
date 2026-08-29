import {
  LearnRequest,
  LearningEvent,
  LearningKind,
  LearningRecord,
  LearningRepository,
} from "./learning-contract";

export interface LearningClassifier {
  classify(request: LearnRequest): Promise<Pick<LearningRecord, "kind" | "subject" | "content" | "confidence" | "appliesTo">>;
}

export interface LearningEventSink {
  emit(event: LearningEvent): Promise<void>;
}

export class LearningBoundary {
  constructor(
    private readonly repository: LearningRepository,
    private readonly classifier: LearningClassifier,
    private readonly events: LearningEventSink,
  ) {}

  async learn(request: LearnRequest): Promise<LearningRecord> {
    if (!request.instruction?.trim() && request.sources.length === 0) {
      throw new Error("Jhadina Learn requires an instruction or at least one source.");
    }

    const now = new Date().toISOString();
    const classified = await this.classifier.classify(request);
    const record: LearningRecord = {
      id: `learn_${crypto.randomUUID()}`,
      ...classified,
      authority: "user",
      scope: request.requestedScope ?? "global",
      status: "proposed",
      sources: request.sources,
      createdAt: now,
      updatedAt: now,
    };

    await this.events.emit({
      type: "LEARNING_REQUESTED",
      learningId: record.id,
      occurredAt: now,
      payload: { sourceCount: request.sources.length },
    });

    const saved = await this.repository.save(record);

    await this.events.emit({
      type: "LEARNING_ACCEPTED",
      learningId: saved.id,
      occurredAt: new Date().toISOString(),
      payload: { status: saved.status },
    });

    return saved;
  }
}

export function isLearningKind(value: string): value is LearningKind {
  return [
    "fact",
    "preference",
    "rule",
    "procedure",
    "concept",
    "definition",
    "pattern",
    "instruction",
  ].includes(value);
}

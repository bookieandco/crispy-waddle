import type { LearnRequest, LearningRecord, LearningSourceType } from "./learning-contract";
import type { ExperienceRecord, ExperienceReflection, ExperienceRepository, ExperienceReflector } from "./experience-contract";

export interface LearningExperienceFactory {
  createExperience(input: {
    learning: LearningRecord;
    request: LearnRequest;
  }): Promise<Pick<ExperienceRecord, "content" | "title">>;
}

export class ExperienceBoundary {
  constructor(
    private readonly repository: ExperienceRepository,
    private readonly factory: LearningExperienceFactory,
    private readonly reflector: ExperienceReflector,
  ) {}

  async experience(learning: LearningRecord, request: LearnRequest): Promise<ExperienceRecord> {
    const now = new Date().toISOString();
    const material = await this.factory.createExperience({ learning, request });
    const sourceTypes = request.sources.map((source) => source.type as LearningSourceType);
    const base: ExperienceRecord = {
      id: `experience_${crypto.randomUUID()}`,
      sourceLearningId: learning.id,
      sourceTypes,
      title: material.title,
      instruction: request.instruction,
      status: "experienced",
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(base);
    const reflection = await this.reflector.reflect({
      instruction: request.instruction,
      sources: sourceTypes,
      content: material.content,
    });

    const reflected: ExperienceRecord = {
      ...base,
      reflection,
      status: "reflected",
      updatedAt: new Date().toISOString(),
    };
    return this.repository.save(reflected);
  }
}

export function personalitySignals(reflection: ExperienceReflection): string[] {
  return [
    ...reflection.adoptedSignals,
    ...reflection.rejectedSignals,
    ...reflection.unresolvedSignals,
  ];
}

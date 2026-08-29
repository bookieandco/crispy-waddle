import type { ExperienceRecord, ExperienceRepository } from "./experience-contract";

export class InMemoryExperienceRepository implements ExperienceRepository {
  private readonly records = new Map<string, ExperienceRecord>();

  async save(record: ExperienceRecord): Promise<ExperienceRecord> {
    this.records.set(record.id, record);
    return record;
  }

  async get(id: string): Promise<ExperienceRecord | null> {
    return this.records.get(id) ?? null;
  }

  async listByLearningId(learningId: string): Promise<ExperienceRecord[]> {
    return [...this.records.values()].filter((record) => record.sourceLearningId === learningId);
  }
}

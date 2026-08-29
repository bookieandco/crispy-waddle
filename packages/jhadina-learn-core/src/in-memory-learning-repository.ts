import { LearningRecord, LearningRepository, LearningScope } from "./learning-contract";

export class InMemoryLearningRepository implements LearningRepository {
  private readonly records = new Map<string, LearningRecord>();

  async save(record: LearningRecord): Promise<LearningRecord> {
    this.records.set(record.id, record);
    return record;
  }

  async get(id: string): Promise<LearningRecord | null> {
    return this.records.get(id) ?? null;
  }

  async listActive(scope?: LearningScope): Promise<LearningRecord[]> {
    return [...this.records.values()].filter(
      (record) => record.status === "active" && (!scope || record.scope === scope),
    );
  }

  async revoke(id: string, at = new Date().toISOString()): Promise<LearningRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`Learning record not found: ${id}`);

    const revoked = { ...existing, status: "revoked" as const, updatedAt: at };
    this.records.set(id, revoked);
    return revoked;
  }
}

import type { Memory, MemoryCandidate, ProposedPreference } from "../types.js";
import type { InMemoryStore } from "../storage/InMemoryStore.js";
import type { SqlClient } from "../storage/SqlClient.js";

export interface CreateCandidateInput {
  driverId: string;
  observationText: string;
  proposedPreference: ProposedPreference;
  triggeredBy: string;
}

/**
 * Candidates and memories are one repository because the state machine that
 * moves a candidate to a memory (approve) is a single invariant: a memory
 * only ever exists because a candidate was approved. Splitting them into
 * two repositories would let a caller create a Memory directly, bypassing
 * the human-in-the-loop step this whole module exists to enforce.
 */
export interface MemoryRepository {
  createCandidate(input: CreateCandidateInput): Promise<MemoryCandidate>;
  getCandidate(id: string): Promise<MemoryCandidate | null>;
  listPendingCandidates(driverId: string): Promise<MemoryCandidate[]>;
  /** Moves a PENDING candidate to APPROVED and creates the corresponding Memory. Throws if not pending. */
  approveCandidate(id: string): Promise<{ candidate: MemoryCandidate; memory: Memory }>;
  /** Moves a PENDING candidate to REJECTED. Throws if not pending. */
  rejectCandidate(id: string): Promise<MemoryCandidate>;
  listMemories(driverId: string): Promise<Memory[]>;
}

export class InMemoryMemoryRepository implements MemoryRepository {
  constructor(private readonly store: InMemoryStore) {}

  async createCandidate(input: CreateCandidateInput): Promise<MemoryCandidate> {
    const candidate: MemoryCandidate = {
      id: this.store.nextId("cand"),
      driverId: input.driverId,
      observationText: input.observationText,
      proposedPreference: input.proposedPreference,
      triggeredBy: input.triggeredBy,
      status: "pending",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    this.store.memoryCandidates.set(candidate.id, candidate);
    return candidate;
  }

  async getCandidate(id: string): Promise<MemoryCandidate | null> {
    return this.store.memoryCandidates.get(id) ?? null;
  }

  async listPendingCandidates(driverId: string): Promise<MemoryCandidate[]> {
    return Array.from(this.store.memoryCandidates.values())
      .filter((c) => c.driverId === driverId && c.status === "pending")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async approveCandidate(id: string): Promise<{ candidate: MemoryCandidate; memory: Memory }> {
    const candidate = this.store.memoryCandidates.get(id);
    if (!candidate) throw new Error(`Memory candidate not found: ${id}`);
    if (candidate.status !== "pending") {
      throw new Error(`Cannot approve candidate ${id}: status is ${candidate.status}, not pending`);
    }

    const resolvedCandidate: MemoryCandidate = {
      ...candidate,
      status: "approved",
      resolvedAt: new Date().toISOString(),
    };
    this.store.memoryCandidates.set(id, resolvedCandidate);

    const memory: Memory = {
      id: this.store.nextId("mem"),
      driverId: candidate.driverId,
      memoryCandidateId: candidate.id,
      compiledPreferenceRule: candidate.proposedPreference,
      appliedAt: new Date().toISOString(),
    };
    this.store.memories.set(memory.id, memory);

    return { candidate: resolvedCandidate, memory };
  }

  async rejectCandidate(id: string): Promise<MemoryCandidate> {
    const candidate = this.store.memoryCandidates.get(id);
    if (!candidate) throw new Error(`Memory candidate not found: ${id}`);
    if (candidate.status !== "pending") {
      throw new Error(`Cannot reject candidate ${id}: status is ${candidate.status}, not pending`);
    }
    const resolved: MemoryCandidate = { ...candidate, status: "rejected", resolvedAt: new Date().toISOString() };
    this.store.memoryCandidates.set(id, resolved);
    return resolved;
  }

  async listMemories(driverId: string): Promise<Memory[]> {
    return Array.from(this.store.memories.values())
      .filter((m) => m.driverId === driverId)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }
}

export class PostgresMemoryRepository implements MemoryRepository {
  constructor(private readonly db: SqlClient) {}

  async createCandidate(input: CreateCandidateInput): Promise<MemoryCandidate> {
    const id = `cand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query<CandidateRow>(
      `insert into truckeros_memory_candidates
         (id, driver_id, observation_text, proposed_preference, triggered_by, status)
       values ($1,$2,$3,$4::jsonb,$5,'pending')
       returning *`,
      [id, input.driverId, input.observationText, JSON.stringify(input.proposedPreference), input.triggeredBy]
    );
    return candidateFromRow(result.rows[0]);
  }

  async getCandidate(id: string): Promise<MemoryCandidate | null> {
    const result = await this.db.query<CandidateRow>(
      `select * from truckeros_memory_candidates where id = $1`,
      [id]
    );
    return result.rows[0] ? candidateFromRow(result.rows[0]) : null;
  }

  async listPendingCandidates(driverId: string): Promise<MemoryCandidate[]> {
    const result = await this.db.query<CandidateRow>(
      `select * from truckeros_memory_candidates where driver_id = $1 and status = 'pending' order by created_at desc`,
      [driverId]
    );
    return result.rows.map(candidateFromRow);
  }

  async approveCandidate(id: string): Promise<{ candidate: MemoryCandidate; memory: Memory }> {
    const existing = await this.getCandidate(id);
    if (!existing) throw new Error(`Memory candidate not found: ${id}`);
    if (existing.status !== "pending") {
      throw new Error(`Cannot approve candidate ${id}: status is ${existing.status}, not pending`);
    }

    const updated = await this.db.query<CandidateRow>(
      `update truckeros_memory_candidates set status = 'approved', resolved_at = now() where id = $1 returning *`,
      [id]
    );

    const memId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const memResult = await this.db.query<MemoryRow>(
      `insert into truckeros_memories (id, driver_id, memory_candidate_id, compiled_preference_rule)
       values ($1,$2,$3,$4::jsonb)
       returning *`,
      [memId, existing.driverId, id, JSON.stringify(existing.proposedPreference)]
    );

    return { candidate: candidateFromRow(updated.rows[0]), memory: memoryFromRow(memResult.rows[0]) };
  }

  async rejectCandidate(id: string): Promise<MemoryCandidate> {
    const existing = await this.getCandidate(id);
    if (!existing) throw new Error(`Memory candidate not found: ${id}`);
    if (existing.status !== "pending") {
      throw new Error(`Cannot reject candidate ${id}: status is ${existing.status}, not pending`);
    }
    const result = await this.db.query<CandidateRow>(
      `update truckeros_memory_candidates set status = 'rejected', resolved_at = now() where id = $1 returning *`,
      [id]
    );
    return candidateFromRow(result.rows[0]);
  }

  async listMemories(driverId: string): Promise<Memory[]> {
    const result = await this.db.query<MemoryRow>(
      `select * from truckeros_memories where driver_id = $1 order by applied_at desc`,
      [driverId]
    );
    return result.rows.map(memoryFromRow);
  }
}

interface CandidateRow {
  id: string;
  driver_id: string;
  observation_text: string;
  proposed_preference: ProposedPreference;
  triggered_by: string;
  status: MemoryCandidate["status"];
  created_at: string;
  resolved_at: string | null;
}

function candidateFromRow(row: CandidateRow): MemoryCandidate {
  return {
    id: row.id,
    driverId: row.driver_id,
    observationText: row.observation_text,
    proposedPreference: row.proposed_preference,
    triggeredBy: row.triggered_by,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

interface MemoryRow {
  id: string;
  driver_id: string;
  memory_candidate_id: string | null;
  compiled_preference_rule: ProposedPreference;
  applied_at: string;
}

function memoryFromRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    driverId: row.driver_id,
    memoryCandidateId: row.memory_candidate_id,
    compiledPreferenceRule: row.compiled_preference_rule,
    appliedAt: row.applied_at,
  };
}

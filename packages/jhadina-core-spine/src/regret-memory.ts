import type { EvidenceRef } from './types.js';
import type { RegretRecord } from './regret.js';

export interface RegretMemoryRecord {
  readonly memoryId: string;
  readonly regret: RegretRecord;
  readonly createdAt: string;
  readonly provenance: readonly EvidenceRef[];
  readonly tags: readonly string[];
  readonly salience: number;
  readonly supersedes?: string;
  readonly supersededBy?: string;
}

export interface RegretMemoryQuery {
  readonly text?: string;
  readonly subjectType?: RegretRecord['subjectType'];
  readonly status?: RegretRecord['status'];
  readonly tags?: readonly string[];
  readonly limit?: number;
  readonly includeSuperseded?: boolean;
}

export interface RegretRecallResult {
  readonly memoryId: string;
  readonly score: number;
  readonly record: RegretMemoryRecord;
}

export interface RegretRecallEvaluation {
  readonly relevantMemoryIds: readonly string[];
  readonly returnedMemoryIds: readonly string[];
  readonly k: number;
  readonly recallAtK: number;
}

export interface RegretMemory {
  append(record: RegretMemoryRecord): RegretMemoryRecord;
  getById(memoryId: string): RegretMemoryRecord | null;
  retrieve(query: RegretMemoryQuery): readonly RegretRecallResult[];
  listRelated(memoryId: string): readonly RegretMemoryRecord[];
  findRecurrences(rootCause: string): readonly RegretMemoryRecord[];
  supersede(memoryId: string, replacementMemoryId: string): void;
  getProvenance(memoryId: string): readonly EvidenceRef[];
  evaluateRecall(query: RegretMemoryQuery, relevantMemoryIds: readonly string[], k?: number): RegretRecallEvaluation;
}

const MAX_RECALL_LIMIT = 50;

function normalize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function textFor(record: RegretMemoryRecord): string {
  const r = record.regret;
  return [
    r.subjectType,
    r.subjectId,
    r.originalBelief,
    r.expectedOutcome,
    r.actualOutcome,
    r.discrepancy,
    r.rootCause ?? '',
    ...record.tags,
  ].join(' ');
}

function lexicalScore(queryText: string, record: RegretMemoryRecord): number {
  const query = new Set(normalize(queryText));
  if (query.size === 0) return 0;
  const terms = normalize(textFor(record));
  const matches = terms.reduce((count, term) => count + (query.has(term) ? 1 : 0), 0);
  return matches / query.size;
}

export class InMemoryRegretMemory implements RegretMemory {
  private readonly records = new Map<string, RegretMemoryRecord>();

  append(record: RegretMemoryRecord): RegretMemoryRecord {
    if (this.records.has(record.memoryId)) throw new Error(`regret memory already exists: ${record.memoryId}`);
    if (!Number.isFinite(record.salience) || record.salience < 0 || record.salience > 1) {
      throw new Error('regret memory salience must be between 0 and 1');
    }
    const frozen = Object.freeze({
      ...record,
      provenance: Object.freeze([...record.provenance]),
      tags: Object.freeze([...record.tags]),
    });
    this.records.set(record.memoryId, frozen);
    return frozen;
  }

  getById(memoryId: string): RegretMemoryRecord | null {
    return this.records.get(memoryId) ?? null;
  }

  retrieve(query: RegretMemoryQuery): readonly RegretRecallResult[] {
    const limit = Math.min(MAX_RECALL_LIMIT, Math.max(1, query.limit ?? 10));
    const requestedTags = new Set(query.tags ?? []);
    const candidates = [...this.records.values()].filter((record) => {
      if (!query.includeSuperseded && (record.supersededBy || record.regret.status === 'superseded')) return false;
      if (query.subjectType && record.regret.subjectType !== query.subjectType) return false;
      if (query.status && record.regret.status !== query.status) return false;
      if (requestedTags.size > 0 && ![...requestedTags].every((tag) => record.tags.includes(tag))) return false;
      return true;
    });

    return candidates
      .map((record) => {
        const lexical = query.text ? lexicalScore(query.text, record) : 0;
        const recurrence = Math.min(1, record.regret.recurrenceCount / 5);
        const score = lexical * 0.65 + record.salience * 0.2 + recurrence * 0.15;
        return { memoryId: record.memoryId, score, record };
      })
      .sort((a, b) => b.score - a.score || a.record.createdAt.localeCompare(b.record.createdAt) * -1 || a.memoryId.localeCompare(b.memoryId))
      .slice(0, limit);
  }

  listRelated(memoryId: string): readonly RegretMemoryRecord[] {
    const target = this.records.get(memoryId);
    if (!target) return [];
    const rootCause = target.regret.rootCause;
    return [...this.records.values()].filter((record) =>
      record.memoryId !== memoryId &&
      (record.regret.subjectId === target.regret.subjectId ||
        (rootCause !== undefined && record.regret.rootCause === rootCause) ||
        record.regret.counterfactualId === target.regret.counterfactualId),
    );
  }

  findRecurrences(rootCause: string): readonly RegretMemoryRecord[] {
    return [...this.records.values()].filter((record) => record.regret.rootCause === rootCause);
  }

  supersede(memoryId: string, replacementMemoryId: string): void {
    const current = this.records.get(memoryId);
    const replacement = this.records.get(replacementMemoryId);
    if (!current || !replacement) throw new Error('both regret memories must exist before supersession');
    if (current.supersededBy) throw new Error(`regret memory already superseded: ${memoryId}`);
    if (replacement.supersedes !== memoryId) throw new Error('replacement must declare the memory it supersedes');
    this.records.set(memoryId, Object.freeze({ ...current, supersededBy: replacementMemoryId }));
    this.records.set(replacementMemoryId, Object.freeze({ ...replacement }));
  }

  getProvenance(memoryId: string): readonly EvidenceRef[] {
    return this.records.get(memoryId)?.provenance ?? [];
  }

  evaluateRecall(query: RegretMemoryQuery, relevantMemoryIds: readonly string[], k = 10): RegretRecallEvaluation {
    const boundedK = Math.max(1, Math.min(MAX_RECALL_LIMIT, k));
    const returned = this.retrieve({ ...query, limit: boundedK }).map((result) => result.memoryId);
    const relevant = new Set(relevantMemoryIds);
    const hits = returned.filter((id) => relevant.has(id)).length;
    return Object.freeze({
      relevantMemoryIds: Object.freeze([...relevantMemoryIds]),
      returnedMemoryIds: Object.freeze(returned),
      k: boundedK,
      recallAtK: relevant.size === 0 ? 0 : hits / relevant.size,
    });
  }
}

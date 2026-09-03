import type { ListeningFrame } from "./listening-frame.js";

export type MusicMemoryKind =
  | "observation"
  | "human-preference"
  | "correction"
  | "decision"
  | "outcome";

export interface MusicPerceptionMemory {
  id: string;
  kind: MusicMemoryKind;
  sourceArtifactId?: string;
  frameId?: string;
  createdAt: string;
  statement: string;
  evidenceIds: string[];
  confidence: number;
  scope: "source-specific" | "session" | "general";
  approved: boolean;
  immutableEvidence: boolean;
}

export interface MusicMemoryQuery {
  sourceArtifactId?: string;
  frameId?: string;
  kind?: MusicMemoryKind;
  scope?: MusicPerceptionMemory["scope"];
  approvedOnly?: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const unique = (values: string[]): string[] => [...new Set(values)];

/**
 * Append-only memory for musical perception and human feedback.
 * Memory may influence future judgment, but it never rewrites source evidence.
 */
export class MusicPerceptionMemoryStore {
  private readonly memories = new Map<string, MusicPerceptionMemory>();

  append(memory: MusicPerceptionMemory): MusicPerceptionMemory {
    if (this.memories.has(memory.id)) throw new Error(`Music memory already exists: ${memory.id}`);
    if (!memory.statement.trim()) throw new Error("Music memory statement cannot be empty.");
    const normalized: MusicPerceptionMemory = {
      ...memory,
      statement: memory.statement.trim(),
      evidenceIds: unique(memory.evidenceIds),
      confidence: clamp01(memory.confidence),
      immutableEvidence: true,
    };
    this.memories.set(normalized.id, normalized);
    return normalized;
  }

  query(query: MusicMemoryQuery = {}): MusicPerceptionMemory[] {
    return [...this.memories.values()].filter((memory) =>
      (!query.sourceArtifactId || memory.sourceArtifactId === query.sourceArtifactId) &&
      (!query.frameId || memory.frameId === query.frameId) &&
      (!query.kind || memory.kind === query.kind) &&
      (!query.scope || memory.scope === query.scope) &&
      (!query.approvedOnly || memory.approved),
    );
  }

  get(id: string): MusicPerceptionMemory | undefined {
    return this.memories.get(id);
  }

  size(): number {
    return this.memories.size;
  }
}

/**
 * Converts a ListeningFrame into a factual observation memory without inventing
 * descriptors or turning perceptual hypotheses into established facts.
 */
export function memoryFromListeningFrame(input: {
  frame: ListeningFrame;
  statement: string;
  createdAt?: string;
}): MusicPerceptionMemory {
  return {
    id: `music-memory:${input.frame.id}`,
    kind: "observation",
    sourceArtifactId: input.frame.sourceArtifactId,
    frameId: input.frame.id,
    createdAt: input.createdAt ?? new Date().toISOString(),
    statement: input.statement,
    evidenceIds: input.frame.evidenceIds,
    confidence: input.frame.confidence,
    scope: "source-specific",
    approved: true,
    immutableEvidence: true,
  };
}

/** Human feedback remains explicitly distinguishable from machine observation. */
export function createHumanPreferenceMemory(input: {
  id: string;
  sourceArtifactId?: string;
  frameId?: string;
  statement: string;
  evidenceIds?: string[];
  confidence?: number;
  approved: boolean;
  createdAt?: string;
}): MusicPerceptionMemory {
  return {
    id: input.id,
    kind: "human-preference",
    sourceArtifactId: input.sourceArtifactId,
    frameId: input.frameId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    statement: input.statement,
    evidenceIds: unique(input.evidenceIds ?? []),
    confidence: clamp01(input.confidence ?? 1),
    scope: "general",
    approved: input.approved,
    immutableEvidence: true,
  };
}

/**
 * Returns memories safe for judgment context. Unapproved human preferences are
 * excluded; source evidence is represented only by references, never overwritten.
 */
export function buildMusicJudgmentMemory(input: {
  sourceArtifactId: string;
  frameId?: string;
  store: MusicPerceptionMemoryStore;
}): MusicPerceptionMemory[] {
  return input.store.query({ approvedOnly: true }).filter((memory) =>
    !memory.sourceArtifactId ||
    memory.sourceArtifactId === input.sourceArtifactId,
  ).filter((memory) => !input.frameId || !memory.frameId || memory.frameId === input.frameId);
}

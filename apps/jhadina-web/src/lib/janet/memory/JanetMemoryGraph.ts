/**
 * Janet's long-term memory boundary.
 *
 * Inspired by graph-first memory systems such as MemoryBear, while keeping
 * Jhadina's approval gate authoritative: candidates never become durable
 * memory until explicitly approved.
 */
export type JanetMemoryKind =
  | "episodic"
  | "semantic"
  | "preference"
  | "identity"
  | "goal"
  | "context";

export interface JanetMemoryNode {
  id: string;
  userId: string;
  kind: JanetMemoryKind;
  content: string;
  createdAt: string;
  lastConfirmedAt?: string;
  confidence: number;
  salience: number;
  decayRate: number;
  sourceEventIds: string[];
  approvedAt: string;
}

export interface JanetMemoryEdge {
  id: string;
  fromMemoryId: string;
  toMemoryId: string;
  relation:
    | "supports"
    | "contradicts"
    | "refines"
    | "caused_by"
    | "related_to";
  weight: number;
  evidenceEventIds: string[];
}

export interface JanetMemoryCandidate {
  id: string;
  userId: string;
  kind: JanetMemoryKind;
  content: string;
  confidence: number;
  sourceEventIds: string[];
  status: "pending" | "approved" | "rejected";
}

export interface JanetMemoryRepository {
  createCandidate(candidate: Omit<JanetMemoryCandidate, "id" | "status">): Promise<JanetMemoryCandidate>;
  approveCandidate(candidateId: string, userId: string): Promise<JanetMemoryNode>;
  rejectCandidate(candidateId: string, userId: string): Promise<void>;
  search(userId: string, query: string, limit?: number): Promise<JanetMemoryNode[]>;
  relate(edge: Omit<JanetMemoryEdge, "id">): Promise<JanetMemoryEdge>;
  reflect(userId: string): Promise<JanetReflection[]>;
  applyDecay(userId: string, now?: string): Promise<JanetDecayResult>;
}

export interface JanetReflection {
  type: "contradiction" | "reinforcement" | "stale_memory" | "cluster";
  memoryIds: string[];
  explanation: string;
  confidence: number;
  requiresApproval: boolean;
}

export interface JanetDecayResult {
  inspected: number;
  retained: number;
  weakened: number;
  archived: number;
  archivedMemoryIds: string[];
}

/**
 * Deterministic decay policy. Decay changes retrieval strength; it does not
 * silently delete approved memories. Archival/deletion remains auditable.
 */
export function calculateMemoryStrength(
  memory: JanetMemoryNode,
  now = Date.now(),
): number {
  const lastConfirmed = Date.parse(memory.lastConfirmedAt ?? memory.approvedAt);
  const ageDays = Math.max(0, (now - lastConfirmed) / 86_400_000);
  return Math.max(
    0,
    Math.min(1, memory.confidence * memory.salience * Math.exp(-memory.decayRate * ageDays)),
  );
}

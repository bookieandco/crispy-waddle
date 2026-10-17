export type RetrievalSourceKind = 'memory' | 'knowledge' | 'domain' | 'research';
export type RetrievalChannel = 'lexical' | 'vector' | 'graph' | 'domain';

export interface RetrievalQuery {
  readonly taskId: string;
  readonly text: string;
  readonly limit: number;
}

export interface RetrievalCandidate {
  readonly evidenceId: string;
  readonly sourceKind: RetrievalSourceKind;
  readonly sourceId: string;
  readonly channel: RetrievalChannel;
  readonly summary: string;
  readonly score: number;
  readonly observedAt: string;
  readonly provenance: readonly string[];
  readonly contradictionGroup?: string;
}

export interface RetrievalSource {
  readonly name: string;
  retrieve(query: RetrievalQuery): Promise<readonly RetrievalCandidate[]>;
}

export interface HybridRetrievalResult {
  readonly candidates: readonly RetrievalCandidate[];
  readonly sourceFailures: readonly { source: string; errorCode: string }[];
}

/**
 * Read-only retrieval bridge. Authorization is deliberately NOT implemented
 * here: JLLM-07 must filter authorized candidates before any reranker sees
 * them. This bridge only normalizes and merges source results.
 */
export class HybridRetrievalBridge {
  constructor(private readonly sources: readonly RetrievalSource[]) {}

  async retrieve(query: RetrievalQuery): Promise<HybridRetrievalResult> {
    if (!query.text.trim()) throw new Error('RETRIEVAL_QUERY_REQUIRED');
    if (!Number.isInteger(query.limit) || query.limit < 1) throw new Error('RETRIEVAL_LIMIT_INVALID');

    const settled = await Promise.all(this.sources.map(async (source) => {
      try { return { source: source.name, candidates: await source.retrieve(query) } as const; }
      catch (error) { return { source: source.name, error } as const; }
    }));

    const failures: Array<{ source: string; errorCode: string }> = [];
    const byEvidence = new Map<string, RetrievalCandidate>();

    for (const result of settled) {
      if ('error' in result) {
        failures.push({ source: result.source, errorCode: errorCode(result.error) });
        continue;
      }
      for (const candidate of result.candidates) {
        validate(candidate);
        const prior = byEvidence.get(candidate.evidenceId);
        if (!prior || candidate.score > prior.score) byEvidence.set(candidate.evidenceId, freezeCandidate(candidate));
      }
    }

    // Contradictory evidence is intentionally retained. No belief/majority
    // filter is permitted at retrieval time.
    const candidates = [...byEvidence.values()]
      .sort((a, b) => b.score - a.score || a.evidenceId.localeCompare(b.evidenceId))
      .slice(0, query.limit);

    return Object.freeze({
      candidates: Object.freeze(candidates),
      sourceFailures: Object.freeze(failures),
    });
  }
}

function validate(candidate: RetrievalCandidate): void {
  if (!candidate.evidenceId.trim() || !candidate.sourceId.trim() || !candidate.summary.trim()) {
    throw new Error('RETRIEVAL_CANDIDATE_IDENTITY_INVALID');
  }
  if (!Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
    throw new Error(`RETRIEVAL_CANDIDATE_SCORE_INVALID:${candidate.evidenceId}`);
  }
  if (!candidate.provenance.length) throw new Error(`RETRIEVAL_PROVENANCE_REQUIRED:${candidate.evidenceId}`);
}

function freezeCandidate(candidate: RetrievalCandidate): RetrievalCandidate {
  return Object.freeze({ ...candidate, provenance: Object.freeze([...candidate.provenance]) });
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.name || 'RETRIEVAL_SOURCE_ERROR' : 'RETRIEVAL_SOURCE_ERROR';
}

import type { RetrievalCandidate, RetrievalQuery } from './hybrid-retrieval.js';

export interface RetrievalPrincipal {
  readonly actorId: string;
  readonly tenantId?: string;
}

export interface RetrievalAuthorizationRequest {
  readonly principal: RetrievalPrincipal;
  readonly taskId: string;
  readonly evidenceId: string;
  readonly sourceKind: RetrievalCandidate['sourceKind'];
  readonly sourceId: string;
}

export interface RetrievalAuthorizer {
  authorize(request: RetrievalAuthorizationRequest): Promise<'allow' | 'deny'>;
}

export interface RetrievalReranker {
  rerank(input: {
    readonly query: RetrievalQuery;
    readonly candidates: readonly RetrievalCandidate[];
  }): Promise<readonly RetrievalCandidate[]>;
}

export interface AuthorizedRetrievalResult {
  readonly candidates: readonly RetrievalCandidate[];
  readonly deniedEvidenceIds: readonly string[];
}

/**
 * Security boundary for retrieval:
 * raw candidates -> authorization -> optional reranking.
 *
 * A reranker never receives denied candidate content. This prevents semantic
 * ranking/model infrastructure from becoming a side channel into memories,
 * knowledge, research, or domain evidence the actor cannot read.
 */
export class AuthorizedRetrievalPipeline {
  constructor(
    private readonly authorizer: RetrievalAuthorizer,
    private readonly reranker?: RetrievalReranker,
  ) {}

  async process(input: {
    readonly principal: RetrievalPrincipal;
    readonly query: RetrievalQuery;
    readonly candidates: readonly RetrievalCandidate[];
  }): Promise<AuthorizedRetrievalResult> {
    if (!input.principal.actorId.trim()) throw new Error('RETRIEVAL_ACTOR_REQUIRED');

    const allowed: RetrievalCandidate[] = [];
    const denied: string[] = [];

    for (const candidate of input.candidates) {
      const decision = await this.authorizer.authorize({
        principal: input.principal,
        taskId: input.query.taskId,
        evidenceId: candidate.evidenceId,
        sourceKind: candidate.sourceKind,
        sourceId: candidate.sourceId,
      });
      if (decision === 'allow') allowed.push(candidate);
      else denied.push(candidate.evidenceId);
    }

    const safe = Object.freeze([...allowed]);
    const ranked = this.reranker
      ? await this.reranker.rerank({ query: input.query, candidates: safe })
      : safe;

    assertRerankerDidNotInject(ranked, allowed);
    return Object.freeze({
      candidates: Object.freeze([...ranked].slice(0, input.query.limit)),
      deniedEvidenceIds: Object.freeze(denied),
    });
  }
}

function assertRerankerDidNotInject(
  ranked: readonly RetrievalCandidate[],
  authorized: readonly RetrievalCandidate[],
): void {
  const allowedIds = new Set(authorized.map((candidate) => candidate.evidenceId));
  const seen = new Set<string>();
  for (const candidate of ranked) {
    if (!allowedIds.has(candidate.evidenceId)) {
      throw new Error(`RERANKER_UNAUTHORIZED_CANDIDATE:${candidate.evidenceId}`);
    }
    if (seen.has(candidate.evidenceId)) {
      throw new Error(`RERANKER_DUPLICATE_CANDIDATE:${candidate.evidenceId}`);
    }
    seen.add(candidate.evidenceId);
  }
}

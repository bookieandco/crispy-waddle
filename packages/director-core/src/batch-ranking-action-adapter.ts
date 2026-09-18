import { rankCandidates, type RankedCandidate } from './candidate-ranking.js';
import type { ContinuityCandidate } from './continuity-qc.js';
import type { ContinuityManifest } from './continuity-manifest.js';

/** Registration shape for the governed action boundary. Execution authority remains external. */
export type DirectorActionAdapter<TInput = unknown, TResult = unknown> = {
  domain: string;
  capability: string;
  execute(input: TInput): Promise<TResult>;
};

type RankingInput = {
  previous: ContinuityManifest;
  candidates: Array<ContinuityCandidate & { variation?: string; provider?: string; providerJobId?: string }>;
};

export function createBatchRankingActionAdapter(): DirectorActionAdapter<RankingInput, { rankedCandidates: RankedCandidate[] }> {
  return {
    domain: 'directoros',
    capability: 'take.rankCandidates',
    async execute(input) {
      return { rankedCandidates: rankCandidates(input.previous, input.candidates) };
    },
  };
}

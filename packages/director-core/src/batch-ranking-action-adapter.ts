import type { ActionAdapter } from '@jhadina/integration';
import { rankCandidates, type RankedCandidate } from './candidate-ranking.js';
import type { ContinuityCandidate } from './continuity-qc.js';
import type { ContinuityManifest } from './continuity-manifest.js';

export function createBatchRankingActionAdapter(): ActionAdapter {
  return {
    domain: 'directoros',
    capability: 'take.rankCandidates',
    async execute(input: { previous: ContinuityManifest; candidates: Array<ContinuityCandidate & { variation?: string; provider?: string; providerJobId?: string }> }): Promise<{ rankedCandidates: RankedCandidate[] }> {
      return { rankedCandidates: rankCandidates(input.previous, input.candidates) };
    },
  };
}

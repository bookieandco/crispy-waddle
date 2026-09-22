import type { SharkChain } from '../wallets/MultiChainWallet';

export type ObservationSource =
  | 'dex'
  | 'chain'
  | 'wallet'
  | 'social'
  | 'telegram'
  | 'reddit'
  | 'market'
  | 'news'
  | 'mining'
  | 'internal';

export type ObservationKind =
  | 'price'
  | 'liquidity'
  | 'volume'
  | 'holder_distribution'
  | 'wallet_flow'
  | 'contract_change'
  | 'social_signal'
  | 'creator_behavior'
  | 'migration'
  | 'market_regime'
  | 'mining_activity'
  | 'other';

export interface ObservationEvidence {
  readonly source: ObservationSource;
  readonly sourceId?: string;
  readonly uri?: string;
  readonly observedAt: string;
  readonly reliability: number;
  readonly excerpt?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SharkObservation {
  readonly id: string;
  readonly observedAt: string;
  readonly chain?: SharkChain;
  readonly subjectId: string;
  readonly subjectType: 'token' | 'pool' | 'wallet' | 'creator' | 'market' | 'mining';
  readonly kind: ObservationKind;
  readonly value: Readonly<Record<string, unknown>>;
  readonly evidence: readonly ObservationEvidence[];
  readonly confidence: number;
  readonly novelty: number;
  readonly contradictions?: readonly string[];
  readonly tags?: readonly string[];
}

export function observationIsReliable(observation: SharkObservation): boolean {
  return observation.confidence >= 0.7 &&
    observation.evidence.some((evidence) => evidence.reliability >= 0.7);
}

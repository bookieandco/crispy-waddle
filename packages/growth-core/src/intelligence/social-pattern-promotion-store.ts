import type { GrowthId } from '../domain/types.js';
import type { PromotedSocialPattern } from './social-pattern-promotion.js';

export type SocialPatternPromotionStatus = 'promoted' | 'revoked';

export interface SocialPatternPromotionRecord extends PromotedSocialPattern {
  readonly status: SocialPatternPromotionStatus;
  readonly promotedAt: string;
  readonly experimentId: GrowthId;
  readonly revokedAt?: string;
  readonly revocationReason?: string;
}

export interface SocialPatternPromotionStore {
  getById(id: GrowthId): Promise<SocialPatternPromotionRecord | null>;
  listForAccount(accountId: GrowthId): Promise<readonly SocialPatternPromotionRecord[]>;
  upsert(record: SocialPatternPromotionRecord): Promise<void>;
  revoke(id: GrowthId, revokedAt: string, reason: string): Promise<void>;
}

function mergeMonotonic(existing: SocialPatternPromotionRecord | undefined, incoming: SocialPatternPromotionRecord): SocialPatternPromotionRecord {
  if (!existing) return incoming;
  if (
    existing.hypothesisId !== incoming.hypothesisId ||
    existing.sourcePatternId !== incoming.sourcePatternId ||
    existing.sourceAccountId !== incoming.sourceAccountId ||
    existing.targetAccountId !== incoming.targetAccountId ||
    existing.targetAudienceId !== incoming.targetAudienceId ||
    existing.targetVoiceId !== incoming.targetVoiceId ||
    existing.strategy !== incoming.strategy ||
    existing.experimentId !== incoming.experimentId
  ) {
    throw new Error('promotion provenance is immutable');
  }
  if (existing.status === 'revoked') return existing;
  return {
    ...existing,
    ...incoming,
    confidence: Math.max(existing.confidence, incoming.confidence),
    promotedAt: existing.promotedAt <= incoming.promotedAt ? existing.promotedAt : incoming.promotedAt,
  };
}

export class InMemorySocialPatternPromotionStore implements SocialPatternPromotionStore {
  private readonly records = new Map<GrowthId, SocialPatternPromotionRecord>();

  async getById(id: GrowthId): Promise<SocialPatternPromotionRecord | null> {
    return this.records.get(id) ?? null;
  }

  async listForAccount(accountId: GrowthId): Promise<readonly SocialPatternPromotionRecord[]> {
    return [...this.records.values()].filter(record => record.targetAccountId === accountId);
  }

  async upsert(record: SocialPatternPromotionRecord): Promise<void> {
    this.records.set(record.id, mergeMonotonic(this.records.get(record.id), record));
  }

  async revoke(id: GrowthId, revokedAt: string, reason: string): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) throw new Error('promotion not found');
    if (existing.status === 'revoked') return;
    this.records.set(id, { ...existing, status: 'revoked', revokedAt, revocationReason: reason });
  }
}

export async function persistPromotion(
  store: SocialPatternPromotionStore,
  promotion: PromotedSocialPattern,
  experimentId: GrowthId,
  promotedAt: string,
): Promise<SocialPatternPromotionRecord> {
  const record: SocialPatternPromotionRecord = { ...promotion, experimentId, promotedAt, status: 'promoted' };
  await store.upsert(record);
  return (await store.getById(record.id)) ?? record;
}

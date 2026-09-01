import type { GrowthId } from '../domain/types.js';
import type { PromotedSocialPattern } from './social-pattern-promotion.js';

export interface SocialPatternPromotionRecord extends PromotedSocialPattern {
  readonly promotedAt: string;
  readonly experimentId: GrowthId;
}

export interface SocialPatternPromotionStore {
  getById(id: GrowthId): Promise<SocialPatternPromotionRecord | null>;
  listForAccount(accountId: GrowthId): Promise<readonly SocialPatternPromotionRecord[]>;
  upsert(record: SocialPatternPromotionRecord): Promise<void>;
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
    this.records.set(record.id, record);
  }
}

export async function persistPromotion(
  store: SocialPatternPromotionStore,
  promotion: PromotedSocialPattern,
  experimentId: GrowthId,
  promotedAt: string,
): Promise<SocialPatternPromotionRecord> {
  const record: SocialPatternPromotionRecord = { ...promotion, experimentId, promotedAt };
  await store.upsert(record);
  return record;
}

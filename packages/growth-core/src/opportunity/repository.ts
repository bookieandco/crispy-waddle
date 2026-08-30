import type { Opportunity, OpportunityStatus } from './types.js';

export interface OpportunityRepository {
  getById(id: string): Promise<Opportunity | null>;
  list(input?: { status?: OpportunityStatus; sourceType?: Opportunity['sourceType'] }): Promise<Opportunity[]>;
  upsert(opportunity: Opportunity): Promise<Opportunity>;
  transition(id: string, status: OpportunityStatus): Promise<Opportunity>;
}

export interface OpportunitySourceRecord {
  externalId: string;
  title: string;
  summary: string;
  sourceType: Opportunity['sourceType'];
  sourceUrl?: string;
  buyer?: string;
  market?: string;
  economics?: Opportunity['economics'];
  evidence?: Opportunity['evidence'];
  class?: Opportunity['class'];
  stage?: Opportunity['stage'];
}

export function normalizeOpportunity(record: OpportunitySourceRecord, now = new Date().toISOString()): Opportunity {
  return {
    id: `${record.sourceType}:${record.externalId}`,
    title: record.title.trim(),
    summary: record.summary.trim(),
    buyer: record.buyer,
    market: record.market,
    class: record.class ?? 'experiment',
    stage: record.stage ?? 'service',
    sourceType: record.sourceType,
    sourceId: record.externalId,
    sourceUrl: record.sourceUrl,
    evidence: record.evidence ?? [],
    economics: record.economics ?? {},
    status: 'discovered',
    createdAt: now,
    updatedAt: now,
  };
}

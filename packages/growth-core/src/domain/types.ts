export type GrowthId = string;
export type ISODateTime = string;

export type LifecycleStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface Provenance {
  source: string;
  actor: string;
  correlationId?: GrowthId;
}

export interface BaseEntity {
  id: GrowthId;
  version: number;
  status: LifecycleStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  provenance: Provenance;
}

export interface Campaign extends BaseEntity {
  type: 'campaign';
  name: string;
  objective: string;
  audienceIds: GrowthId[];
  offerIds: GrowthId[];
  creativeIds: GrowthId[];
  channelIds: GrowthId[];
}

export interface CreativeConcept extends BaseEntity {
  type: 'creative_concept';
  name: string;
  concept: string;
  campaignId?: GrowthId;
}

export interface Asset extends BaseEntity {
  type: 'asset';
  name: string;
  assetKind: 'video' | 'image' | 'audio' | 'copy' | 'landing_page' | 'other';
  creativeConceptId: GrowthId;
  checksum?: string;
}

export interface AttributionEvent {
  eventId: GrowthId;
  eventType: 'impression' | 'click' | 'landing_view' | 'lead' | 'purchase';
  occurredAt: ISODateTime;
  campaignId?: GrowthId;
  creativeId?: GrowthId;
  channelId?: GrowthId;
  sessionId?: GrowthId;
  orderId?: GrowthId;
  source: string;
  confidence?: number;
}

export interface RevenueEvent {
  eventId: GrowthId;
  eventType: 'revenue_recorded' | 'refund_recorded';
  occurredAt: ISODateTime;
  orderId: GrowthId;
  customerId?: GrowthId;
  amount: number;
  currency: string;
  source: string;
}

export interface Learning {
  id: GrowthId;
  observation: string;
  hypothesis?: string;
  prediction?: string;
  actualOutcome?: string;
  predictionError?: number;
  evidenceEventIds: GrowthId[];
  confidence: number;
  createdAt: ISODateTime;
}

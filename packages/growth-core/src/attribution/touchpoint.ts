import type { GrowthId, ISODateTime } from '../domain/types.js';

export type TouchpointType = 'impression' | 'click' | 'view' | 'engagement' | 'landing_view' | 'lead' | 'purchase';

export interface Touchpoint {
  id: GrowthId;
  type: TouchpointType;
  occurredAt: ISODateTime;
  channelId?: GrowthId;
  campaignId?: GrowthId;
  creativeId?: GrowthId;
  assetId?: GrowthId;
  audienceId?: GrowthId;
  sessionId?: GrowthId;
  anonymousId?: string;
  customerId?: GrowthId;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface Conversion {
  id: GrowthId;
  occurredAt: ISODateTime;
  conversionType: 'lead' | 'purchase' | 'subscription' | 'custom';
  customerId?: GrowthId;
  orderId?: GrowthId;
  sessionId?: GrowthId;
  value?: number;
  currency?: string;
  source: string;
}

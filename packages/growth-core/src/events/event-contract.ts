import type { GrowthId, ISODateTime } from '../domain/types.js';

export type GrowthEventType =
  | 'creative_created'
  | 'asset_created'
  | 'campaign_created'
  | 'campaign_activated'
  | 'ad_published'
  | 'content_viewed'
  | 'content_clicked'
  | 'landing_viewed'
  | 'lead_created'
  | 'conversation_started'
  | 'appointment_booked'
  | 'checkout_started'
  | 'order_created'
  | 'revenue_recorded'
  | 'refund_recorded'
  | 'experiment_started'
  | 'experiment_completed'
  | 'decision_created'
  | 'execution_completed'
  | 'learning_created';

export interface GrowthEvent<TPayload = unknown> {
  eventId: GrowthId;
  eventType: GrowthEventType;
  entityType: string;
  entityId: GrowthId;
  actor: string;
  source: string;
  payload: TPayload;
  occurredAt: ISODateTime;
  correlationId: GrowthId;
  idempotencyKey: string;
}

export function assertGrowthEvent(event: GrowthEvent): void {
  if (!event.eventId || !event.eventType || !event.entityId) {
    throw new Error('Invalid GrowthEvent: identity fields are required');
  }
  if (!event.source || !event.actor || !event.correlationId || !event.idempotencyKey) {
    throw new Error('Invalid GrowthEvent: provenance and idempotency fields are required');
  }
}

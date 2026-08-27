import type { GrowthId, ISODateTime } from '../domain/types.js';

export type FunnelStage = 'discovery' | 'consideration' | 'conversion' | 'retention';

export type FunnelEventType =
  | 'content_viewed'
  | 'content_clicked'
  | 'landing_viewed'
  | 'lead_created'
  | 'conversation_started'
  | 'appointment_booked'
  | 'checkout_started'
  | 'purchase_created'
  | 'refund_recorded';

export interface FunnelEvent {
  eventId: GrowthId;
  eventType: FunnelEventType;
  stage: FunnelStage;
  occurredAt: ISODateTime;
  source: string;
  assetId?: GrowthId;
  campaignId?: GrowthId;
  sessionId?: GrowthId;
  leadId?: GrowthId;
  customerId?: GrowthId;
  orderId?: GrowthId;
  value?: number;
  currency?: string;
}

export interface FunnelSummary {
  views: number;
  clicks: number;
  leads: number;
  conversations: number;
  appointments: number;
  checkouts: number;
  purchases: number;
  refunds: number;
  revenue: number;
}

export function summarizeFunnel(events: readonly FunnelEvent[]): FunnelSummary {
  return events.reduce<FunnelSummary>((summary, event) => {
    switch (event.eventType) {
      case 'content_viewed': summary.views += 1; break;
      case 'content_clicked': summary.clicks += 1; break;
      case 'lead_created': summary.leads += 1; break;
      case 'conversation_started': summary.conversations += 1; break;
      case 'appointment_booked': summary.appointments += 1; break;
      case 'checkout_started': summary.checkouts += 1; break;
      case 'purchase_created': summary.purchases += 1; summary.revenue += event.value ?? 0; break;
      case 'refund_recorded': summary.refunds += 1; summary.revenue -= event.value ?? 0; break;
    }
    return summary;
  }, { views: 0, clicks: 0, leads: 0, conversations: 0, appointments: 0, checkouts: 0, purchases: 0, refunds: 0, revenue: 0 });
}

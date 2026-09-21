import type { GrowthId, ISODateTime } from '../domain/types.js';

export type CustomerLifecycleStage =
  | 'prospect'
  | 'engaged'
  | 'lead'
  | 'customer'
  | 'repeat_customer'
  | 'at_risk'
  | 'churned'
  | 'vip';

export type CustomerConsentChannel = 'email' | 'sms' | 'whatsapp' | 'ads' | 'social_dm';

export interface CustomerProfile {
  id: GrowthId;
  brandId: GrowthId;
  stage: CustomerLifecycleStage;
  firstSeenAt: ISODateTime;
  lastSeenAt: ISODateTime;
  acquisitionChannelId?: GrowthId;
  acquisitionCampaignId?: GrowthId;
  consent: Partial<Record<CustomerConsentChannel, boolean>>;
  externalRefs?: Readonly<Record<string, string>>;
}

export type CustomerBehaviorType =
  | 'page_view'
  | 'product_view'
  | 'site_search'
  | 'customization_started'
  | 'add_to_cart'
  | 'checkout_started'
  | 'purchase'
  | 'email_click'
  | 'sms_click'
  | 'social_engagement'
  | 'social_dm'
  | 'pricing_view'
  | 'demo_request'
  | 'form_submit'
  | 'refund';

export interface CustomerBehaviorEvent {
  id: GrowthId;
  customerId: GrowthId;
  type: CustomerBehaviorType;
  occurredAt: ISODateTime;
  productId?: GrowthId;
  campaignId?: GrowthId;
  value?: number;
  currency?: string;
  source: string;
  confidence?: number;
}

export interface RfmSnapshot {
  customerId: GrowthId;
  recencyDays: number;
  frequency: number;
  monetaryValue: number;
  lastPurchaseAt?: ISODateTime;
}

export function calculateRfm(
  customerId: GrowthId,
  events: readonly CustomerBehaviorEvent[],
  now: Date = new Date(),
): RfmSnapshot {
  const purchases = events
    .filter((event) => event.customerId === customerId && event.type === 'purchase')
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const monetaryValue = purchases.reduce((sum, event) => sum + Math.max(0, event.value ?? 0), 0);
  const lastPurchaseAt = purchases.at(-1)?.occurredAt;
  const recencyDays = lastPurchaseAt
    ? Math.max(0, (now.getTime() - new Date(lastPurchaseAt).getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;

  return {
    customerId,
    recencyDays,
    frequency: purchases.length,
    monetaryValue,
    lastPurchaseAt,
  };
}

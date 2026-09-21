import type { GrowthId, ISODateTime } from '../domain/types.js';

export const PAID_AD_CAPABILITY = 'paid-ad.publish' as const;

export type PaidMediaChannel =
  | 'meta'
  | 'google'
  | 'tiktok'
  | 'linkedin'
  | 'reddit'
  | 'microsoft'
  | 'pinterest'
  | 'snapchat'
  | 'amazon'
  | 'dv360';

export interface PaidCampaignPlan {
  id: GrowthId;
  brandId: GrowthId;
  name: string;
  objective: string;
  channel: PaidMediaChannel;
  audienceIds: readonly GrowthId[];
  creativeIds: readonly GrowthId[];
  landingPageId?: GrowthId;
  currency: string;
  dailyBudgetMinor: number;
  lifetimeBudgetMinor?: number;
  startsAt?: ISODateTime;
  endsAt?: ISODateTime;
  providerAccountId: string;
}

export interface ConsumedPaidAdApproval {
  capability: typeof PAID_AD_CAPABILITY;
  status: 'consumed';
  fingerprint: string;
  receiptId: GrowthId;
}

export interface PaidCampaignOutboxJob {
  idempotencyKey: string;
  campaignId: GrowthId;
  channel: PaidMediaChannel;
  providerAccountId: string;
  approvalReceiptId: GrowthId;
  requestFingerprint: string;
}

function canonicalValues(values: readonly string[]): string {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort().join(',');
}

export function assertPaidCampaignPlan(plan: PaidCampaignPlan): void {
  if (!plan.id.trim() || !plan.brandId.trim() || !plan.name.trim()) throw new Error('GROWTH_PAID_CAMPAIGN_IDENTITY_REQUIRED');
  if (!plan.providerAccountId.trim()) throw new Error('GROWTH_PAID_PROVIDER_ACCOUNT_REQUIRED');
  if (!Number.isInteger(plan.dailyBudgetMinor) || plan.dailyBudgetMinor <= 0) throw new Error('GROWTH_PAID_DAILY_BUDGET_INVALID');
  if (plan.lifetimeBudgetMinor !== undefined && (!Number.isInteger(plan.lifetimeBudgetMinor) || plan.lifetimeBudgetMinor < plan.dailyBudgetMinor)) {
    throw new Error('GROWTH_PAID_LIFETIME_BUDGET_INVALID');
  }
  if (!/^[A-Z]{3}$/.test(plan.currency)) throw new Error('GROWTH_PAID_CURRENCY_INVALID');
  if (plan.audienceIds.length === 0) throw new Error('GROWTH_PAID_AUDIENCE_REQUIRED');
  if (plan.creativeIds.length === 0) throw new Error('GROWTH_PAID_CREATIVE_REQUIRED');
}

export function fingerprintPaidCampaign(plan: PaidCampaignPlan): string {
  assertPaidCampaignPlan(plan);
  return [
    'growth-paid-campaign:v1',
    plan.id,
    plan.brandId,
    plan.channel,
    plan.providerAccountId,
    plan.objective.trim(),
    plan.currency,
    String(plan.dailyBudgetMinor),
    String(plan.lifetimeBudgetMinor ?? ''),
    canonicalValues(plan.audienceIds),
    canonicalValues(plan.creativeIds),
    plan.landingPageId ?? '',
    plan.startsAt ?? '',
    plan.endsAt ?? '',
  ].join(':');
}

export function buildPaidCampaignOutbox(
  plan: PaidCampaignPlan,
  approval: ConsumedPaidAdApproval,
): PaidCampaignOutboxJob {
  const fingerprint = fingerprintPaidCampaign(plan);
  if (approval.capability !== PAID_AD_CAPABILITY || approval.status !== 'consumed') {
    throw new Error('GROWTH_PAID_APPROVAL_REQUIRED');
  }
  if (approval.fingerprint !== fingerprint) throw new Error('GROWTH_PAID_APPROVAL_FINGERPRINT_MISMATCH');
  return {
    idempotencyKey: `${plan.id}:${plan.channel}:${plan.providerAccountId}`,
    campaignId: plan.id,
    channel: plan.channel,
    providerAccountId: plan.providerAccountId,
    approvalReceiptId: approval.receiptId,
    requestFingerprint: fingerprint,
  };
}

export interface PaidAdPublishAction {
  campaignId: GrowthId;
  requestFingerprint: string;
}

export function fingerprintPaidAdPublishAction(action: PaidAdPublishAction): string {
  return `growth-paid-publish:v1:${action.campaignId}:${action.requestFingerprint}`;
}

import {
  fingerprintPaidCampaign,
  type PaidCampaignPlan,
} from "@jhadina/growth-core";
import type { WeeklyPaidCampaignAction } from "@jhadina/social-core";
import type { GrowthPaidCampaignRow } from "./production-repository";

export function paidCampaignPlanFromWeeklyAction(
  action: WeeklyPaidCampaignAction,
): PaidCampaignPlan {
  return Object.freeze({
    id: action.idempotencyKey,
    brandId: action.growthBrandId,
    name: action.campaignName,
    objective: action.objective,
    channel: action.channel,
    audienceIds: Object.freeze([...action.audienceIds]),
    creativeIds: Object.freeze([...action.creativeIds]),
    landingPageId: action.landingPageRef,
    currency: action.currency,
    dailyBudgetMinor: action.dailyBudgetMinor,
    lifetimeBudgetMinor: action.lifetimeBudgetMinor,
    startsAt: action.startsAt,
    endsAt: action.endsAt,
    providerAccountId: action.providerAccountId,
  });
}

export function expectedPaidCampaignFingerprintFromWeeklyAction(
  action: WeeklyPaidCampaignAction,
): string {
  return fingerprintPaidCampaign(paidCampaignPlanFromWeeklyAction(action));
}

export function assertWeeklyPaidCampaignRowBinding(input: {
  action: WeeklyPaidCampaignAction;
  campaign: GrowthPaidCampaignRow;
  ownerUserId: string;
}): void {
  const expected = expectedPaidCampaignFingerprintFromWeeklyAction(input.action);

  if (input.campaign.user_id !== input.ownerUserId) {
    throw new Error("GROWTH_WEEKLY_PAID_OWNER_MISMATCH");
  }
  if (input.campaign.request_fingerprint !== expected) {
    throw new Error("GROWTH_WEEKLY_PAID_FINGERPRINT_MISMATCH");
  }
  if (
    input.campaign.brand_id !== input.action.growthBrandId
    || input.campaign.name !== input.action.campaignName
    || input.campaign.objective !== input.action.objective
    || input.campaign.channel !== input.action.channel
    || input.campaign.provider_account_id !== input.action.providerAccountId
    || input.campaign.currency !== input.action.currency
    || input.campaign.daily_budget_minor !== input.action.dailyBudgetMinor
    || (input.campaign.lifetime_budget_minor ?? undefined)
      !== input.action.lifetimeBudgetMinor
    || (input.campaign.landing_page_id ?? undefined)
      !== input.action.landingPageRef
    || (input.campaign.starts_at ?? undefined) !== input.action.startsAt
    || (input.campaign.ends_at ?? undefined) !== input.action.endsAt
    || input.campaign.idempotency_key !== input.action.idempotencyKey
  ) {
    throw new Error("GROWTH_WEEKLY_PAID_CAMPAIGN_MUTATED");
  }

  if (!sameSet(input.campaign.audience_ids, input.action.audienceIds)) {
    throw new Error("GROWTH_WEEKLY_PAID_AUDIENCE_MUTATED");
  }
  if (!sameSet(input.campaign.creative_ids, input.action.creativeIds)) {
    throw new Error("GROWTH_WEEKLY_PAID_CREATIVE_MUTATED");
  }
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

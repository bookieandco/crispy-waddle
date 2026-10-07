import { describe, expect, it } from "vitest";
import type { WeeklyPaidCampaignAction } from "@jhadina/social-core";
import {
  assertWeeklyPaidCampaignRowBinding,
  expectedPaidCampaignFingerprintFromWeeklyAction,
  paidCampaignPlanFromWeeklyAction,
} from "./weekly-paid-campaign-binding";
import type { GrowthPaidCampaignRow } from "./production-repository";

const action: WeeklyPaidCampaignAction = {
  id: "action:paid:1",
  campaignId: "campaign:pupson:week",
  brand: "pupsonstuff",
  kind: "paid_campaign",
  profile: {
    characterProfileRef: "character:pupsonstuff",
    voiceProfileRef: "brand-voice:pupsonstuff",
    evidenceRefs: ["profile:pupsonstuff"],
  },
  growthBrandId: "brand:pupsonstuff",
  campaignName: "PupsonStuff Meta creative test",
  idempotencyKey: "weekly:pupson:meta:creative:1",
  scheduledAt: "2026-10-16T16:00:00.000Z",
  channel: "meta",
  providerAccountId: "meta-account:pupson",
  objective: "sales",
  audienceIds: ["audience:pupson:ready", "audience:pupson:lookalike"],
  creativeIds: ["creative:pupson:control", "creative:pupson:treatment"],
  landingPageRef: "storefront:pupsonstuff",
  currency: "USD",
  dailyBudgetMinor: 2500,
  lifetimeBudgetMinor: 10000,
  startsAt: "2026-10-16T16:00:00.000Z",
  endsAt: "2026-10-18T23:00:00.000Z",
  experimentRef: "experiment:pupson:meta:1",
  paidAccelerationStatus: "BOUNDED_PAID_TEST_READY",
  paidAccelerationEvidenceRefs: ["paid-readiness:pupson:meta:1"],
  evidenceRefs: ["experiment:pupson"],
};

function row(
  overrides: Partial<GrowthPaidCampaignRow> = {},
): GrowthPaidCampaignRow {
  return {
    id: "growth-campaign:1",
    user_id: "user:owner",
    action_id: "growth-paid-publish:1",
    brand_id: action.growthBrandId,
    name: action.campaignName,
    objective: action.objective,
    channel: action.channel,
    provider: "markifact",
    provider_account_id: action.providerAccountId,
    audience_ids: [...action.audienceIds],
    creative_ids: [...action.creativeIds],
    landing_page_id: action.landingPageRef ?? null,
    currency: action.currency,
    daily_budget_minor: action.dailyBudgetMinor,
    lifetime_budget_minor: action.lifetimeBudgetMinor ?? null,
    starts_at: action.startsAt ?? null,
    ends_at: action.endsAt ?? null,
    request_fingerprint:
      expectedPaidCampaignFingerprintFromWeeklyAction(action),
    idempotency_key: action.idempotencyKey,
    approval_receipt_id: "approval:child:1",
    status: "pending_approval",
    provider_campaign_id: null,
    last_error: null,
    created_at: "2026-10-11T20:00:00.000Z",
    updated_at: "2026-10-11T20:00:00.000Z",
    ...overrides,
  };
}

describe("weekly paid campaign binding", () => {
  it("reconstructs Growth's canonical paid plan and fingerprint", () => {
    const plan = paidCampaignPlanFromWeeklyAction(action);
    expect(plan.id).toBe(action.idempotencyKey);
    expect(plan.brandId).toBe(action.growthBrandId);
    expect(plan.audienceIds).toEqual(action.audienceIds);
    expect(
      expectedPaidCampaignFingerprintFromWeeklyAction(action),
    ).toContain("growth-paid-campaign:v1");
  });

  it("accepts only the exact persisted Growth campaign", () => {
    expect(() => assertWeeklyPaidCampaignRowBinding({
      action,
      campaign: row(),
      ownerUserId: "user:owner",
    })).not.toThrow();
  });

  it("rejects budget drift", () => {
    expect(() => assertWeeklyPaidCampaignRowBinding({
      action,
      campaign: row({
        daily_budget_minor: action.dailyBudgetMinor + 500,
      }),
      ownerUserId: "user:owner",
    })).toThrow(/CAMPAIGN_MUTATED|FINGERPRINT_MISMATCH/);
  });

  it("rejects audience or creative drift", () => {
    expect(() => assertWeeklyPaidCampaignRowBinding({
      action,
      campaign: row({
        audience_ids: ["audience:other"],
      }),
      ownerUserId: "user:owner",
    })).toThrow(/AUDIENCE_MUTATED|FINGERPRINT_MISMATCH/);

    expect(() => assertWeeklyPaidCampaignRowBinding({
      action,
      campaign: row({
        creative_ids: ["creative:other"],
      }),
      ownerUserId: "user:owner",
    })).toThrow(/CREATIVE_MUTATED|FINGERPRINT_MISMATCH/);
  });

  it("rejects a campaign owned by a different user", () => {
    expect(() => assertWeeklyPaidCampaignRowBinding({
      action,
      campaign: row({ user_id: "user:other" }),
      ownerUserId: "user:owner",
    })).toThrow(/OWNER_MISMATCH/);
  });
});

import { describe, expect, it } from "vitest";
import {
  PAID_AD_CAPABILITY,
} from "@jhadina/growth-core";
import {
  PUBLIC_PUBLISH_CAPABILITY,
  bindApprovedWeeklySocialCampaignPacket,
  compileWeeklyDelegationManifest,
  compileWeeklySocialCampaignPacket,
  type WeeklyDelegationConsumptionStore,
  type WeeklyOrganicPublicationAction,
  type WeeklyPaidCampaignAction,
  type WeeklySocialCampaign,
} from "@jhadina/social-core";
import {
  createWeeklyPaidCampaignApprovalVerifier,
  createWeeklySocialPublicationApprovalVerifier,
} from "./weekly-action-verifier";
import {
  materializeWeeklyOrganicPublication,
} from "./weekly-publication-materialization";
import {
  expectedPaidCampaignFingerprintFromWeeklyAction,
} from "../growth/weekly-paid-campaign-binding";
import type { GrowthPaidCampaignRow } from "../growth/production-repository";

class OnceStore implements WeeklyDelegationConsumptionStore {
  private readonly used = new Set<string>();
  async consume(input: { permitId: string }): Promise<boolean> {
    if (this.used.has(input.permitId)) return false;
    this.used.add(input.permitId);
    return true;
  }
}

const profile = {
  characterProfileRef: "character:pupsonstuff",
  voiceProfileRef: "brand-voice:pupsonstuff",
  evidenceRefs: ["profile:pupsonstuff"],
};

const organic: WeeklyOrganicPublicationAction = {
  id: "action:organic:weekly",
  campaignId: "campaign:pupson:weekly",
  brand: "pupsonstuff",
  kind: "organic_publication",
  profile,
  scheduledAt: "2026-10-14T17:00:00.000Z",
  target: {
    accountId: "account:pupson:instagram",
    brand: "pupsonstuff",
    provider: "hootsuite",
    providerProfileId: "profile:pupson:instagram",
    platform: "instagram",
  },
  contentProjectRef: "project:pupson",
  contentAssetRef: "asset:pupson",
  text: "Synthetic approved post.",
  mediaRefs: ["https://media.example/static.png"],
  destinationRef: "storefront:pupsonstuff",
  evidenceRefs: ["creative:pupson"],
};

const paid: WeeklyPaidCampaignAction = {
  id: "action:paid:weekly",
  campaignId: "campaign:pupson:weekly",
  brand: "pupsonstuff",
  kind: "paid_campaign",
  profile,
  scheduledAt: "2026-10-15T16:00:00.000Z",
  growthBrandId: "brand:pupsonstuff",
  campaignName: "PupsonStuff Meta weekly test",
  idempotencyKey: "weekly:pupson:meta:1",
  channel: "meta",
  providerAccountId: "meta-account:pupson",
  objective: "sales",
  audienceIds: ["audience:pupson:ready"],
  creativeIds: ["creative:pupson:control", "creative:pupson:treatment"],
  landingPageRef: "storefront:pupsonstuff",
  currency: "USD",
  dailyBudgetMinor: 2500,
  lifetimeBudgetMinor: 10000,
  startsAt: "2026-10-15T16:00:00.000Z",
  endsAt: "2026-10-18T22:00:00.000Z",
  experimentRef: "experiment:pupson:meta:weekly",
  paidAccelerationStatus: "BOUNDED_PAID_TEST_READY",
  paidAccelerationEvidenceRefs: ["paid-readiness:pupson:meta:weekly"],
  evidenceRefs: ["experiment:pupson"],
};

const campaign: WeeklySocialCampaign = {
  id: "campaign:pupson:weekly",
  brand: "pupsonstuff",
  name: "PupsonStuff weekly",
  profile,
  objective: "Qualified sales",
  hypothesis: "Approved organic and paid tests improve qualified sales.",
  ownerIdeaRefs: ["owner-idea:pupson"],
  actionIds: [organic.id, paid.id],
  evidenceRefs: ["campaign:pupson"],
};

function approvedPacket() {
  const packet = compileWeeklySocialCampaignPacket({
    id: "weekly:2026-10-12",
    ownerUserId: "user:owner",
    weekStartsAt: "2026-10-12T00:00:00.000Z",
    weekEndsAt: "2026-10-19T00:00:00.000Z",
    createdAt: "2026-10-11T18:00:00.000Z",
    campaigns: [campaign],
    actions: [organic, paid],
    evidenceRefs: ["weekly:evidence"],
  });
  return bindApprovedWeeklySocialCampaignPacket({
    packet,
    approvalReceiptId: "approval:weekly:1",
    approvedFingerprint: packet.fingerprint,
    approvedByUserId: "user:owner",
    approvedAt: "2026-10-11T19:00:00.000Z",
  });
}

function paidRow(): GrowthPaidCampaignRow {
  return {
    id: "growth-campaign:1",
    user_id: "user:owner",
    action_id: "growth-paid-publish:1",
    brand_id: paid.growthBrandId,
    name: paid.campaignName,
    objective: paid.objective,
    channel: paid.channel,
    provider: "markifact",
    provider_account_id: paid.providerAccountId,
    audience_ids: [...paid.audienceIds],
    creative_ids: [...paid.creativeIds],
    landing_page_id: paid.landingPageRef ?? null,
    currency: paid.currency,
    daily_budget_minor: paid.dailyBudgetMinor,
    lifetime_budget_minor: paid.lifetimeBudgetMinor ?? null,
    starts_at: paid.startsAt ?? null,
    ends_at: paid.endsAt ?? null,
    request_fingerprint:
      expectedPaidCampaignFingerprintFromWeeklyAction(paid),
    idempotency_key: paid.idempotencyKey,
    approval_receipt_id: "approval:child:unused",
    status: "pending_approval",
    provider_campaign_id: null,
    last_error: null,
    created_at: "2026-10-11T20:00:00.000Z",
    updated_at: "2026-10-11T20:00:00.000Z",
  };
}

describe("weekly Action Core approval verifiers", () => {
  it("consumes the exact weekly organic permit as public.publish approval", async () => {
    const packet = approvedPacket();
    const manifest = compileWeeklyDelegationManifest(packet);
    const permit = manifest.permits.find(
      (candidate) => candidate.actionId === organic.id,
    )!;
    const materialized = materializeWeeklyOrganicPublication({
      packet,
      action: organic,
    });
    const verifier = createWeeklySocialPublicationApprovalVerifier({
      packet,
      permit,
      action: organic,
      materialized,
      store: new OnceStore(),
      consumedAt: "2026-10-13T18:00:00.000Z",
    });

    await expect(verifier.verifyAndConsume(permit.id, {
      id: "social-public-publish:1",
      userId: "user:owner",
      type: PUBLIC_PUBLISH_CAPABILITY,
      action: {
        proposalId: "proposal:1",
        requestFingerprint: materialized.requestFingerprint,
      },
      requestedAt: "2026-10-13T17:59:00.000Z",
    })).resolves.toBe(true);
  });

  it("rejects a Social publication fingerprint that differs from the approved week", async () => {
    const packet = approvedPacket();
    const permit = compileWeeklyDelegationManifest(packet).permits.find(
      (candidate) => candidate.actionId === organic.id,
    )!;
    const materialized = materializeWeeklyOrganicPublication({
      packet,
      action: organic,
    });
    const verifier = createWeeklySocialPublicationApprovalVerifier({
      packet,
      permit,
      action: organic,
      materialized,
      store: new OnceStore(),
      consumedAt: "2026-10-13T18:00:00.000Z",
    });

    await expect(verifier.verifyAndConsume(permit.id, {
      id: "social-public-publish:1",
      userId: "user:owner",
      type: PUBLIC_PUBLISH_CAPABILITY,
      action: {
        proposalId: "proposal:1",
        requestFingerprint: materialized.requestFingerprint + ":changed",
      },
      requestedAt: "2026-10-13T17:59:00.000Z",
    })).resolves.toBe(false);
  });

  it("consumes the exact weekly paid permit as paid-ad approval", async () => {
    const packet = approvedPacket();
    const permit = compileWeeklyDelegationManifest(packet).permits.find(
      (candidate) => candidate.actionId === paid.id,
    )!;
    const campaignRow = paidRow();
    const verifier = createWeeklyPaidCampaignApprovalVerifier({
      packet,
      permit,
      action: paid,
      campaign: campaignRow,
      store: new OnceStore(),
      consumedAt: "2026-10-14T18:00:00.000Z",
    });

    await expect(verifier.verifyAndConsume(permit.id, {
      id: campaignRow.action_id,
      userId: "user:owner",
      type: PAID_AD_CAPABILITY,
      action: {
        campaignId: campaignRow.id,
        requestFingerprint: campaignRow.request_fingerprint,
      },
      requestedAt: campaignRow.created_at,
    })).resolves.toBe(true);
  });

  it("keeps weekly permits single-use", async () => {
    const packet = approvedPacket();
    const permit = compileWeeklyDelegationManifest(packet).permits.find(
      (candidate) => candidate.actionId === paid.id,
    )!;
    const campaignRow = paidRow();
    const store = new OnceStore();
    const verifier = createWeeklyPaidCampaignApprovalVerifier({
      packet,
      permit,
      action: paid,
      campaign: campaignRow,
      store,
      consumedAt: "2026-10-14T18:00:00.000Z",
    });
    const request = {
      id: campaignRow.action_id,
      userId: "user:owner",
      type: PAID_AD_CAPABILITY,
      action: {
        campaignId: campaignRow.id,
        requestFingerprint: campaignRow.request_fingerprint,
      },
      requestedAt: campaignRow.created_at,
    };

    await expect(verifier.verifyAndConsume(permit.id, request))
      .resolves.toBe(true);
    await expect(verifier.verifyAndConsume(permit.id, request))
      .resolves.toBe(false);
  });
});

import assert from "node:assert/strict";
import type { Opportunity } from "./opportunity.js";
import { buildSideHustleProfile } from "./side-hustles.js";
import {
  recordTikTokAffiliateConversion,
  recordTikTokAffiliatePaidPayout,
} from "./tiktok-affiliate-finance.js";

const opportunity = {
  id: "opportunity:tiktok-affiliate:1",
  title: "TikTok affiliate",
  family: "business",
  type: "commercial",
  sourceName: "Venture Factory",
  sourceUrl: "https://example.test/tiktok",
  claims: [],
  evidence: [],
  verificationStatus: "unverified",
  sourceConfidence: 0.9,
  riskFlags: [],
  metadata: {
    sideHustleProfile: buildSideHustleProfile({ family: "commerce_affiliate" }),
  },
  status: "ready",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
} as Opportunity;

const conversion = recordTikTokAffiliateConversion({
  opportunity,
  observation: {
    id: "event:conversion:1",
    opportunityId: opportunity.id,
    programRef: "tiktok:collaboration:1",
    affiliateOrderId: "order-1",
    productRef: "product-1",
    creatorAccountRef: "creator-1",
    providerStatus: "settled",
    economicState: "approved",
    commissionAmount: 8,
    currency: "USD",
    attributedAt: "2026-10-02T12:00:00Z",
    sourceRef: "tiktok:affiliate-order:order-1",
    evidenceRefs: ["evidence:affiliate-order"],
  },
});
assert.equal(conversion.externalEventRef, "tiktok:affiliate-order:order-1");
assert.equal(conversion.economicState, "approved");

const payout = recordTikTokAffiliatePaidPayout({
  opportunity,
  observation: {
    id: "event:payout:1",
    opportunityId: opportunity.id,
    programRef: "tiktok:collaboration:1",
    payoutId: "payout-1",
    affiliateOrderId: "order-1",
    conversionExternalRef: conversion.externalEventRef,
    conversionAt: "2026-10-02T12:00:00Z",
    creatorAccountRef: "creator-1",
    providerStatus: "paid",
    amount: 8,
    currency: "USD",
    paidAt: "2026-10-04T12:00:00Z",
    sourceRef: "tiktok:affiliate-settlement:payout-1",
    evidenceRefs: ["evidence:payout"],
    sourceKind: "affiliate_settlement_report",
  },
});
assert.equal(payout.kind, "payout");
assert.equal(payout.economicState, "paid");
assert.equal(payout.metadata?.conversion_external_ref, conversion.externalEventRef);
assert.equal(payout.moneyMovementAuthorized, false);

assert.throws(() => recordTikTokAffiliatePaidPayout({
  opportunity,
  observation: {
    id: "event:payout:bad",
    opportunityId: opportunity.id,
    programRef: "tiktok:collaboration:1",
    payoutId: "payout-bad",
    affiliateOrderId: "order-1",
    conversionExternalRef: conversion.externalEventRef,
    conversionAt: "2026-10-02T12:00:00Z",
    creatorAccountRef: "creator-1",
    providerStatus: "pending",
    amount: 8,
    currency: "USD",
    paidAt: "2026-10-04T12:00:00Z",
    sourceRef: "tiktok:affiliate-settlement:payout-bad",
    evidenceRefs: ["evidence:payout"],
    sourceKind: "affiliate_settlement_report",
  },
}), /REQUIRES_PAID_PROVIDER_STATE/);

console.log("TikTok affiliate finance tests passed");

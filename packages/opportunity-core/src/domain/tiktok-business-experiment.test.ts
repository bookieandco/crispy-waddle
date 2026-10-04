import assert from "node:assert/strict";
import type { Opportunity } from "./opportunity.js";
import { buildSideHustleProfile } from "./side-hustles.js";
import {
  materializeTikTokBoundedExperimentPlan,
  proposeTikTokBoundedExperiment,
} from "./tiktok-business-experiment.js";

function opportunity(family: "commerce_affiliate" | "pod_personalized_commerce"): Opportunity {
  return {
    id: `opportunity:${family}`,
    title: "TikTok experiment",
    family: "business",
    type: "commercial",
    sourceName: "Venture Factory",
    sourceUrl: "https://example.test",
    claims: [],
    evidence: [],
    verificationStatus: "unverified",
    sourceConfidence: 0.9,
    riskFlags: [],
    metadata: { sideHustleProfile: buildSideHustleProfile({ family }) },
    status: "ready",
    createdAt: "2026-10-04T10:00:00Z",
    updatedAt: "2026-10-04T10:00:00Z",
  };
}

const affiliate = opportunity("commerce_affiliate");
const affiliateProposal = proposeTikTokBoundedExperiment({
  opportunity: affiliate,
  lane: "affiliate",
  evidenceRefs: ["evidence:tiktok-product"],
  generatedAt: "2026-10-04T10:01:00Z",
});
assert.equal(affiliateProposal.maxSpend, 50);
assert.equal(affiliateProposal.maxDurationDays, 14);
assert.equal(affiliateProposal.finalRevenueProof, "PAID_AFFILIATE_PAYOUT_REQUIRED");
assert.ok(affiliateProposal.successCriteria.some((criterion) => criterion.metric === "attributed_conversions"));
assert.equal(affiliateProposal.externalActionAuthorized, false);

const affiliatePlan = materializeTikTokBoundedExperimentPlan({
  opportunity: affiliate,
  proposal: affiliateProposal,
  reviewEvidenceRef: "review:approved-plan",
  createdAt: "2026-10-04T10:02:00Z",
});
assert.equal(affiliatePlan.status, "planned");
assert.equal(affiliatePlan.requiresApproval, true);

const pod = opportunity("pod_personalized_commerce");
const podProposal = proposeTikTokBoundedExperiment({
  opportunity: pod,
  lane: "pod_seller",
  evidenceRefs: ["evidence:pod-readiness"],
  generatedAt: "2026-10-04T10:01:00Z",
});
assert.equal(podProposal.maxSpend, 100);
assert.equal(podProposal.finalRevenueProof, "SELLER_SETTLEMENT_REQUIRED");
assert.ok(podProposal.killCriteria.some((criterion) => criterion.metric === "fulfillment_breaches"));

assert.throws(() => proposeTikTokBoundedExperiment({
  opportunity: affiliate,
  lane: "pod_seller",
  evidenceRefs: ["evidence"],
  generatedAt: "2026-10-04T10:01:00Z",
}), /LANE_FAMILY_MISMATCH/);

console.log("TikTok bounded experiment tests passed");

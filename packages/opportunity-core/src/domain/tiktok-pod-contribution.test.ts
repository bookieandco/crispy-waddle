import assert from "node:assert/strict";
import type { Opportunity } from "./opportunity.js";
import type {
  SideHustleExperiment,
  SideHustleExperimentEvaluation,
} from "./side-hustle-experiment.js";
import { buildSideHustleProfile } from "./side-hustles.js";
import { buildTikTokPodContributionProof } from "./tiktok-pod-contribution.js";

const startedAt = "2026-10-01T00:00:00.000Z";
const completedAt = "2026-10-03T00:00:00.000Z";
const evaluatedAt = "2026-10-04T00:00:00.000Z";

const opportunity = {
  id: "opportunity:tiktok-pod:1",
  title: "TikTok POD test",
  family: "business",
  type: "commercial",
  sourceName: "Venture Factory",
  sourceUrl: "https://example.test/tiktok-pod",
  claims: [],
  evidence: [],
  verificationStatus: "unverified",
  sourceConfidence: 0.9,
  riskFlags: [],
  metadata: {
    sideHustleProfile: buildSideHustleProfile({
      family: "pod_personalized_commerce",
    }),
  },
  status: "ready",
  createdAt: startedAt,
  updatedAt: completedAt,
} as Opportunity;

const experiment = {
  id: "experiment:tiktok-pod:1",
  opportunityId: opportunity.id,
  profile: buildSideHustleProfile({ family: "pod_personalized_commerce" }),
  currency: "USD",
  status: "completed",
  startedAt,
  completedAt,
  createdAt: startedAt,
  evidenceRefs: ["evidence:experiment"],
} as SideHustleExperiment;

const evaluation = {
  experimentId: experiment.id,
  opportunityId: opportunity.id,
  decision: "promote",
  observationCount: 20,
  totalSpend: 10,
  totalHours: 2,
  evidenceRefs: ["evidence:evaluation"],
  evaluatedAt: completedAt,
} as SideHustleExperimentEvaluation;

const proof = buildTikTokPodContributionProof({
  opportunity,
  experiment,
  evaluation,
  currency: "USD",
  evaluatedAt,
  settlements: [
    {
      id: "settlement:sale:1",
      opportunityId: opportunity.id,
      externalTransactionRef: "tiktok:settlement:order-1",
      orderRef: "order-1",
      kind: "sale_settlement",
      amount: 60,
      currency: "USD",
      sourceRef: "tiktok:settlement-report",
      evidenceRefs: ["evidence:sale"],
      occurredAt: completedAt,
    },
    {
      id: "settlement:pod-cost:1",
      opportunityId: opportunity.id,
      externalTransactionRef: "printify:order-1",
      orderRef: "order-1",
      kind: "fulfillment_cost",
      amount: 18,
      currency: "USD",
      sourceRef: "printify:order",
      evidenceRefs: ["evidence:pod-cost"],
      occurredAt: completedAt,
    },
    {
      id: "settlement:shipping:1",
      opportunityId: opportunity.id,
      externalTransactionRef: "printify:shipping:order-1",
      orderRef: "order-1",
      kind: "shipping_cost",
      amount: 7,
      currency: "USD",
      sourceRef: "printify:order",
      evidenceRefs: ["evidence:shipping"],
      occurredAt: completedAt,
    },
    {
      id: "settlement:fees:1",
      opportunityId: opportunity.id,
      externalTransactionRef: "tiktok:fees:order-1",
      orderRef: "order-1",
      kind: "platform_fee",
      amount: 4,
      currency: "USD",
      sourceRef: "tiktok:settlement-report",
      evidenceRefs: ["evidence:fee"],
      occurredAt: completedAt,
    },
  ],
});

assert.equal(proof.status, "passed");
assert.equal(proof.calculation.grossRevenue, 60);
assert.equal(proof.calculation.directCosts, 35);
assert.equal(proof.calculation.fees, 4);
assert.equal(proof.calculation.profit, 21);
assert.equal(proof.calculation.sourceOwner, "commerce");
assert.equal(proof.canonicalOutcomePersisted, false);
assert.equal(proof.moneyMovementAuthorized, false);

const blocked = buildTikTokPodContributionProof({
  opportunity,
  experiment,
  evaluation,
  currency: "USD",
  evaluatedAt,
  settlements: [],
});
assert.equal(blocked.status, "blocked");
assert.match(blocked.blockers.join(" "), /no settled seller revenue/);

console.log("TikTok POD contribution tests passed");

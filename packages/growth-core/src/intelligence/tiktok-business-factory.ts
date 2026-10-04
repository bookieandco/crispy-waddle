import {
  synthesizeVentureDiscoveryCandidate,
  type TikTokPodContributionEstimate,
  type TikTokPodFulfillmentObservation,
  type VentureCandidateProfile,
  type VentureDiscoveryCandidate,
  type VentureMarketSignal,
  type VentureOpportunity,
  type VentureWorkItem,
} from "@jhadina/opportunity-core";
import type {
  TikTokCreativeCommerceObservation,
  TikTokShopProductObservation,
  TikTokShopSearchOpportunityObservation,
} from "./tiktok-shop-intelligence.js";
import type {
  TikTokGmvMaxEvidenceObservation,
  TikTokLiveCommerceObservation,
} from "./tiktok-shop-operations.js";
import type {
  TikTokNewReleaseDecision,
  TikTokNewReleaseObservation,
  TikTokOfferObservation,
} from "./tiktok-shop-offer-governance.js";

export type TikTokBusinessFactoryLane = "affiliate" | "pod_seller";

export const TIKTOK_BUSINESS_FACTORY_PROFILES: Readonly<Record<
  TikTokBusinessFactoryLane,
  VentureCandidateProfile
>> = Object.freeze({
  affiliate: Object.freeze({
    seedId: "tiktok-affiliate-commerce-market",
    family: "commerce_affiliate",
    title: "TikTok Shop affiliate commerce opportunity",
    buyer: "TikTok Shop shoppers with demonstrated product-category intent",
    jobToBeDone:
      "Discover and confidently buy useful products from concise, trustworthy shoppable content",
    paidProblem:
      "Shoppers face noisy product discovery while affiliates need evidence-backed products that can convert without owning inventory",
    marketMechanic:
      "Match current product demand and commission economics with low-friction, truthful shoppable creative and attributable conversion",
    unmetAngles: [
      "New releases with demand but lower creator saturation",
      "Evidence-backed product demonstrations instead of generic hype",
      "Creative formats optimized on paid-out contribution rather than raw views",
    ],
  }),
  pod_seller: Object.freeze({
    seedId: "tiktok-pod-commerce-market",
    family: "pod_personalized_commerce",
    title: "TikTok Shop print-on-demand commerce opportunity",
    buyer: "TikTok Shop shoppers looking for identity, occasion, gift, or trend-relevant products",
    jobToBeDone:
      "Find a distinctive product that feels personally relevant and can be fulfilled reliably after purchase",
    paidProblem:
      "Generic marketplace products compete heavily while personalized or original POD products can fail if fulfillment and margin are not validated first",
    marketMechanic:
      "Combine TikTok demand signals with original POD design, fulfillment eligibility, contribution margin, and shoppable creative",
    unmetAngles: [
      "High-demand search terms with low competing-product supply",
      "Original personalized products adapted from proven demand mechanics",
      "POD products whose provider and handling SLA are already TikTok-compatible",
    ],
  }),
});

export interface TikTokBusinessFactoryEvidenceBundle {
  lane: TikTokBusinessFactoryLane;
  product: TikTokShopProductObservation;
  searchOpportunity?: TikTokShopSearchOpportunityObservation;
  newRelease?: {
    observation: TikTokNewReleaseObservation;
    decision: TikTokNewReleaseDecision;
  };
  gmvMax?: TikTokGmvMaxEvidenceObservation;
  offer?: TikTokOfferObservation;
  creativeOutcomes?: readonly TikTokCreativeCommerceObservation[];
  liveOutcomes?: readonly TikTokLiveCommerceObservation[];
  podFulfillment?: TikTokPodFulfillmentObservation;
  podContribution?: TikTokPodContributionEstimate;
  generatedAt: string;
}

export interface TikTokBusinessFactoryIntake {
  lane: TikTokBusinessFactoryLane;
  profile: VentureCandidateProfile;
  signals: VentureMarketSignal[];
  candidate: VentureDiscoveryCandidate;
  externalActionAuthorized: false;
  automaticExperimentAuthorized: false;
  publishingAuthorized: false;
  moneyMovementAuthorized: false;
}

export function buildTikTokBusinessFactoryIntake(
  input: TikTokBusinessFactoryEvidenceBundle,
): TikTokBusinessFactoryIntake {
  assertDate(input.generatedAt, "TIKTOK_FACTORY_GENERATED_AT_INVALID");
  if (input.lane === "pod_seller" && !input.podFulfillment) {
    throw new Error("TIKTOK_FACTORY_POD_FULFILLMENT_REQUIRED");
  }

  const profile = cloneProfile(TIKTOK_BUSINESS_FACTORY_PROFILES[input.lane]);
  const signals = buildTikTokBusinessFactorySignals(input);
  const candidate = synthesizeVentureDiscoveryCandidate({
    profile,
    signals,
    generatedAt: input.generatedAt,
  });

  return Object.freeze({
    lane: input.lane,
    profile,
    signals: Object.freeze(signals.map((signal) => Object.freeze({ ...signal }))),
    candidate,
    externalActionAuthorized: false as const,
    automaticExperimentAuthorized: false as const,
    publishingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
  });
}

export function buildTikTokBusinessFactorySignals(
  input: TikTokBusinessFactoryEvidenceBundle,
): VentureMarketSignal[] {
  const product = input.product;
  const signals: VentureMarketSignal[] = [];
  const seed = TIKTOK_BUSINESS_FACTORY_PROFILES[input.lane].seedId;

  if (product.gmv) {
    signals.push(signal({
      id: `${seed}:product-gmv:${product.productRef}`,
      kind: "sales",
      sourceRef: metricSource(product.gmv.sourceRef, product.provider, product.productRef),
      observedAt: product.observedAt,
      value: product.gmv.value,
      unit: product.gmv.currency,
      note: `Observed product GMV signal for ${product.productName}; provenance=${product.gmv.provenance}. This is market evidence, not realized venture revenue.`,
      confidence: provenanceConfidence(product.gmv.provenance),
    }));
  }

  if (product.weeklyGmvGrowthRate) {
    signals.push(signal({
      id: `${seed}:growth:${product.productRef}`,
      kind: "platform_velocity",
      sourceRef: metricSource(
        product.weeklyGmvGrowthRate.sourceRef,
        product.provider,
        product.productRef,
      ),
      observedAt: product.observedAt,
      value: product.weeklyGmvGrowthRate.value,
      unit: "weekly_gmv_growth_rate",
      note: `Recent GMV momentum for ${product.productName}; provenance=${product.weeklyGmvGrowthRate.provenance}.`,
      confidence: provenanceConfidence(product.weeklyGmvGrowthRate.provenance),
    }));
  }

  if (product.creatorCount || product.shoppableContentCount) {
    const creators = product.creatorCount?.value;
    const content = product.shoppableContentCount?.value;
    signals.push(signal({
      id: `${seed}:competition:${product.productRef}`,
      kind: "competition",
      sourceRef:
        product.creatorCount?.sourceRef ??
        product.shoppableContentCount?.sourceRef ??
        `${product.provider}:${product.productRef}:competition`,
      observedAt: product.observedAt,
      value: content ?? creators,
      unit: content !== undefined ? "shoppable_content_count" : "creator_count",
      note: [
        `Observed competition for ${product.productName}.`,
        creators !== undefined ? `creators=${creators}` : "",
        content !== undefined ? `shoppable_content=${content}` : "",
      ].filter(Boolean).join(" "),
      confidence: Math.max(
        product.creatorCount ? provenanceConfidence(product.creatorCount.provenance) : 0,
        product.shoppableContentCount
          ? provenanceConfidence(product.shoppableContentCount.provenance)
          : 0,
      ),
    }));
  }

  if (product.commissionRate || product.commissionValuePerOrder) {
    const metric = product.commissionValuePerOrder ?? product.commissionRate;
    signals.push(signal({
      id: `${seed}:economics:${product.productRef}`,
      kind: "pricing",
      sourceRef: metricSource(metric?.sourceRef, product.provider, product.productRef),
      observedAt: product.observedAt,
      value: metric?.value,
      unit: product.commissionValuePerOrder
        ? `commission_per_order_${product.commissionValuePerOrder.currency}`
        : "commission_rate",
      note: `Observed affiliate economics for ${product.productName}; this is a prospective economics signal, not payout evidence.`,
      confidence: metric ? provenanceConfidence(metric.provenance) : 0.5,
    }));
  }

  if (input.searchOpportunity) {
    const search = input.searchOpportunity;
    signals.push(signal({
      id: `${seed}:search:${normalizeId(search.query)}:${search.region}`,
      kind: "search",
      sourceRef: search.sourceRef,
      observedAt: search.observedAt,
      value: search.searchDemand?.value,
      unit: search.searchDemand ? "search_demand" : undefined,
      note: [
        `TikTok Shop product-opportunity query: ${search.query}.`,
        search.searchDemand ? `demand=${search.searchDemand.value}` : "",
        search.competingProductCount
          ? `competing_products=${search.competingProductCount.value}`
          : "",
        search.label ? `label=${search.label}` : "",
      ].filter(Boolean).join(" "),
      confidence: 0.85,
    }));
  }

  if (input.newRelease) {
    const release = input.newRelease;
    signals.push(signal({
      id: `${seed}:new-release:${release.observation.productRef}`,
      kind: "platform_velocity",
      sourceRef:
        release.observation.sellerPaidSupport?.sourceRef ??
        `tiktok:new-release:${release.observation.productRef}`,
      observedAt: release.observation.observedAt,
      value: release.decision.qualifiesForTest ? 1 : 0,
      unit: "test_qualification",
      note: [
        `New-release test decision=${release.decision.qualifiesForTest ? "qualified" : "blocked"}.`,
        release.decision.ageDays !== undefined
          ? `age_days=${round(release.decision.ageDays)}`
          : "",
        release.decision.historicalPaidSupportShare !== undefined
          ? `historical_paid_support_share=${round(release.decision.historicalPaidSupportShare)}`
          : "",
        release.decision.reasons.length
          ? `reasons=${release.decision.reasons.join(",")}`
          : "",
        "Historical seller paid support is predictive evidence only, not guaranteed future spend.",
      ].filter(Boolean).join(" "),
      confidence: release.observation.sellerPaidSupport ? 0.75 : 0.55,
    }));
  }

  if (input.gmvMax) {
    signals.push(signal({
      id: `${seed}:gmv-max:${input.gmvMax.observationId}`,
      kind: "platform_velocity",
      sourceRef: input.gmvMax.sourceRef,
      observedAt: input.gmvMax.observedAt,
      value: input.gmvMax.observedInGmvMax ? 1 : 0,
      unit: "gmv_max_observed",
      note: [
        `affiliate_authorized=${String(input.gmvMax.affiliateCreativeAuthorized ?? "unknown")}`,
        `observed_shop_ads=${String(input.gmvMax.observedInShopAds ?? "unknown")}`,
        `observed_gmv_max=${String(input.gmvMax.observedInGmvMax ?? "unknown")}`,
        "Participation evidence does not reveal total seller ad budget or guarantee future allocation.",
      ].join(" "),
      confidence: 0.9,
    }));
  }

  if (input.offer) {
    signals.push(signal({
      id: `${seed}:offer:${input.offer.offerRef}`,
      kind: "pricing",
      sourceRef: input.offer.sourceRef,
      observedAt: input.offer.observedAt,
      value: input.offer.percentOff?.value ?? input.offer.salePrice?.value,
      unit: input.offer.percentOff
        ? "discount_rate"
        : input.offer.salePrice
          ? input.offer.salePrice.currency
          : input.offer.kind,
      note: `Current offer state=${input.offer.state}; kind=${input.offer.kind}; display=${input.offer.displayText}.`,
      confidence: input.offer.state === "unknown" ? 0.55 : 0.9,
    }));
  }

  for (const creative of input.creativeOutcomes ?? []) {
    signals.push(signal({
      id: `${seed}:creative-outcome:${creative.observationId}`,
      kind: "sales",
      sourceRef: creative.evidenceRefs[0] ?? `tiktok:creative:${creative.contentRef}`,
      observedAt: creative.observedAt,
      value: creative.orders,
      unit: "orders",
      note: `Observed creative commerce outcome for format=${creative.format}, views=${creative.views}, clicks=${creative.productClicks ?? "unknown"}, orders=${creative.orders ?? "unknown"}.`,
      confidence: creative.commissionEarned ? 0.9 : 0.75,
    }));
  }

  for (const live of input.liveOutcomes ?? []) {
    signals.push(signal({
      id: `${seed}:live-outcome:${live.observationId}`,
      kind: "sales",
      sourceRef: live.evidenceRefs[0] ?? `tiktok:live:${live.sessionRef}`,
      observedAt: live.observedAt,
      value: live.orders,
      unit: "orders",
      note: `Observed LIVE commerce outcome: viewers=${live.uniqueViewers ?? "unknown"}, basket_clicks=${live.basketClicks ?? "unknown"}, orders=${live.orders ?? "unknown"}.`,
      confidence: live.commissionEarned || live.attributedRevenue ? 0.9 : 0.75,
    }));
  }

  if (input.lane === "pod_seller" && input.podFulfillment) {
    const pod = input.podFulfillment;
    const ready =
      pod.salesChannelConnection === "connected" &&
      pod.channelEligibility === "eligible" &&
      pod.taxInfoState === "ready" &&
      pod.trackingCompatible === true &&
      pod.providerSupportsDestination === true &&
      pod.estimatedHandlingBusinessDays !== undefined &&
      pod.maxPermittedHandlingBusinessDays !== undefined &&
      pod.estimatedHandlingBusinessDays <= pod.maxPermittedHandlingBusinessDays;

    signals.push(signal({
      id: `${seed}:fulfillment:${pod.observationId}`,
      kind: "other",
      sourceRef: pod.sourceRef,
      observedAt: pod.observedAt,
      value: ready ? 1 : 0,
      unit: "fulfillment_admission",
      note: `POD fulfillment readiness=${ready ? "ready" : "blocked"}; provider=${pod.providerRef}; provider_region=${pod.providerRegion}; destination=${pod.destinationRegion}; made_to_order=${pod.madeToOrderState}.`,
      confidence: ready ? 0.95 : 0.8,
    }));
  }

  if (input.lane === "pod_seller" && input.podContribution) {
    const economics = input.podContribution;
    signals.push(signal({
      id: `${seed}:contribution:${product.productRef}`,
      kind: "pricing",
      sourceRef: `commerce:pod-contribution:${product.productRef}`,
      observedAt: input.generatedAt,
      value: economics.estimatedContributionMargin,
      unit: "estimated_contribution_margin",
      note: `Estimated POD contribution=${economics.estimatedContribution} ${economics.currency}; margin=${round(economics.estimatedContributionMargin)}. This is modeled economics, not realized outcome.`,
      confidence: 0.8,
    }));
  }

  return dedupeSignals(signals);
}

export interface TikTokBusinessFactoryWorkReadiness {
  productResearchReady: boolean;
  boundedExperimentApproved: boolean;
  productTruthLocked: boolean;
  accountCapabilityReady: boolean;
  offerEvidenceReady: boolean;
  creativeReady: boolean;
  publicationReceiptPresent: boolean;
  settlementEvidenceReady: boolean;
  evidenceRefs: readonly string[];
}

export function buildTikTokBusinessFactoryWorkItems(input: {
  venture: VentureOpportunity;
  lane: TikTokBusinessFactoryLane;
  readiness: TikTokBusinessFactoryWorkReadiness;
  createdAt: string;
}): VentureWorkItem[] {
  assertDate(input.createdAt, "TIKTOK_FACTORY_WORK_CREATED_AT_INVALID");
  const { venture, readiness } = input;
  if (
    (input.lane === "affiliate" && venture.family !== "commerce_affiliate") ||
    (input.lane === "pod_seller" && venture.family !== "pod_personalized_commerce")
  ) {
    throw new Error("TIKTOK_FACTORY_WORK_FAMILY_MISMATCH");
  }
  if (!readiness.evidenceRefs.length) {
    throw new Error("TIKTOK_FACTORY_WORK_EVIDENCE_REQUIRED");
  }

  const canExecute = [
    "validated",
    "prototyped",
    "shadow",
    "launched",
    "optimizing",
    "scaling",
  ].includes(venture.lifecycle);

  const steps: Array<{
    id: string;
    agentId: string;
    step: string;
    ready: boolean;
    blocker: string;
  }> = [
    {
      id: "product-research",
      agentId: "agent:market-scout",
      step: "tiktok_product_research",
      ready: readiness.productResearchReady,
      blocker: "product research evidence is incomplete",
    },
    {
      id: "bounded-experiment",
      agentId: "agent:venture-lab",
      step: "tiktok_bounded_experiment",
      ready: readiness.boundedExperimentApproved,
      blocker: "bounded experiment has not been approved",
    },
    {
      id: "product-truth",
      agentId: "agent:director",
      step: "tiktok_product_truth_lock",
      ready: canExecute && readiness.productTruthLocked,
      blocker: !canExecute
        ? "venture has not passed validation"
        : "product truth lock is missing",
    },
    {
      id: "creative",
      agentId: "agent:director",
      step: "tiktok_commercial_creative_batch",
      ready:
        canExecute &&
        readiness.productTruthLocked &&
        readiness.accountCapabilityReady &&
        readiness.creativeReady,
      blocker: !canExecute
        ? "venture has not passed validation"
        : "creative prerequisites are incomplete",
    },
    {
      id: "publication",
      agentId: "agent:growth-operator",
      step: "tiktok_governed_publication",
      ready:
        canExecute &&
        readiness.accountCapabilityReady &&
        readiness.productTruthLocked &&
        readiness.offerEvidenceReady &&
        readiness.creativeReady,
      blocker: !canExecute
        ? "venture has not passed validation"
        : "publication prerequisites are incomplete",
    },
    {
      id: "outcome",
      agentId: "agent:commerce-analyst",
      step:
        input.lane === "affiliate"
          ? "tiktok_affiliate_payout_outcome"
          : "tiktok_seller_settlement_outcome",
      ready:
        readiness.publicationReceiptPresent &&
        readiness.settlementEvidenceReady,
      blocker: "realized publication/settlement evidence is incomplete",
    },
  ];

  return steps.map((step) =>
    Object.freeze({
      id: `work:${venture.id}:${step.id}`,
      ventureId: venture.id,
      agentId: step.agentId,
      step: step.step,
      status: step.ready ? "queued" : "blocked",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      evidenceRefs: [
        ...new Set([
          ...readiness.evidenceRefs,
          ...(step.ready ? [] : [`blocker:${normalizeId(step.blocker)}`]),
        ]),
      ],
      outputRefs: [],
      spendUsd: 0,
      authorizationEffect: "NONE" as const,
    }),
  );
}

function signal(input: VentureMarketSignal): VentureMarketSignal {
  if (!input.sourceRef.trim() || !input.note.trim()) {
    throw new Error("TIKTOK_FACTORY_SIGNAL_EVIDENCE_REQUIRED");
  }
  assertDate(input.observedAt, "TIKTOK_FACTORY_SIGNAL_DATE_INVALID");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("TIKTOK_FACTORY_SIGNAL_CONFIDENCE_INVALID");
  }
  return input;
}

function metricSource(
  sourceRef: string | undefined,
  provider: string,
  productRef: string,
): string {
  return sourceRef?.trim() || `${provider}:${productRef}`;
}

function provenanceConfidence(
  provenance: "observed" | "provider_reported" | "provider_estimated" | "user_reported",
): number {
  switch (provenance) {
    case "observed":
      return 0.95;
    case "provider_reported":
      return 0.88;
    case "provider_estimated":
      return 0.68;
    case "user_reported":
      return 0.6;
  }
}

function cloneProfile(profile: VentureCandidateProfile): VentureCandidateProfile {
  return {
    ...profile,
    unmetAngles: [...profile.unmetAngles],
  };
}

function dedupeSignals(signals: VentureMarketSignal[]): VentureMarketSignal[] {
  const byId = new Map<string, VentureMarketSignal>();
  for (const item of signals) byId.set(item.id, item);
  return [...byId.values()];
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function assertDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

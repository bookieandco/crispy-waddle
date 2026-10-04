export type TikTokBusinessSoftwareEvidence = {
  authorizedObservationAdapter: boolean;
  accountProductOfferAdapter: boolean;
  printifyFulfillmentAdapter: boolean;
  productTruthOfferQc: boolean;
  localRunpodCreativeExecution: boolean;
  governedSkuPublicationReceipt: boolean;
  affiliatePayoutIngestion: boolean;
  sellerSettlementRefundIngestion: boolean;
  productSniperRealizedLearning: boolean;
  boundedAffiliatePodExperiments: boolean;
};

export const TIKTOK_BUSINESS_SOFTWARE_EVIDENCE: TikTokBusinessSoftwareEvidence =
  Object.freeze({
    authorizedObservationAdapter: true,
    accountProductOfferAdapter: true,
    printifyFulfillmentAdapter: true,
    productTruthOfferQc: true,
    localRunpodCreativeExecution: true,
    governedSkuPublicationReceipt: true,
    affiliatePayoutIngestion: true,
    sellerSettlementRefundIngestion: true,
    productSniperRealizedLearning: true,
    boundedAffiliatePodExperiments: true,
  });

export type TikTokBusinessLiveEvidence = {
  sellerShopAuthorized: boolean;
  productObserved: boolean;
  offerObservedOrProvenAbsent: boolean;
  printifyFulfillmentReady: boolean;
  finalQcPassed: boolean;
  creativeArtifactReady: boolean;
  publicationReceiptObserved: boolean;
  affiliate: {
    boundedExperimentPromoted: boolean;
    attributedConversionObserved: boolean;
    paidPayoutObserved: boolean;
    canonicalOutcomeObserved: boolean;
  };
  podSeller: {
    boundedExperimentPromoted: boolean;
    paidOrderObserved: boolean;
    settlementObserved: boolean;
    refundStateReconciled: boolean;
    canonicalOutcomeObserved: boolean;
  };
  productSniperRealizedSamples: number;
  sideHustleOutcomeLearningObserved: boolean;
};

export type TikTokBusinessConfigurationStatus = {
  sellerApiConfigured: boolean;
  affiliateCreatorFinanceConfigured: boolean;
  printifyConfigured: boolean;
  creativeExecutorConfigured: boolean;
  missing: readonly string[];
};

export type TikTokBusinessFinalReport = {
  status: "pass" | "blocked" | "fail";
  softwareStatus: "pass" | "fail";
  liveStatus: "pass" | "blocked" | "fail";
  affiliateLaneStatus: "pass" | "blocked";
  podSellerLaneStatus: "pass" | "blocked";
  softwareBlockers: readonly string[];
  liveBlockers: readonly string[];
  configuration: TikTokBusinessConfigurationStatus;
  authority: "CERTIFICATION_ONLY";
  automaticPublishingAuthorized: false;
  moneyMovementAuthorized: false;
  automaticMaturityPromotionAuthorized: false;
};

export function resolveTikTokBusinessConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): TikTokBusinessConfigurationStatus {
  const sellerRequired = [
    "TIKTOK_SHOP_APP_KEY",
    "TIKTOK_SHOP_APP_SECRET",
    "TIKTOK_SHOP_ACCESS_TOKEN",
    "TIKTOK_SHOP_CIPHER",
    "TIKTOK_SHOP_REGION",
    "TIKTOK_SHOP_ACCOUNT_REF",
  ] as const;
  const sellerMissing = sellerRequired.filter((key) => !env[key]?.trim());

  const affiliateCreatorFinanceConfigured = Boolean(
    env.TIKTOK_AFFILIATE_CREATOR_ACCESS_TOKEN?.trim() &&
      env.TIKTOK_AFFILIATE_CREATOR_ACCOUNT_REF?.trim(),
  );
  const printifyConfigured = Boolean(env.PRINTIFY_API_KEY?.trim());
  const creativeExecutorConfigured = Boolean(
    env.TIKTOK_COMMERCIAL_LOCAL_WORKER_URL?.trim() ||
      (
        env.TIKTOK_COMMERCIAL_RUNPOD_ENDPOINT_ID?.trim() &&
        (
          env.RUNPOD_API_KEY?.trim() ||
          env.RUNPOD_KEY?.trim() ||
          env.runpod_key?.trim()
        )
      ),
  );

  const missing = [
    ...sellerMissing,
    ...(affiliateCreatorFinanceConfigured
      ? []
      : ["TIKTOK_AFFILIATE_CREATOR_ACCESS_TOKEN/ACCOUNT_REF"]),
    ...(printifyConfigured ? [] : ["PRINTIFY_API_KEY"]),
    ...(creativeExecutorConfigured
      ? []
      : ["TIKTOK_COMMERCIAL_LOCAL_WORKER_URL or RUNPOD endpoint/key"]),
  ];

  return Object.freeze({
    sellerApiConfigured: sellerMissing.length === 0,
    affiliateCreatorFinanceConfigured,
    printifyConfigured,
    creativeExecutorConfigured,
    missing: Object.freeze(missing),
  });
}

export function certifyTikTokBusinessFinal(input: {
  software?: TikTokBusinessSoftwareEvidence;
  live: TikTokBusinessLiveEvidence;
  configuration?: TikTokBusinessConfigurationStatus;
}): TikTokBusinessFinalReport {
  const software = input.software ?? TIKTOK_BUSINESS_SOFTWARE_EVIDENCE;
  const configuration =
    input.configuration ?? resolveTikTokBusinessConfiguration();
  const softwareBlockers = Object.entries(software)
    .filter(([, value]) => value !== true)
    .map(([key]) => `software stage incomplete: ${key}`);

  const sharedBlockers: string[] = [];
  if (!input.live.sellerShopAuthorized) sharedBlockers.push("authorized TikTok Shop observation is missing");
  if (!input.live.productObserved) sharedBlockers.push("live product observation is missing");
  if (!input.live.offerObservedOrProvenAbsent) sharedBlockers.push("current offer state is unresolved");
  if (!input.live.finalQcPassed) sharedBlockers.push("final Product Truth/offer QC has not passed");
  if (!input.live.creativeArtifactReady) sharedBlockers.push("commercial creative artifact is not ready");
  if (!input.live.publicationReceiptObserved) sharedBlockers.push("governed publication receipt is missing");
  if (input.live.productSniperRealizedSamples < 1) {
    sharedBlockers.push("Product Sniper has no realized-outcome learning sample");
  }
  if (!input.live.sideHustleOutcomeLearningObserved) {
    sharedBlockers.push("Side Hustle outcome-learning bridge has not observed a realized result");
  }

  const affiliateBlockers = [
    ...sharedBlockers,
    ...(!input.live.affiliate.boundedExperimentPromoted
      ? ["affiliate bounded experiment has not been promoted"]
      : []),
    ...(!input.live.affiliate.attributedConversionObserved
      ? ["attributed TikTok affiliate conversion is missing"]
      : []),
    ...(!input.live.affiliate.paidPayoutObserved
      ? ["provider-paid TikTok affiliate payout is missing"]
      : []),
    ...(!input.live.affiliate.canonicalOutcomeObserved
      ? ["canonical affiliate OpportunityOutcome is missing"]
      : []),
  ];

  const podBlockers = [
    ...sharedBlockers,
    ...(!input.live.printifyFulfillmentReady
      ? ["Printify/TikTok fulfillment readiness is not proven"]
      : []),
    ...(!input.live.podSeller.boundedExperimentPromoted
      ? ["POD bounded experiment has not been promoted"]
      : []),
    ...(!input.live.podSeller.paidOrderObserved
      ? ["paid POD order is missing"]
      : []),
    ...(!input.live.podSeller.settlementObserved
      ? ["seller settlement evidence is missing"]
      : []),
    ...(!input.live.podSeller.refundStateReconciled
      ? ["seller refund state is not reconciled"]
      : []),
    ...(!input.live.podSeller.canonicalOutcomeObserved
      ? ["canonical POD OpportunityOutcome is missing"]
      : []),
  ];

  const configBlockers = configuration.missing.map(
    (item) => `runtime configuration missing: ${item}`,
  );
  const liveBlockers = unique([
    ...configBlockers,
    ...affiliateBlockers,
    ...podBlockers,
  ]);

  const softwareStatus = softwareBlockers.length === 0 ? "pass" : "fail";
  const affiliateLaneStatus =
    affiliateBlockers.length === 0 &&
    configuration.sellerApiConfigured &&
    configuration.affiliateCreatorFinanceConfigured &&
    configuration.creativeExecutorConfigured
      ? "pass"
      : "blocked";
  const podSellerLaneStatus =
    podBlockers.length === 0 &&
    configuration.sellerApiConfigured &&
    configuration.printifyConfigured &&
    configuration.creativeExecutorConfigured
      ? "pass"
      : "blocked";
  const liveStatus =
    affiliateLaneStatus === "pass" && podSellerLaneStatus === "pass"
      ? "pass"
      : "blocked";
  const status =
    softwareStatus === "fail"
      ? "fail"
      : liveStatus === "pass"
        ? "pass"
        : "blocked";

  return Object.freeze({
    status,
    softwareStatus,
    liveStatus,
    affiliateLaneStatus,
    podSellerLaneStatus,
    softwareBlockers: Object.freeze(softwareBlockers),
    liveBlockers: Object.freeze(liveBlockers),
    configuration,
    authority: "CERTIFICATION_ONLY" as const,
    automaticPublishingAuthorized: false as const,
    moneyMovementAuthorized: false as const,
    automaticMaturityPromotionAuthorized: false as const,
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

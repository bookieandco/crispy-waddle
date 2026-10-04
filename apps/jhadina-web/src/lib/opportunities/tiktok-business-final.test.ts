import { describe, expect, it } from "vitest";
import {
  certifyTikTokBusinessFinal,
  resolveTikTokBusinessConfiguration,
} from "./tiktok-business-final";

const livePass = {
  sellerShopAuthorized: true,
  productObserved: true,
  offerObservedOrProvenAbsent: true,
  printifyFulfillmentReady: true,
  finalQcPassed: true,
  creativeArtifactReady: true,
  publicationReceiptObserved: true,
  affiliate: {
    boundedExperimentPromoted: true,
    attributedConversionObserved: true,
    paidPayoutObserved: true,
    canonicalOutcomeObserved: true,
  },
  podSeller: {
    boundedExperimentPromoted: true,
    paidOrderObserved: true,
    settlementObserved: true,
    refundStateReconciled: true,
    canonicalOutcomeObserved: true,
  },
  productSniperRealizedSamples: 2,
  sideHustleOutcomeLearningObserved: true,
};

describe("TIKTOK-BUSINESS.FINAL", () => {
  it("reports software complete but live blocked when credentials/evidence are absent", () => {
    const configuration = resolveTikTokBusinessConfiguration({} as NodeJS.ProcessEnv);
    const report = certifyTikTokBusinessFinal({
      live: {
        ...livePass,
        sellerShopAuthorized: false,
        affiliate: { ...livePass.affiliate, paidPayoutObserved: false },
      },
      configuration,
    });
    expect(report.softwareStatus).toBe("pass");
    expect(report.liveStatus).toBe("blocked");
    expect(report.status).toBe("blocked");
    expect(report.liveBlockers.join("|")).toMatch(/authorized TikTok Shop/);
    expect(report.moneyMovementAuthorized).toBe(false);
  });

  it("passes only with both realized lanes and complete runtime configuration", () => {
    const report = certifyTikTokBusinessFinal({
      live: livePass,
      configuration: {
        sellerApiConfigured: true,
        affiliateCreatorFinanceConfigured: true,
        printifyConfigured: true,
        creativeExecutorConfigured: true,
        missing: [],
      },
    });
    expect(report.softwareStatus).toBe("pass");
    expect(report.affiliateLaneStatus).toBe("pass");
    expect(report.podSellerLaneStatus).toBe("pass");
    expect(report.status).toBe("pass");
    expect(report.automaticPublishingAuthorized).toBe(false);
  });
});

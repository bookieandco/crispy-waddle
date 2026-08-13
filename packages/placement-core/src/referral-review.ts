import type { CareerPassportSnapshot, Referral } from "./domain.js";
import type { ReferralConsent } from "./consent.js";
import { projectReferral, type ReferralProjection } from "./referral-service.js";

export interface AgencyReferralReview {
  referral: ReferralProjection;
  reviewState: "READY";
  allowedActions: Array<"SCHEDULE_INTERVIEW" | "DECLINE_REFERRAL">;
}

export function buildAgencyReferralReview(
  referral: Referral,
  consent: ReferralConsent,
  worker: CareerPassportSnapshot,
): AgencyReferralReview {
  const projection = projectReferral(referral, consent, worker);

  return {
    referral: projection,
    reviewState: "READY",
    allowedActions: ["SCHEDULE_INTERVIEW", "DECLINE_REFERRAL"],
  };
}

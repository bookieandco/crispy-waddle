import type { CareerPassportSnapshot, ID, Referral } from "./domain.js";
import type { ReferralConsent } from "./consent.js";
export interface ReferralProjection { referralId: ID; workerId: ID; jobId: ID; agencyId: ID; match: Referral["match"]; approvedProfile: { workHistory?: string[]; skills?: string[]; verifiedCredentials?: string[]; availability?: string; }; }
export class ReferralConsentError extends Error { constructor(message: string) { super(message); this.name = "ReferralConsentError"; } }
export function projectReferral(referral: Referral, consent: ReferralConsent, worker: CareerPassportSnapshot): ReferralProjection {
  if (consent.id !== referral.consentId) throw new ReferralConsentError("Referral is not linked to the supplied consent record");
  if (consent.workerId !== referral.workerId || consent.agencyId !== referral.agencyId || consent.jobId !== referral.jobId) throw new ReferralConsentError("Consent subject does not match referral");
  if (consent.status !== "GRANTED") throw new ReferralConsentError("Worker consent has not been granted");
  const scopes = new Set(consent.scopes); const approvedProfile: ReferralProjection["approvedProfile"] = {};
  if (scopes.has("relevant_work_history")) approvedProfile.workHistory = worker.workHistory;
  if (scopes.has("matching_skills")) approvedProfile.skills = worker.skills;
  if (scopes.has("verified_credentials")) approvedProfile.verifiedCredentials = worker.verifiedCredentials;
  if (scopes.has("availability")) approvedProfile.availability = worker.availability;
  return { referralId: referral.id, workerId: referral.workerId, jobId: referral.jobId, agencyId: referral.agencyId, match: referral.match, approvedProfile };
}

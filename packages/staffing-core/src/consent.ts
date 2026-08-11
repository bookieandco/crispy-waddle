import type { ID } from "./domain.js";

export type ConsentStatus = "REQUESTED" | "GRANTED" | "DECLINED" | "REVOKED";
export interface ReferralConsent { id: ID; workerId: ID; agencyId: ID; jobId: ID; scopes: string[]; status: ConsentStatus; requestedAt: string; decidedAt?: string; }
export interface ConsentDecision { consentId: ID; workerId: ID; decision: "GRANT" | "DECLINE"; scopes?: string[]; }
export interface ConsentRepository { save(consent: ReferralConsent): Promise<void>; decide(decision: ConsentDecision): Promise<ReferralConsent>; get(id: ID): Promise<ReferralConsent | null>; }
export interface ConsentEventSink { publish(event: { type: "REFERRAL_CONSENT_REQUESTED" | "REFERRAL_CONSENT_GRANTED" | "REFERRAL_CONSENT_DECLINED" | "REFERRAL_CONSENT_REVOKED"; consent: ReferralConsent }): Promise<void>; }

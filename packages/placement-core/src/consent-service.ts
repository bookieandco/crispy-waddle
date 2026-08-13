import type { ID } from "./domain.js";
import type { ConsentDecision, ConsentEventSink, ConsentRepository, ReferralConsent } from "./consent.js";

export interface ConsentIds { next(prefix: string): ID; }
export interface ConsentClock { now(): string; }

export class ReferralConsentService {
  constructor(
    private readonly repository: ConsentRepository,
    private readonly events: ConsentEventSink,
    private readonly ids: ConsentIds,
    private readonly clock: ConsentClock,
  ) {}

  async request(input: {
    organizationId: ID;
    workerId: ID;
    agencyId: ID;
    jobId: ID;
    scopes: string[];
  }): Promise<ReferralConsent> {
    const consent: ReferralConsent = {
      id: this.ids.next("consent"),
      workerId: input.workerId,
      agencyId: input.agencyId,
      jobId: input.jobId,
      scopes: [...new Set(input.scopes)],
      status: "REQUESTED",
      requestedAt: this.clock.now(),
    };

    await this.repository.save(consent);
    await this.events.publish({ type: "REFERRAL_CONSENT_REQUESTED", consent });
    return consent;
  }

  async decide(input: ConsentDecision): Promise<ReferralConsent> {
    const consent = await this.repository.decide(input);
    const eventType = input.decision === "GRANT"
      ? "REFERRAL_CONSENT_GRANTED"
      : "REFERRAL_CONSENT_DECLINED";

    await this.events.publish({ type: eventType, consent });
    return consent;
  }
}

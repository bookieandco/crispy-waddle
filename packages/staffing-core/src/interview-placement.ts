import type { ID, Placement } from "./domain.js";
export type InterviewStatus = "REQUESTED" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type OfferStatus = "DRAFT" | "PROPOSED" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";
export interface Interview { id: ID; referralId: ID; scheduledAt?: string; status: InterviewStatus; notes?: string; }
export interface Offer { id: ID; referralId: ID; workerId: ID; agencyId: ID; employerId: ID; payRate: number; currency: string; billRate?: number; markupPercent?: number; startsAt: string; status: OfferStatus; }
export interface InterviewRepository { saveInterview(interview: Interview): Promise<void>; saveOffer(offer: Offer): Promise<void>; acceptOffer(offerId: ID): Promise<Offer>; getOffer(offerId: ID): Promise<Offer | null>; }
export interface PlacementFactory { createFromAcceptedOffer(offer: Offer): Promise<Placement>; }
export class InterviewOfferService {
  constructor(private readonly repository: InterviewRepository, private readonly placementFactory: PlacementFactory) {}
  async requestInterview(referralId: ID): Promise<Interview> { const interview: Interview = { id: crypto.randomUUID(), referralId, status: "REQUESTED" }; await this.repository.saveInterview(interview); return interview; }
  async createOffer(input: Omit<Offer, "id" | "status">): Promise<Offer> { const offer: Offer = { ...input, id: crypto.randomUUID(), status: "PROPOSED" }; await this.repository.saveOffer(offer); return offer; }
  async acceptOffer(offerId: ID): Promise<Placement> { const offer = await this.repository.acceptOffer(offerId); if (offer.status !== "ACCEPTED") throw new Error("Only an accepted offer can become a placement"); return this.placementFactory.createFromAcceptedOffer(offer); }
}

import type { ID, Placement } from "./domain.js";
import type { InterviewRepository, Offer, PlacementFactory } from "./interview-placement.js";
export interface OfferEventSink { publish(event: { type: "OFFER_PROPOSED" | "OFFER_ACCEPTED" | "OFFER_DECLINED"; offer: Offer }): Promise<void>; }
export class WorkerOfferService {
  constructor(private readonly repository: InterviewRepository, private readonly placementFactory: PlacementFactory, private readonly events: OfferEventSink) {}
  async getOffer(offerId: ID): Promise<Offer> { const offer = await this.repository.getOffer(offerId); if (!offer) throw new Error("Offer not found"); return offer; }
  async accept(offerId: ID, workerId: ID): Promise<Placement> { const current = await this.getOffer(offerId); if (current.workerId !== workerId) throw new Error("Worker is not the offer recipient"); if (current.status !== "PROPOSED") throw new Error("Offer is not available for acceptance"); const offer = await this.repository.acceptOffer(offerId); await this.events.publish({ type: "OFFER_ACCEPTED", offer }); return this.placementFactory.createFromAcceptedOffer(offer); }
}

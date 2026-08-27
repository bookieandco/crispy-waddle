export type OfferStatus = "OPEN" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
export type BookingStatus = "PENDING_APPROVAL";

export interface AcceptedOffer {
  offerId: string;
  status: OfferStatus;
  loadId: string;
  carrierId: string;
  truckId: string;
  driverId: string;
  shipperId: string;
  origin: string;
  destination: string;
  pickupAt: string;
  deliveryAt: string;
  rateMinor: number;
  currency: string;
  acceptedAt: string;
  rateConfirmationId?: string;
}

export interface BookingPackage {
  bookingPackageId: string;
  offerId: string;
  status: BookingStatus;
  loadId: string;
  carrierId: string;
  truckId: string;
  driverId: string;
  shipperId: string;
  lane: { origin: string; destination: string };
  schedule: { pickupAt: string; deliveryAt: string };
  rate: { amountMinor: number; currency: string };
  source: "ACCEPTED_OFFER";
  preparedAt: string;
  approvalRequired: true;
  executionStarted: false;
}

export interface BookingPreparationResult {
  ok: true;
  package: BookingPackage;
} | {
  ok: false;
  reason: "OFFER_NOT_ACCEPTED" | "INVALID_OFFER";
};

export function prepareBookingPackage(
  offer: AcceptedOffer,
  now: string,
  idFactory: () => string = () => `bp_${Date.now()}`,
): BookingPreparationResult {
  if (offer.status !== "ACCEPTED") return { ok: false, reason: "OFFER_NOT_ACCEPTED" };
  if (!offer.offerId || !offer.loadId || !offer.carrierId || !offer.truckId || !offer.driverId || !offer.shipperId) {
    return { ok: false, reason: "INVALID_OFFER" };
  }
  if (!offer.origin || !offer.destination || !offer.pickupAt || !offer.deliveryAt) {
    return { ok: false, reason: "INVALID_OFFER" };
  }
  if (!Number.isInteger(offer.rateMinor) || offer.rateMinor < 0 || !offer.currency) {
    return { ok: false, reason: "INVALID_OFFER" };
  }

  return {
    ok: true,
    package: {
      bookingPackageId: idFactory(),
      offerId: offer.offerId,
      status: "PENDING_APPROVAL",
      loadId: offer.loadId,
      carrierId: offer.carrierId,
      truckId: offer.truckId,
      driverId: offer.driverId,
      shipperId: offer.shipperId,
      lane: { origin: offer.origin, destination: offer.destination },
      schedule: { pickupAt: offer.pickupAt, deliveryAt: offer.deliveryAt },
      rate: { amountMinor: offer.rateMinor, currency: offer.currency },
      source: "ACCEPTED_OFFER",
      preparedAt: now,
      approvalRequired: true,
      executionStarted: false,
    },
  };
}

export const BOOKING_PREPARATION_VERSION = "0.1.0" as const;

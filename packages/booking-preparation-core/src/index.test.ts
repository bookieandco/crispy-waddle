import { describe, expect, it } from "vitest";
import { prepareBookingPackage } from "./index";

const baseOffer = {
  offerId: "offer-1",
  status: "ACCEPTED" as const,
  loadId: "load-1",
  carrierId: "carrier-1",
  truckId: "truck-1",
  driverId: "driver-1",
  shipperId: "shipper-1",
  origin: "Charlotte, NC",
  destination: "Atlanta, GA",
  pickupAt: "2026-08-28T15:00:00Z",
  deliveryAt: "2026-08-29T06:00:00Z",
  rateMinor: 120000,
  currency: "USD",
  acceptedAt: "2026-08-28T12:00:00Z",
};

describe("prepareBookingPackage", () => {
  it("turns an accepted offer into PENDING_APPROVAL without execution", () => {
    const result = prepareBookingPackage(baseOffer, "2026-08-28T12:01:00Z", () => "bp-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.status).toBe("PENDING_APPROVAL");
    expect(result.package.source).toBe("ACCEPTED_OFFER");
    expect(result.package.approvalRequired).toBe(true);
    expect(result.package.executionStarted).toBe(false);
    expect(result.package.rate.amountMinor).toBe(120000);
  });

  it("rejects an OPEN offer", () => {
    const result = prepareBookingPackage({ ...baseOffer, status: "OPEN" }, "2026-08-28T12:01:00Z");
    expect(result).toEqual({ ok: false, reason: "OFFER_NOT_ACCEPTED" });
  });

  it("rejects incomplete accepted offers", () => {
    const result = prepareBookingPackage({ ...baseOffer, driverId: "" }, "2026-08-28T12:01:00Z");
    expect(result).toEqual({ ok: false, reason: "INVALID_OFFER" });
  });
});

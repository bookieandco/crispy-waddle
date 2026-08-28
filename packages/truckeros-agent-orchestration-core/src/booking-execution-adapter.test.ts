import { describe, expect, it, vi } from "vitest";
import { createBookingExecutionTool, type BookingPackageExecutionInput } from "./booking-execution-adapter.js";

const pkg: BookingPackageExecutionInput = {
  bookingPackageId: "bp-1",
  offerId: "offer-1",
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
  status: "PENDING_APPROVAL",
  approvalRequired: true,
  executionStarted: false,
};

describe("booking execution adapter", () => {
  it("delegates only a valid pending package to the injected provider", async () => {
    const execute = vi.fn(async () => ({
      providerBookingId: "dat-booking-1",
      provider: "DAT",
      acceptedAt: "2026-08-28T12:05:00Z",
    }));
    const tool = createBookingExecutionTool({ providerId: "DAT", execute });

    const result = await tool.execute(pkg);

    expect(execute).toHaveBeenCalledWith(pkg);
    expect(result.providerBookingId).toBe("dat-booking-1");
  });

  it("rejects packages that are no longer pending", async () => {
    const execute = vi.fn(async () => ({ providerBookingId: "should-not-run", provider: "DAT", acceptedAt: "now" }));
    const tool = createBookingExecutionTool({ providerId: "DAT", execute });

    await expect(tool.execute({ ...pkg, status: "APPROVED" as never })).rejects.toThrow("PENDING_APPROVAL");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects execution-started or non-approved packages", async () => {
    const execute = vi.fn(async () => ({ providerBookingId: "should-not-run", provider: "DAT", acceptedAt: "now" }));
    const tool = createBookingExecutionTool({ providerId: "DAT", execute });

    await expect(tool.execute({ ...pkg, executionStarted: true })).rejects.toThrow("already started");
    await expect(tool.execute({ ...pkg, approvalRequired: false })).rejects.toThrow("approvalRequired=true");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects incomplete packages before provider invocation", async () => {
    const execute = vi.fn(async () => ({ providerBookingId: "should-not-run", provider: "DAT", acceptedAt: "now" }));
    const tool = createBookingExecutionTool({ providerId: "DAT", execute });

    await expect(tool.execute({ ...pkg, bookingPackageId: "" })).rejects.toThrow("bookingPackageId");
    await expect(tool.execute({ ...pkg, rateMinor: -1 })).rejects.toThrow("rateMinor");
    expect(execute).not.toHaveBeenCalled();
  });
});

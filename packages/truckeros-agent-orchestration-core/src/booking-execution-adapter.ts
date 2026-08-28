import type { AgentTool } from "./types.js";

export const BOOKING_EXECUTION_TOOL_ID = "booking.execute";
export const BOOKING_EXECUTION_CAPABILITY_ID = "freight.booking.execute";

export interface BookingPackageExecutionInput {
  bookingPackageId: string;
  offerId: string;
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
  status: "PENDING_APPROVAL";
  approvalRequired: true;
  executionStarted: false;
}

export interface BookingExecutionResult {
  providerBookingId: string;
  provider: string;
  acceptedAt: string;
}

export interface BookingExecutionProvider {
  readonly providerId: string;
  execute(input: BookingPackageExecutionInput): Promise<BookingExecutionResult>;
}

export function createBookingExecutionTool(
  provider: BookingExecutionProvider,
  now: () => string = () => new Date().toISOString(),
): AgentTool<BookingPackageExecutionInput, BookingExecutionResult> {
  return {
    id: BOOKING_EXECUTION_TOOL_ID,
    name: "Execute approved freight booking",
    domain: "marketplace",
    risk: "approval_required",
    execute: async (input) => {
      assertExecutionPackage(input);
      const result = await provider.execute(input);
      return {
        ...result,
        provider: result.provider || provider.providerId,
        acceptedAt: result.acceptedAt || now(),
      };
    },
  };
}

function assertExecutionPackage(input: BookingPackageExecutionInput): void {
  if (input.status !== "PENDING_APPROVAL") {
    throw new Error(`Booking execution requires PENDING_APPROVAL package: ${input.status}`);
  }
  if (!input.approvalRequired) {
    throw new Error("Booking execution requires approvalRequired=true");
  }
  if (input.executionStarted) {
    throw new Error("Booking package has already started execution");
  }
  for (const [key, value] of Object.entries(input)) {
    if (["rateMinor"].includes(key)) continue;
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(`Booking execution package field is required: ${key}`);
    }
  }
  if (!Number.isInteger(input.rateMinor) || input.rateMinor < 0) {
    throw new Error("Booking execution package rateMinor must be a non-negative integer");
  }
}

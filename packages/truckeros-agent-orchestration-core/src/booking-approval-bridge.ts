import type { ActionProposal, AuthorizationContext } from "./types.js";

/**
 * Structural view of a BookingPackage at the orchestration boundary.
 * The orchestration package does not import booking-preparation-core, keeping
 * the dependency direction one-way and the marketplace boundary isolated.
 */
export interface ExecutionEligibleBookingPackage {
  readonly bookingPackageId: string;
  readonly offerId: string;
  readonly loadId: string;
  readonly carrierId: string;
  readonly truckId: string;
  readonly driverId: string;
  readonly shipperId: string;
  readonly lane: { readonly origin: string; readonly destination: string };
  readonly schedule: { readonly pickupAt: string; readonly deliveryAt: string };
  readonly rate: { readonly amountMinor: number; readonly currency: string };
  readonly status: "PENDING_APPROVAL" | "APPROVED" | "EXECUTION_ELIGIBLE";
  readonly approvalRequired: boolean;
  readonly executionStarted: boolean;
}

export interface BookingExecutionAuthorization extends AuthorizationContext {
  readonly authorizationId: string;
  readonly actorType: "human";
  readonly method: "explicit_user_action";
  readonly authorizedAt: string;
}

export interface BookingApprovalBridgeInput {
  readonly bookingPackage: ExecutionEligibleBookingPackage;
  readonly authorization: BookingExecutionAuthorization;
  readonly workflowRunId: string;
  readonly agentId: string;
  readonly agentVersion: string;
  readonly toolId: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/**
 * Converts an already execution-eligible booking package into an orchestration
 * proposal. This function is deliberately not an approval function: callers
 * must present an EXECUTION_ELIGIBLE package plus explicit human authorization.
 */
export function createBookingExecutionProposal(
  input: BookingApprovalBridgeInput,
): ActionProposal<ExecutionEligibleBookingPackage> {
  assertExecutionEligibility(input.bookingPackage);
  assertAuthorizationBinding(input.bookingPackage, input.authorization);

  return Object.freeze({
    id: `booking-proposal:${input.bookingPackage.bookingPackageId}:${input.authorization.authorizationId}`,
    workflowRunId: input.workflowRunId,
    agentId: input.agentId,
    agentVersion: input.agentVersion,
    toolId: input.toolId,
    input: Object.freeze({
      ...input.bookingPackage,
      lane: Object.freeze({ ...input.bookingPackage.lane }),
      schedule: Object.freeze({ ...input.bookingPackage.schedule }),
      rate: Object.freeze({ ...input.bookingPackage.rate }),
    }),
    authorizationContext: Object.freeze({
      actorId: input.authorization.actorId,
      carrierId: input.authorization.carrierId,
      driverId: input.authorization.driverId,
      resourceId: input.bookingPackage.bookingPackageId,
      capabilityId: input.authorization.capabilityId,
      approvalRequired: true,
    }),
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
  });
}

function assertExecutionEligibility(packageInput: ExecutionEligibleBookingPackage): void {
  if (packageInput.status !== "EXECUTION_ELIGIBLE") {
    throw new Error(`Booking execution proposal requires EXECUTION_ELIGIBLE package: ${packageInput.status}`);
  }
  if (!packageInput.approvalRequired) {
    throw new Error("Booking execution proposal requires approvalRequired=true");
  }
  if (packageInput.executionStarted) {
    throw new Error("Booking package has already started execution");
  }
}

function assertAuthorizationBinding(
  packageInput: ExecutionEligibleBookingPackage,
  authorization: BookingExecutionAuthorization,
): void {
  if (authorization.actorType !== "human" || authorization.method !== "explicit_user_action") {
    throw new Error("Booking execution requires explicit human authorization");
  }
  if (!authorization.authorizationId.trim() || !authorization.actorId.trim()) {
    throw new Error("Booking execution authorization identity is required");
  }
  if (!authorization.capabilityId.trim()) {
    throw new Error("Booking execution authorization capability is required");
  }
  if (authorization.scope !== `booking:${packageInput.bookingPackageId}`) {
    throw new Error("Booking execution authorization scope does not match package");
  }
}

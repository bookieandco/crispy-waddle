export type BookingApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "EXECUTION_ELIGIBLE";
export type ApprovalAction = "APPROVE" | "MARK_EXECUTION_ELIGIBLE";

export interface AuthorizationContext {
  authorizationId: string;
  actorId: string;
  actorType: "human" | "system";
  capability: string;
  scope: string;
  method: "explicit_user_action";
  authorizedAt: string;
}

export interface ApprovalAuditRecord {
  auditId: string;
  entityId: string;
  from: BookingApprovalStatus;
  to: BookingApprovalStatus;
  action: ApprovalAction;
  authorization: AuthorizationContext;
  occurredAt: string;
  previousAuditHash: string | null;
  recordHash: string;
}

export interface ApprovalState {
  entityId: string;
  status: BookingApprovalStatus;
  audit: readonly ApprovalAuditRecord[];
}

export const BOOKING_APPROVAL_CAPABILITY = "marketplace.booking.approve";

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function hashRecord(input: Omit<ApprovalAuditRecord, "recordHash">): string {
  let hash = 2166136261;
  for (const char of stableJson(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function assertAuthorization(auth: AuthorizationContext): void {
  if (!auth.authorizationId || !auth.actorId || !auth.capability || !auth.scope) {
    throw new Error("Explicit authorization context is required");
  }
  if (auth.actorType !== "human" || auth.method !== "explicit_user_action") {
    throw new Error("Booking approval requires an explicit human authorization");
  }
  if (auth.capability !== BOOKING_APPROVAL_CAPABILITY) {
    throw new Error("Authorization capability is not valid for booking approval");
  }
}

function transition(
  state: ApprovalState,
  to: BookingApprovalStatus,
  action: ApprovalAction,
  authorization: AuthorizationContext,
  now: string,
): ApprovalAuditRecord {
  assertAuthorization(authorization);
  const allowed =
    (state.status === "PENDING_APPROVAL" && to === "APPROVED" && action === "APPROVE") ||
    (state.status === "APPROVED" && to === "EXECUTION_ELIGIBLE" && action === "MARK_EXECUTION_ELIGIBLE");
  if (!allowed) throw new Error(`Invalid approval transition: ${state.status} -> ${to}`);

  const previousAuditHash = state.audit.at(-1)?.recordHash ?? null;
  const unsigned: Omit<ApprovalAuditRecord, "recordHash"> = {
    auditId: `${state.entityId}:${now}:${state.audit.length + 1}`,
    entityId: state.entityId,
    from: state.status,
    to,
    action,
    authorization,
    occurredAt: now,
    previousAuditHash,
  };
  return { ...unsigned, recordHash: hashRecord(unsigned) };
}

export function createPendingApproval(entityId: string): ApprovalState {
  if (!entityId) throw new Error("entityId is required");
  return { entityId, status: "PENDING_APPROVAL", audit: [] };
}

export function approvePendingBooking(state: ApprovalState, authorization: AuthorizationContext, now: string): ApprovalState {
  const audit = transition(state, "APPROVED", "APPROVE", authorization, now);
  return { ...state, status: "APPROVED", audit: [...state.audit, audit] };
}

export function markBookingExecutionEligible(state: ApprovalState, authorization: AuthorizationContext, now: string): ApprovalState {
  const audit = transition(state, "EXECUTION_ELIGIBLE", "MARK_EXECUTION_ELIGIBLE", authorization, now);
  return { ...state, status: "EXECUTION_ELIGIBLE", audit: [...state.audit, audit] };
}

export function isExecutionEligible(state: ApprovalState): boolean {
  return state.status === "EXECUTION_ELIGIBLE";
}

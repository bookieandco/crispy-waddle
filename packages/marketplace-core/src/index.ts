export {
  BOOKING_APPROVAL_CAPABILITY,
  approvePendingBooking,
  createPendingApproval,
  isExecutionEligible,
  markBookingExecutionEligible,
} from "./approval-gate";
export type {
  ApprovalAuditRecord,
  ApprovalState,
  ApprovalTransitionResult,
  AuthorizationContext,
  BookingApprovalStatus,
} from "./approval-gate";

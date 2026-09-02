import type {
  CommerceAuthorizationDecision,
  CommerceIntent,
} from "./commerce-intent";

export interface CommerceExecutionRequest {
  intent: CommerceIntent;
  authorization: CommerceAuthorizationDecision;
  idempotencyKey: string;
}

export type CommerceExecutionStatus =
  | "accepted"
  | "completed"
  | "rejected"
  | "failed";

export interface CommerceExecutionResult<T = unknown> {
  executionId: string;
  status: CommerceExecutionStatus;
  providerId?: string;
  result?: T;
  errorCode?: string;
  completedAt?: string;
}

/** Runtime boundary for commerce mutations; providers must not bypass authorization. */
export interface CommerceExecutionBoundary {
  execute<T>(request: CommerceExecutionRequest): Promise<CommerceExecutionResult<T>>;
}

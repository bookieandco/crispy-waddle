/**
 * CoreSpine → ActionCore Translation Boundary
 *
 * Issue #140: Establishes ONE explicit composition/translation boundary
 * between @jhadina/core-spine (orchestration/control-plane) and
 * @jhadina/action-core (concrete enforcement/approval/execution).
 *
 * WHY THIS FILE EXISTS
 * ====================
 * Core Spine defines the *semantic* action contract:
 *   ActionRequest  – capability + operation + consequence level
 *   PolicyDecision – allowed flag + requiredApproval
 *   ActionResult   – success flag + output
 *
 * Action Core defines the *concrete* execution contract:
 *   ActionRequest  – userId + type (string) + action payload
 *   ActionPolicy   – three-state: allow | deny | approval_required
 *   ActionExecutor – policy → handler → ledger pipeline
 *
 * These two sets of types evolved independently and MUST NOT be silently
 * merged or replaced with a third model.  This file is the single, auditable
 * place where the translation happens.
 *
 * HOW IT WORKS
 * ============
 * 1. `translateToActionCoreRequest()` converts a Spine ActionRequest + userId
 *    into an Action Core ActionRequest.  The capability + operation become the
 *    `type` field; the input becomes the `action` payload.
 *
 * 2. `translateFromActionCoreResult()` converts an Action Core result value
 *    into a Spine ActionResult.
 *
 * 3. `ActionCorePortAdapter` implements Spine's `ActionPort` interface by
 *    delegating to an Action Core executor-compatible object.  It accepts the
 *    executor as a generic `ActionCoreExecutor<TAction, TResult>` interface so
 *    this file does NOT need a runtime dependency on `@jhadina/action-core`.
 *    The composition root provides the concrete executor.
 *
 * WHAT IT DOES NOT DO
 * ===================
 * - Does NOT duplicate the Policy engine (Core Spine's PolicyDecision drives
 *   whether the request is even prepared; Action Core evaluates its own policy
 *   inside execute()).
 * - Does NOT replace ApprovalReceipt handling (action-core manages expiry,
 *   replay protection, and identity binding).
 * - Does NOT bypass the governed path: ask-jhadina → policy → action-core.
 */

import type {
  ActionRequest as SpineActionRequest,
  ActionResult as SpineActionResult,
  DecisionProposal,
  PolicyDecision,
} from './types.js';
import type { ActionPort } from './spine.js';

// ---------------------------------------------------------------------------
// Minimal mirror of @jhadina/action-core's ActionRequest so this file
// does not take a runtime dependency on that package.  The composition root
// (e.g. jhadina-web) is responsible for wiring the concrete executor that
// satisfies this interface.
// ---------------------------------------------------------------------------
export interface ActionCoreRequest<TAction = unknown> {
  id: string;
  userId: string;
  type: string;
  action: TAction;
  requestedAt: string;
  approvalReceiptId?: string;
}

export interface ActionCoreExecutor<TAction = unknown, TResult = unknown> {
  execute(request: ActionCoreRequest<TAction>): Promise<TResult>;
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Core Spine ActionRequest into an Action Core ActionRequest.
 *
 * Translation rules:
 *   • id             → id  (preserved; both systems use UUID correlation)
 *   • capability + '.' + operation  → type
 *   • input          → action  (opaque payload; Action Core handlers inspect it)
 *   • userId is injected by the caller (not present in Spine ActionRequest
 *     because Spine operates at the orchestration level above individual users)
 *   • approvalReceiptId is optional; supply it when PolicyDecision.requiredApproval
 *     is true and the user has provided a receipt from the approval flow.
 */
export function translateToActionCoreRequest<TAction = unknown>(
  spineRequest: SpineActionRequest,
  userId: string,
  approvalReceiptId?: string,
): ActionCoreRequest<TAction> {
  return {
    id: spineRequest.id,
    userId,
    type: `${spineRequest.capability}.${spineRequest.operation}`,
    action: spineRequest.input as TAction,
    requestedAt: new Date().toISOString(),
    ...(approvalReceiptId ? { approvalReceiptId } : {}),
  };
}

/**
 * Converts an Action Core result value into a Core Spine ActionResult.
 *
 * Action Core handlers return an opaque TResult; we preserve it as `output`.
 */
export function translateFromActionCoreResult<TResult = unknown>(
  spineRequestId: string,
  result: TResult,
): SpineActionResult {
  return {
    id: crypto.randomUUID(),
    requestId: spineRequestId,
    success: true,
    output: result,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Converts an Action Core error into a Core Spine ActionResult that
 * accurately represents the failure.
 */
export function translateFromActionCoreError(
  spineRequestId: string,
  error: unknown,
): SpineActionResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: crypto.randomUUID(),
    requestId: spineRequestId,
    success: false,
    error: message,
    completedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ActionPort implementation
// ---------------------------------------------------------------------------

/**
 * Action specification provided at adapter construction time.
 * Because Core Spine's DecisionProposal does not carry structured
 * capability/operation data (Issue #140 root cause), the composition root
 * must supply this information when wiring the adapter.
 */
export interface ActionSpec {
  /** Capability name as registered in CapabilityRegistry (e.g. 'memory'). */
  capability: string;
  /** Operation within the capability (e.g. 'propose'). */
  operation: string;
  /** Opaque action payload forwarded to the Action Core handler. */
  input?: unknown;
  /** Whether this action can be reversed. Defaults to false. */
  reversible?: boolean;
  /** Consequence level for audit / approval thresholds. Defaults to 'low'. */
  consequenceLevel?: SpineActionRequest['consequenceLevel'];
}

/**
 * Implements Core Spine's ActionPort by delegating to an Action Core executor.
 *
 * This is the ONLY class that may cross the Core Spine ↔ Action Core boundary.
 * Composition roots supply the concrete executor and an ActionSpec so that
 * `prepare()` can materialise a concrete SpineActionRequest.
 *
 * Caller responsibilities:
 *   • Supply a real userId from the verified identity context.
 *   • Supply an approvalReceiptId when PolicyDecision.requiredApproval is true.
 *   • Supply an ActionSpec with the capability/operation/input for this action.
 *   • Never pass an AllowAllActionPolicy-backed executor to this adapter in
 *     production (see @testOnly note on AllowAllActionPolicy).
 */
export class ActionCorePortAdapter<TAction = unknown, TResult = unknown>
  implements ActionPort
{
  constructor(
    private readonly executor: ActionCoreExecutor<TAction, TResult>,
    private readonly userId: string,
    private readonly actionSpec: ActionSpec,
    private readonly approvalReceiptId?: string,
  ) {}

  /**
   * Materialises a SpineActionRequest from the DecisionProposal and policy.
   *
   * Returns undefined when:
   *   • The policy did not allow the action (allowed=false), regardless of
   *     requiredApproval — a hard deny always wins.
   *   • Approval is required but no receipt has been supplied — the caller
   *     must re-enter with an approvalReceiptId.
   *
   * Returns a concrete SpineActionRequest otherwise, which the Spine run loop
   * passes directly to execute().
   */
  async prepare(
    proposal: DecisionProposal,
    policy: PolicyDecision,
  ): Promise<SpineActionRequest | undefined> {
    // Hard deny: allowed=false always short-circuits, regardless of requiredApproval.
    if (!policy.allowed) {
      return undefined;
    }
    // Policy allows but requires an approval receipt that has not been supplied.
    if (policy.requiredApproval && !this.approvalReceiptId) {
      return undefined;
    }
    return {
      id: crypto.randomUUID(),
      proposalId: proposal.id,
      capability: this.actionSpec.capability,
      operation: this.actionSpec.operation,
      input: this.actionSpec.input,
      reversible: this.actionSpec.reversible ?? false,
      consequenceLevel: this.actionSpec.consequenceLevel ?? 'low',
    };
  }

  async execute(request: SpineActionRequest): Promise<SpineActionResult> {
    const coreRequest = translateToActionCoreRequest<TAction>(
      request,
      this.userId,
      this.approvalReceiptId,
    );
    try {
      const result = await this.executor.execute(coreRequest);
      return translateFromActionCoreResult(request.id, result);
    } catch (error) {
      return translateFromActionCoreError(request.id, error);
    }
  }
}

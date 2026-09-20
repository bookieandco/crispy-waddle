import { createHash } from 'node:crypto'
import type { ActionRequest } from '@jhadina/action-core'
import type { ExecutionAction, ExecutionPermit } from './execution-permit.js'

/**
 * MONEY-R1 — canonical bridge from Jhadina Action Core authority into Money.
 *
 * Action Core owns identity/policy/approval authority. Money owns the exact
 * economic binding and execution invariants. This bridge never creates
 * authority; it only proves that an already-governed request and Money permit
 * describe the same action.
 */
export type MoneyAuthorityBinding = Readonly<{
  actionRequestId: string
  userId: string
  capability: string
  approvalReceiptId?: string
  executionPermitId: string
  actionFingerprint: string
  policyVersion: string
  policyHash: string
}>

export function fingerprintActionRequest<TAction>(request: ActionRequest<TAction>): string {
  return createHash('sha256').update(JSON.stringify({
    id: request.id,
    userId: request.userId,
    type: request.type,
    action: request.action,
    requestedAt: request.requestedAt,
    approvalReceiptId: request.approvalReceiptId ?? null,
  }), 'utf8').digest('hex')
}

export function bindActionCoreAuthority(
  request: ActionRequest<unknown>,
  action: ExecutionAction,
  permit: ExecutionPermit,
): MoneyAuthorityBinding {
  if (!request.id || !request.userId || !request.type) throw new Error('MONEY_ACTION_CORE_REQUEST_INCOMPLETE')
  if (request.id !== action.actionId) throw new Error('MONEY_ACTION_CORE_ACTION_ID_MISMATCH')
  if (request.userId !== action.userId) throw new Error('MONEY_ACTION_CORE_USER_MISMATCH')
  if (request.type !== action.capability) throw new Error('MONEY_ACTION_CORE_CAPABILITY_MISMATCH')
  if (permit.binding.userId !== request.userId) throw new Error('MONEY_ACTION_CORE_PERMIT_USER_MISMATCH')
  if (permit.binding.capability !== request.type) throw new Error('MONEY_ACTION_CORE_PERMIT_CAPABILITY_MISMATCH')
  if (request.approvalReceiptId !== permit.binding.approvalId) throw new Error('MONEY_ACTION_CORE_APPROVAL_MISMATCH')

  return Object.freeze({
    actionRequestId: request.id,
    userId: request.userId,
    capability: request.type,
    approvalReceiptId: request.approvalReceiptId,
    executionPermitId: permit.permitId,
    actionFingerprint: permit.binding.actionFingerprint,
    policyVersion: permit.binding.policyVersion,
    policyHash: permit.binding.policyHash,
  })
}

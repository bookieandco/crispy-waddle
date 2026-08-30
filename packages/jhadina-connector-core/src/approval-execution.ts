import type { ApprovalGrant } from './approval.js'
import { verifyApproval } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'

export interface ApprovalExecutionStore {
  consume(approvalId: string): boolean
}

export class InMemoryApprovalExecutionStore implements ApprovalExecutionStore {
  private readonly consumed = new Set<string>()
  consume(approvalId: string): boolean {
    if (this.consumed.has(approvalId)) return false
    this.consumed.add(approvalId)
    return true
  }
}

export function authorizeApprovedExecution(
  proposal: AuthoritativeActionProposal,
  approval: ApprovalGrant,
  approverIdentityId: string,
  store: ApprovalExecutionStore,
  now = new Date(),
): void {
  verifyApproval(proposal, approval, approverIdentityId, now)
  if (!store.consume(approval.approvalId)) throw new Error('Approval has already been consumed')
}

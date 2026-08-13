import type { MoneyCapability } from './capabilities.js';

export type ApprovalDecision = 'approved' | 'rejected';

export type ApprovalRequest = {
  requestId: string;
  userId: string;
  capability: MoneyCapability;
};

/**
 * The write boundary depends on this port, never on a UI or provider-specific approval implementation.
 * Implementations must fail closed: unknown/missing approvals must not authorize a financial write.
 */
export interface ApprovalPort {
  requireApproved(request: ApprovalRequest): Promise<void>;
}

export function createFailClosedApprovalPort(): ApprovalPort {
  return {
    async requireApproved() {
      throw new Error('MONEY_APPROVAL_REQUIRED');
    },
  };
}

import type { StripeSandboxTestPaymentMethod } from "./stripe-sandbox-provider"

/**
 * Phase 4.6: the durable content of one proposed Commerce money-moving
 * action. Restricted to a Stripe *sandbox* test payment method — no live
 * credential or card ever reaches this boundary (StripeSandboxPaymentProvider
 * itself refuses anything but a sk_test_ secret; this restricts the
 * request-level payload the same way).
 */
export interface CommerceProposalPayload {
  amountMinor: number
  currency: string
  description: string
  testPaymentMethod: StripeSandboxTestPaymentMethod
}

export type CommerceProposalStatus = "pending" | "approved" | "executed"

export interface CommerceProposal {
  id: string
  userId: string
  capability: string
  payload: CommerceProposalPayload
  status: CommerceProposalStatus
  receiptId?: string
  result?: Record<string, unknown>
  requestedAt: string
  decidedAt?: string
  executedAt?: string
}

export interface CommerceProposalStore {
  create(input: {
    userId: string
    capability: string
    payload: CommerceProposalPayload
  }): Promise<CommerceProposal>
  /** Returns undefined for a missing proposal or one not owned by userId — callers must not distinguish the two to an unauthorized caller. */
  get(proposalId: string, userId: string): Promise<CommerceProposal | undefined>
  markApproved(proposalId: string, userId: string, receiptId: string): Promise<CommerceProposal>
  markExecuted(proposalId: string, userId: string, result: Record<string, unknown>): Promise<CommerceProposal>
}

/**
 * Reference/test double, scoped by userId exactly like the production
 * Supabase store's RLS + auth.uid()-bound RPCs — a proposal owned by one
 * user is invisible and untransitionable to another, even by id. Production
 * composition uses createSupabaseCommerceProposalStore() instead; this
 * exists so the governed lifecycle functions and their tests never depend
 * on a live database, mirroring InMemoryApprovalReceiptStore's own role
 * for the shared receipt primitive.
 */
export function createInMemoryCommerceProposalStore(): CommerceProposalStore {
  const rows = new Map<string, CommerceProposal>()
  let counter = 0

  function owned(proposalId: string, userId: string): CommerceProposal | undefined {
    const row = rows.get(proposalId)
    return row && row.userId === userId ? row : undefined
  }

  return {
    async create(input) {
      counter += 1
      const now = new Date().toISOString()
      const proposal: CommerceProposal = {
        id: `proposal_${counter}_${Math.random().toString(36).slice(2, 8)}`,
        userId: input.userId,
        capability: input.capability,
        payload: input.payload,
        status: "pending",
        requestedAt: now,
      }
      rows.set(proposal.id, proposal)
      return proposal
    },
    async get(proposalId, userId) {
      return owned(proposalId, userId)
    },
    async markApproved(proposalId, userId, receiptId) {
      const existing = owned(proposalId, userId)
      if (!existing || existing.status !== "pending") throw new Error("proposal cannot be approved")
      const updated: CommerceProposal = { ...existing, status: "approved", receiptId, decidedAt: new Date().toISOString() }
      rows.set(proposalId, updated)
      return updated
    },
    async markExecuted(proposalId, userId, result) {
      const existing = owned(proposalId, userId)
      if (!existing || existing.status !== "approved") throw new Error("proposal cannot be executed")
      const updated: CommerceProposal = { ...existing, status: "executed", result, executedAt: new Date().toISOString() }
      rows.set(proposalId, updated)
      return updated
    },
  }
}

import type { CommerceProposal, CommerceProposalPayload, CommerceProposalStatus, CommerceProposalStore } from "./commerce-proposal-store"
import { createClient } from "../supabase/server"

type ProposalRow = {
  id: string
  user_id: string
  capability: string
  payload: CommerceProposalPayload
  status: CommerceProposalStatus
  receipt_id: string | null
  result: Record<string, unknown> | null
  requested_at: string
  decided_at: string | null
  executed_at: string | null
}

function toProposal(row: ProposalRow): CommerceProposal {
  return {
    id: row.id,
    userId: row.user_id,
    capability: row.capability,
    payload: row.payload,
    status: row.status,
    receiptId: row.receipt_id ?? undefined,
    result: row.result ?? undefined,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? undefined,
    executedAt: row.executed_at ?? undefined,
  }
}

/**
 * Request-scoped production CommerceProposalStore. Every mutation runs
 * through a database function bound to auth.uid(), exactly like
 * createSupabaseCommerceApprovalReceiptStore() — a proposal can never be
 * read or transitioned by anyone other than the authenticated owner who
 * created it, and every transition (pending -> approved -> executed, or
 * pending -> denied) is atomic and state-checked in the database itself.
 */
export function createSupabaseCommerceProposalStore(): CommerceProposalStore {
  return {
    async create(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_commerce_create_proposal", {
          p_capability: input.capability,
          p_payload: input.payload,
        })
        .single<ProposalRow>()

      if (error || !data) throw new Error(`Unable to create commerce proposal: ${error?.message ?? "no proposal returned"}`)
      return toProposal(data)
    },

    async get(proposalId, _userId) {
      void _userId // RLS ("commerce proposals are owner readable") already scopes this to auth.uid()
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_commerce_proposals")
        .select("*")
        .eq("id", proposalId)
        .maybeSingle<ProposalRow>()

      if (error) throw new Error(`Unable to load commerce proposal: ${error.message}`)
      return data ? toProposal(data) : undefined
    },

    async markApproved(proposalId, _userId, receiptId) {
      void _userId // the database independently binds the transition to auth.uid()
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_commerce_mark_proposal_approved", { p_proposal_id: proposalId, p_receipt_id: receiptId })
        .single<ProposalRow>()

      if (error || !data) throw new Error(`Commerce proposal cannot be approved: ${error?.message ?? "proposal unavailable"}`)
      return toProposal(data)
    },

    async markExecuted(proposalId, _userId, result) {
      void _userId
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_commerce_mark_proposal_executed", { p_proposal_id: proposalId, p_result: result })
        .single<ProposalRow>()

      if (error || !data) throw new Error(`Commerce proposal cannot be executed: ${error?.message ?? "proposal unavailable"}`)
      return toProposal(data)
    },
  }
}

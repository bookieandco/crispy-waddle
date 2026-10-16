import type {ApprovalReceiptStore} from "@jhadina/action-core"

/**
 * Production Ask has no commissioned durable approval store or owner-resume
 * endpoint yet. A process-local receipt would vanish on restart and might be
 * reported as a real owner approval. Fail before issuing one instead.
 *
 * This is intentionally NOT another approval authority. Replace only with
 * the existing Action Core contract backed by owner-authenticated, atomic
 * durable transitions and separately tested resume.
 */
export function uncommissionedAskApprovalStore(): ApprovalReceiptStore {
  return {
    async createPending() {
      throw new Error("JHADINA_ASK_DURABLE_APPROVAL_NOT_COMMISSIONED")
    },
    async approve() {
      throw new Error("JHADINA_ASK_DURABLE_APPROVAL_NOT_COMMISSIONED")
    },
    async consume() {
      return false
    },
  }
}

import { describe, expect, it } from "vitest"
import { InMemoryActionLedger, InMemoryApprovalReceiptStore } from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { COMMERCE_PAYMENT_CHARGE_CAPABILITY, COMMERCE_PAYMENT_REFUND_CAPABILITY } from "./commerce-security-policy"
import {
  approveCommerceReceipt,
  consumeCommerceApproval,
  proposeCommerceApproval,
} from "./commerce-approval-lifecycle"

function identity(userId: string): ActionRequestIdentity {
  return { userId, sessionId: `session-${userId}` }
}

function verifier(expected: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== expected.userId) throw new Error("Action identity mismatch")
      return expected
    },
  }
}

function deps(userId = "user-1") {
  return {
    identityVerifier: verifier(identity(userId)),
    approvalStore: new InMemoryApprovalReceiptStore(),
    ledger: new InMemoryActionLedger(),
  }
}

describe("Commerce manual approval lifecycle", () => {
  it("creates pending receipts without approving or executing", async () => {
    const d = deps()
    const proposal = await proposeCommerceApproval(d, "user-1", "action-1", "fp-1")

    expect(proposal.chargeReceipt.status).toBe("pending")
    expect(proposal.refundReceipt.status).toBe("pending")
    expect(proposal.chargeReceipt.userId).toBe("user-1")
    expect(proposal.fingerprint).toBe("fp-1")
  })

  it("requires the verified actor to explicitly approve a receipt", async () => {
    const d = deps()
    const proposal = await proposeCommerceApproval(d, "user-1", "action-2", "fp-2")
    const approved = await approveCommerceReceipt(d, "user-1", proposal.chargeReceipt.id)

    expect(approved.status).toBe("approved")
    expect(approved.approvedAt).toBeDefined()
  })

  it("rejects an approval attempt from a different identity", async () => {
    const d = deps("user-1")
    const proposal = await proposeCommerceApproval(d, "user-1", "action-3", "fp-3")

    await expect(approveCommerceReceipt(d, "user-2", proposal.chargeReceipt.id)).rejects.toThrow("Action identity mismatch")
  })

  it("consumes an approved receipt once and rejects replay", async () => {
    const d = deps()
    const proposal = await proposeCommerceApproval(d, "user-1", "action-4", "fp-4")
    await approveCommerceReceipt(d, "user-1", proposal.chargeReceipt.id)

    await expect(
      consumeCommerceApproval(
        d,
        "user-1",
        proposal.chargeReceipt.id,
        "action-4",
        COMMERCE_PAYMENT_CHARGE_CAPABILITY,
        "fp-4",
      ),
    ).resolves.toBeUndefined()

    await expect(
      consumeCommerceApproval(
        d,
        "user-1",
        proposal.chargeReceipt.id,
        "action-4",
        COMMERCE_PAYMENT_CHARGE_CAPABILITY,
        "fp-4",
      ),
    ).rejects.toThrow("Invalid, expired, or already-consumed commerce approval receipt")
  })

  it("rejects a receipt bound to a different action or fingerprint", async () => {
    const d = deps()
    const proposal = await proposeCommerceApproval(d, "user-1", "action-5", "fp-5")
    await approveCommerceReceipt(d, "user-1", proposal.refundReceipt.id)

    await expect(
      consumeCommerceApproval(
        d,
        "user-1",
        proposal.refundReceipt.id,
        "action-other",
        COMMERCE_PAYMENT_REFUND_CAPABILITY,
        "fp-5",
      ),
    ).rejects.toThrow("Invalid, expired, or already-consumed commerce approval receipt")
  })
})

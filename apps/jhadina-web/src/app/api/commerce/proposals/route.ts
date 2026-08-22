import { NextRequest, NextResponse } from "next/server"
import { runProposeCommerceAction } from "@/lib/commerce/commerce-proposal-runtime"
import { isStripeSandboxTestPaymentMethod } from "@/lib/commerce/stripe-sandbox-provider"

export const dynamic = "force-dynamic"

/**
 * Phase 4.6, Stage 1: POST /api/commerce/proposals.
 *
 * Creates a durable PENDING Commerce proposal after policy evaluation.
 * This route never approves and never executes anything — see
 * commerce-proposal-lifecycle.ts's proposeCommerceAction for the full
 * governed sequence this thin adapter delegates to.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const claimedUserId = req.headers.get("x-jhadina-user-id") || "default-user"

  const amountMinor = body?.amountMinor
  const currency = body?.currency
  const description = body?.description
  const testPaymentMethod = body?.testPaymentMethod ?? "pm_card_visa"

  if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    return NextResponse.json({ success: false, error: "amountMinor must be a positive integer" }, { status: 400 })
  }
  if (typeof currency !== "string" || currency.length !== 3) {
    return NextResponse.json({ success: false, error: "currency must be a 3-letter ISO currency code" }, { status: 400 })
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json({ success: false, error: "description is required" }, { status: 400 })
  }
  if (typeof testPaymentMethod !== "string" || !isStripeSandboxTestPaymentMethod(testPaymentMethod)) {
    return NextResponse.json({ success: false, error: "testPaymentMethod must be a known Stripe sandbox test payment method" }, { status: 400 })
  }

  try {
    const result = await runProposeCommerceAction(claimedUserId, {
      amountMinor,
      currency: currency.toLowerCase(),
      description,
      testPaymentMethod,
    })
    return NextResponse.json({
      success: true,
      data: { proposal: result.proposal, verifiedUserId: result.verifiedUserId },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated")
      ? 401
      : message.includes("denied by policy")
        ? 403
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

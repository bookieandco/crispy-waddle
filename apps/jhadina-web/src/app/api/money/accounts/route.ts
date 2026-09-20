import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { runSessionGovernedMoneyAccountRead } from "@/lib/money/governed-account-read-runtime"

export const dynamic = "force-dynamic"

/**
 * PL-8 (Jhadina OS Integration Phase 2, Money real-integration Phase 1):
 * the first real, governed Money route — the minimum vertical slice the
 * audit identified (a governed API route, no UI). Mirrors
 * /api/growth/activity's shape: this route is the only application
 * boundary between a caller and the governed Money account-read
 * runtime; nothing imports governed-account-read-runtime directly.
 *
 * This route is the canonical read boundary selected for the JH-028/JH-033
 * reconciliation. Actor identity comes from the authenticated session; a
 * client-supplied user id is neither required nor trusted. Product UI may
 * consume this route, but may not create a second Plaid client.
 */
export async function GET(req: NextRequest) {
  const requestId = req.headers.get("x-jhadina-request-id") || randomUUID()

  try {
    const { accounts, verifiedUserId } = await runSessionGovernedMoneyAccountRead(requestId)
    return NextResponse.json({ success: true, data: { accounts, verifiedUserId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load accounts"
    const status = message.includes("identity") || message.includes("session") ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

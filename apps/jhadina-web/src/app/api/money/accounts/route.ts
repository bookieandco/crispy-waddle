import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { runGovernedMoneyAccountRead } from "@/lib/money/governed-account-read-runtime"

export const dynamic = "force-dynamic"

export async function GET() {
  const requestId = randomUUID()

  try {
    const { accounts, verifiedUserId } = await runGovernedMoneyAccountRead(requestId)
    return NextResponse.json({ success: true, data: { accounts, verifiedUserId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load accounts"
    const status =
      message.includes("identity") || message.includes("session") || message.includes("Authenticated")
        ? 401
        : message.includes("WORKSPACE_DENIED") || message.includes("OWNERSHIP")
          ? 403
          : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

import { NextResponse } from "next/server"
import { getPlaidFinancialSnapshot } from "@/lib/money/plaidFinancialData"

export async function GET() {
  try {
    return NextResponse.json({ data: await getPlaidFinancialSnapshot() })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Financial data unavailable"
    const configured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET && process.env.PLAID_ACCESS_TOKEN)
    return NextResponse.json({ data:{ provider:"PLAID", connected:false, accounts:[], transactions:[], fetchedAt:new Date().toISOString() }, error:message, configured }, { status: configured ? 502 : 503 })
  }
}

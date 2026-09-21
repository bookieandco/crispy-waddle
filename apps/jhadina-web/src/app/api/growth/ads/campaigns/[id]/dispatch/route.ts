import { NextResponse } from "next/server"
import { dispatchQueuedPaidCampaign } from "@/lib/growth/governed-paid-campaign"

export const dynamic = "force-dynamic"

export async function POST(_req: Request, context: { params: { id: string } }) {
  try {
    const result = await dispatchQueuedPaidCampaign(context.params.id)
    return NextResponse.json({ success: true, data: result }, { status: result.providerState === "pending_configuration" ? 202 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paid campaign dispatch failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : message.includes("NOT_FOUND") ? 404 : 409
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    ok: true,
    events: [],
    note: "Activity endpoint is ready for the shared audit sink; persisted audit events will populate this feed."
  })
}

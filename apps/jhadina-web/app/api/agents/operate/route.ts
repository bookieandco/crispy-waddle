import { NextResponse } from "next/server"
import { createLiveJhadinaOperatingLoop } from "../../../../src/lib/agents/live-operating-loop"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === "string" ? body.userId : ""
  const objective = typeof body.objective === "string" ? body.objective.trim() : ""

  if (!userId || !objective) {
    return NextResponse.json({ ok: false, error: "userId and objective are required" }, { status: 400 })
  }

  // Concrete DELIA/MARISA providers are injected by the application composition root.
  // This route intentionally does not construct an ungoverned executor or perform side effects.
  return NextResponse.json({
    ok: false,
    status: "NOT_CONFIGURED",
    message: "The governed operating loop is wired as the runtime contract; application DI must provide DELIA, MARISA, and the persistent audit sink before actions can execute.",
  }, { status: 503 })
}

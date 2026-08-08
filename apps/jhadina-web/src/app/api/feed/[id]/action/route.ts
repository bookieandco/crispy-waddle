import { NextRequest, NextResponse } from "next/server"
import { handleApproveMemory, handleRejectMemory } from "../../../../../lib/routes/handlers"

function memoryCandidateId(id: string): string | null {
  if (!id.startsWith("memory-candidate:")) return null
  const candidateId = id.slice("memory-candidate:".length)
  return candidateId || null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === "string" ? body.action : ""
  const candidateId = memoryCandidateId(id)

  if (!candidateId) {
    return NextResponse.json(
      { error: "This feed item does not have an executable backend action yet." },
      { status: 409 }
    )
  }

  if (action === "approve") {
    const response = await handleApproveMemory(
      new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({ candidateId }),
      })
    )
    return response
  }

  if (action === "reject") {
    const response = await handleRejectMemory(
      new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({ candidateId }),
      })
    )
    return response
  }

  if (action === "defer") {
    return NextResponse.json({
      success: true,
      data: { status: "DEFERRED", cardId: id },
    })
  }

  return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 })
}

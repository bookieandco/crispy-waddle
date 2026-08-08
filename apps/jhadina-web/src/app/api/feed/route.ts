import { NextRequest, NextResponse } from "next/server"
import { handleListCandidates, handleListMemories } from "../../../lib/routes/handlers"
import type { JhadinaFeedItem } from "../../../lib/feed/types"

function itemTime(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "Just now"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Just now"
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export async function GET(req: NextRequest) {
  try {
    const [candidateResponse, memoryResponse] = await Promise.all([
      handleListCandidates(req),
      handleListMemories(req),
    ])

    if (!candidateResponse.ok || !memoryResponse.ok) {
      return NextResponse.json({ error: "Unable to build feed" }, { status: 502 })
    }

    const candidatesPayload = await candidateResponse.json()
    const memoriesPayload = await memoryResponse.json()
    const candidates = Array.isArray(candidatesPayload?.data?.candidates) ? candidatesPayload.data.candidates : []
    const memories = Array.isArray(memoriesPayload?.data?.memories) ? memoriesPayload.data.memories : []

    const items: JhadinaFeedItem[] = [
      ...candidates.map((candidate: Record<string, unknown>) => ({
        id: `memory-candidate:${String(candidate.id)}`,
        type: "approval" as const,
        title: "Jhadina wants to remember this",
        summary: String(candidate.content ?? candidate.text ?? "A new memory candidate is waiting for your review."),
        reason: "This was surfaced because Jhadina classified it as a possible memory and it has not been approved or rejected yet.",
        source: "Memory",
        timestamp: itemTime(candidate.createdAt ?? candidate.created_at),
        score: 90,
        state: "unread" as const,
        actions: [
          { id: "approve", label: "Approve", kind: "primary" as const },
          { id: "reject", label: "Reject", kind: "danger" as const },
          { id: "defer", label: "Later", kind: "secondary" as const },
        ],
        tags: ["Memory", "Needs review"],
      })),
      ...memories.map((memory: Record<string, unknown>) => ({
        id: `memory:${String(memory.id)}`,
        type: "research" as const,
        title: String(memory.title ?? "Remembered context"),
        summary: String(memory.content ?? memory.text ?? "Approved memory"),
        reason: "Surfaced from Jhadina's approved memory so relevant context is available without opening a separate dashboard.",
        source: "Memory",
        timestamp: itemTime(memory.createdAt ?? memory.created_at),
        score: 55,
        state: "unread" as const,
        actions: [
          { id: "open", label: "Open", kind: "primary" as const },
          { id: "save", label: "Save", kind: "secondary" as const },
        ],
        tags: ["Memory"],
      })),
    ]

    items.sort((a, b) => b.score - a.score)
    return NextResponse.json({ success: true, data: { items, count: items.length } })
  } catch (error) {
    console.error("Error building feed:", error)
    return NextResponse.json({ error: "Feed unavailable" }, { status: 500 })
  }
}

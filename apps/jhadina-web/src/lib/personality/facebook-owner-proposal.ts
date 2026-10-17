import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "@/lib/repositories/ReasoningEventRepository"
import type { MemoryStorage } from "@/lib/storage/MemoryStorage"
import { redactSecrets } from "@/lib/context/redact"
import { OWNER_FACEBOOK_NOTE_PREFIX } from "./facebook-owner-profile-context"
import { validateOwnerWritingSignalIds, type OwnerWritingSignalId } from "./facebook-owner-signals"

export type ReviewedOwnerWritingNote = Readonly<{
  content: string
  reviewed: true
  sourceCount: number
  signalIds: readonly OwnerWritingSignalId[]
}>
export type FacebookOwnerProposalResult = Readonly<{
  candidateId?: string
  status: "PENDING" | "ALREADY_PENDING" | "ALREADY_APPROVED"
  memoryId?: string
}>

/**
 * Never trust the client-side file parser as a security boundary. The server
 * accepts only a short owner-reviewed summary; no raw posts, archives or media.
 */
export function parseReviewedOwnerNote(input: unknown): ReviewedOwnerWritingNote {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_REVIEW")
  const payload = input as Record<string, unknown>
  const allowedFields = new Set(["content", "reviewed", "sourceCount", "signalIds"])
  if (Object.keys(payload).some((key) => !allowedFields.has(key))) throw new Error("UNEXPECTED_IMPORT_FIELD")
  const content = typeof payload.content === "string" ? payload.content.trim() : ""
  const sourceCount = payload.sourceCount
  if (payload.reviewed !== true || content.length < 30 || content.length > 900 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content) ||
    typeof sourceCount !== "number" || !Number.isSafeInteger(sourceCount) ||
    sourceCount < 1 || sourceCount > 2500) throw new Error("INVALID_REVIEW")
  const signalIds = validateOwnerWritingSignalIds(payload.signalIds ?? [])
  const safeText = redactSecrets(content)
  if (safeText.redactionCount > 0) throw new Error("SECRETS_NOT_ALLOWED_IN_OWNER_NOTE")
  return { content, reviewed: true, sourceCount, signalIds }
}

/**
 * Reuses existing canonical Memory, ReasoningEvent and approval semantics.
 * Never mutates the global Jhadina PersonalityState or approval permissions.
 * Duplicate check is best-effort; needs a transactional unique key for
 * concurrent retries before any high-volume production ingestion.
 */
export async function proposeReviewedFacebookOwnerNote(
  store: MemoryStorage,
  userId: string,
  input: ReviewedOwnerWritingNote,
): Promise<FacebookOwnerProposalResult> {
  if (!userId.trim()) throw new Error("AUTHENTICATED_OWNER_REQUIRED")
  if (store.probe) await store.probe()
  else if (process.env.NODE_ENV === "production") throw new Error("DURABLE_MEMORY_REQUIRED")

  const content = PREFIX + input.content
  const existingPending = (await store.listCandidates(userId, "PENDING"))
    .find((candidate) => candidate.type === "CONTEXT" && candidate.content === content)
  if (existingPending) return { status: "ALREADY_PENDING", candidateId: existingPending.id }

  const existingApproved = (await store.listMemories(userId))
    .find((memory) => memory.status === "APPROVED" && memory.type === "CONTEXT" && memory.content === content)
  if (existingApproved) return { status: "ALREADY_APPROVED", memoryId: existingApproved.id }

  const now = new Date().toISOString()
  const reasoning = await new ReasoningEventRepository(store).create({
    userId, userMessage: content,
    observation: { raw: content, extracted: content, timestamp: now },
    classification: { type: "CONTEXT", confidence: 0.5, reasoning: "Owner-reviewed social writing, not independently verified" },
    systemResponse: "Facebook owner-writing note proposed for memory approval.",
    confidence: 0.5, actor: "user", outcome: "memory:proposed",
    metadata: {
      kind: "owner-facebook-writing-review",
      source: "facebook-owner-export",
      ownerReportedSourceCount: input.sourceCount,
      ownerSelectedSignalIds: [...input.signalIds],
      status: "pending-approval",
      rawArchiveReceived: false,
      canModifyPersonalityState: false,
    },
  })
  const candidate = await new MemoryRepository(store).createCandidate({
    userId, content, type: "CONTEXT", confidence: 0.5, reasoningEventId: reasoning.id,
  })
  return { candidateId: candidate.id, status: "PENDING" }
}

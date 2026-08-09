import type { GrowthBrand, GrowthDraft, GrowthIdea, GrowthPlatform, ContentKind } from "./types"

const drafts = new Map<string, GrowthDraft>()
const ideas = new Map<string, GrowthIdea>()
let draftCounter = 0
let ideaCounter = 0

export function createGrowthIdea(input: Omit<GrowthIdea, "id" | "createdAt">): GrowthIdea {
  const idea: GrowthIdea = {
    ...input,
    id: `idea_${++ideaCounter}`,
    createdAt: new Date().toISOString(),
  }
  ideas.set(idea.id, idea)
  return idea
}

export function listGrowthIdeas(userId: string): GrowthIdea[] {
  return Array.from(ideas.values())
    .filter((idea) => idea.userId === userId)
    .sort((a, b) => b.score - a.score)
}

export function createGrowthDraft(input: {
  userId: string
  brand: GrowthBrand
  platforms: GrowthPlatform[]
  kind: ContentKind
  title?: string
  body: string
  mediaIds?: string[]
  sourceAssetId?: string
  rationale: string
  suggestedPublishAt?: string
  seo?: GrowthDraft["seo"]
}): GrowthDraft {
  const draft: GrowthDraft = {
    ...input,
    id: `growth_${++draftCounter}`,
    mediaIds: input.mediaIds ?? [],
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  }
  drafts.set(draft.id, draft)
  return draft
}

export function getGrowthDraft(userId: string, draftId: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  return draft && draft.userId === userId ? draft : null
}

export function redraftGrowthDraft(userId: string, draftId: string, instruction: string): GrowthDraft | null {
  const draft = getGrowthDraft(userId, draftId)
  if (!draft) return null

  const lower = instruction.toLowerCase()
  let body = draft.body
  if (lower.includes("less robotic") || lower.includes("more human") || lower.includes("more like me")) {
    body = body.replace(/\b(leverage|utilize|synergy|delve|robust|seamless)\b/gi, (word) => ({ leverage: "use", utilize: "use", synergy: "fit", delve: "dig", robust: "strong", seamless: "easy" }[word.toLowerCase()] || word))
      .replace(/\s+/g, " ").trim()
  }
  if (lower.includes("shorten") || lower.includes("shorter")) {
    const sentences = body.split(/(?<=[.!?])\s+/)
    body = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ")
  }
  if (lower.includes("exciting") || lower.includes("more energy")) {
    body = body.replace(/\.$/, "!")
  }

  const redraft: GrowthDraft = {
    ...draft,
    id: `growth_${++draftCounter}`,
    body,
    status: "PENDING_APPROVAL",
    rationale: `Redraft of ${draft.id}: ${instruction}`,
    createdAt: new Date().toISOString(),
  }
  drafts.set(redraft.id, redraft)
  return redraft
}

export function listGrowthDrafts(userId: string): GrowthDraft[] {
  return Array.from(drafts.values())
    .filter((draft) => draft.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function approveGrowthDraft(userId: string, draftId: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "PENDING_APPROVAL") return null
  const approved: GrowthDraft = { ...draft, status: "APPROVED", approvedAt: new Date().toISOString() }
  drafts.set(draftId, approved)
  return approved
}

export function rejectGrowthDraft(userId: string, draftId: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "PENDING_APPROVAL") return null
  const rejected: GrowthDraft = { ...draft, status: "REJECTED" }
  drafts.set(draftId, rejected)
  return rejected
}

export function scheduleGrowthDraft(userId: string, draftId: string, scheduledAt: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "APPROVED") return null
  const scheduled: GrowthDraft = { ...draft, status: "SCHEDULED", scheduledAt }
  drafts.set(draftId, scheduled)
  return scheduled
}

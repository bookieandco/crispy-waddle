import type { ContentKind, GrowthBrand, GrowthDraft, GrowthIdea, GrowthPlatform } from "./types"

const drafts = new Map<string, GrowthDraft>()
const ideas = new Map<string, GrowthIdea>()
let draftCounter = 0
let ideaCounter = 0

export function createGrowthIdea(input: Omit<GrowthIdea, "id" | "createdAt">): GrowthIdea {
  const idea = { ...input, id: `idea_${++ideaCounter}`, createdAt: new Date().toISOString() }
  ideas.set(idea.id, idea)
  return idea
}

export function listGrowthIdeas(userId: string): GrowthIdea[] {
  return Array.from(ideas.values()).filter((idea) => idea.userId === userId).sort((a, b) => b.score - a.score)
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
  parentDraftId?: string
  redraftInstruction?: string
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

export function listGrowthDrafts(userId: string): GrowthDraft[] {
  return Array.from(drafts.values()).filter((draft) => draft.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function approveGrowthDraft(userId: string, draftId: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "PENDING_APPROVAL") return null
  const approved = { ...draft, status: "APPROVED" as const, approvedAt: new Date().toISOString() }
  drafts.set(draftId, approved)
  return approved
}

export function rejectGrowthDraft(userId: string, draftId: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "PENDING_APPROVAL") return null
  const rejected = { ...draft, status: "REJECTED" as const }
  drafts.set(draftId, rejected)
  return rejected
}

export function scheduleGrowthDraft(userId: string, draftId: string, scheduledAt: string): GrowthDraft | null {
  const draft = drafts.get(draftId)
  if (!draft || draft.userId !== userId || draft.status !== "APPROVED") return null
  const scheduled = { ...draft, status: "SCHEDULED" as const, scheduledAt }
  drafts.set(draftId, scheduled)
  return scheduled
}

export function redraftGrowthDraft(userId: string, draftId: string, instruction: string): GrowthDraft | null {
  const source = drafts.get(draftId)
  const clean = instruction.trim()
  if (!source || source.userId !== userId || !clean) return null

  const redrafted = createGrowthDraft({
    userId,
    brand: source.brand,
    platforms: [...source.platforms],
    kind: source.kind,
    title: source.title,
    body: source.body,
    mediaIds: [...source.mediaIds],
    sourceAssetId: source.sourceAssetId,
    rationale: `Redraft requested: ${clean}`,
    suggestedPublishAt: source.suggestedPublishAt,
    seo: source.seo,
    parentDraftId: source.id,
    redraftInstruction: clean,
  })
  return redrafted
}

import type { WritingSample } from "./facebook-owner-import"
import { deriveOwnerWritingSignals, type OwnerWritingSignalId } from "./facebook-owner-signals"

/**
 * FB-RELATE.APPROVAL.05–.08: local, untrusted drafts ONLY.
 * Never stores writing, exports raw examples, or confuses an owner's chosen
 * cue with a verified trait or a durable Memory approval.
 */
export type FacebookReviewDecision = "undecided" | "selected" | "rejected"
export type FacebookReviewCandidate = Readonly<{
  id: OwnerWritingSignalId
  label: string
  proposedNote: string
  sampledCount: number
  sampledDenominator: number
  decision: FacebookReviewDecision
}>
export type FacebookReviewItem = Readonly<{
  id: OwnerWritingSignalId
  label: string
  note: string
  decision: FacebookReviewDecision
}>
const SIGNAL_COPY: Record<OwnerWritingSignalId, string> = {
  questions: "My Facebook writing sample sometimes includes questions; treat this as an observation, not a permanent trait.",
  "laugh-markers": "My Facebook writing sample contains recognizable laughter markers; do not presume every instance is a joke.",
  "expressive-punctuation": "My Facebook writing sample sometimes uses emphatic punctuation; do not presume my emotional state from it.",
  emoji: "Some of my Facebook writing uses emoji; do not infer my mood or identity from emoji alone.",
  "short-entries": "Some of my Facebook posts or comments are short; this alone does not define my preferred conversation style.",
  "long-entries": "Some of my Facebook writing is long-form; this alone does not establish a permanent storytelling preference.",
}
const SIGNAL_IDS = new Set<OwnerWritingSignalId>(Object.keys(SIGNAL_COPY) as OwnerWritingSignalId[])
const DEFAULT_MAX = 6

export function buildFacebookReviewCandidates(samples: readonly WritingSample[]): FacebookReviewCandidate[] {
  return deriveOwnerWritingSignals(samples).slice(0, DEFAULT_MAX).map((cue) => ({
    id: cue.id, label: cue.label, proposedNote: SIGNAL_COPY[cue.id],
    sampledCount: cue.count, sampledDenominator: cue.denominator,
    decision: "undecided" as const,
  }))
}

/** User-edited note, not an archive excerpt. Never send before final consent. */
export function prepareFacebookReviewItem(
  input: { id: string; label: string; note: string; decision: FacebookReviewDecision },
): FacebookReviewItem | null {
  if (!SIGNAL_IDS.has(input.id as OwnerWritingSignalId) ||
      !["undecided", "selected", "rejected"].includes(input.decision)) return null
  const id = input.id as OwnerWritingSignalId
  const clean = input.note.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (clean.length < 30 || clean.length > 900) return null
  return { id, label: SIGNAL_COPY[id] ? input.label.slice(0, 70) : "", note: clean, decision: input.decision }
}

/**
 * Numeric receipt for user-confirmed review decisions. This may be copied
 * freely; never includes note text, excerpts, source paths, filenames, IDs
 * from Facebook, or individually identifying timestamps.
 */
export function formatFacebookReviewReceipt(
  items: readonly FacebookReviewItem[],
  preferenceDecision: FacebookReviewDecision,
): string {
  const seen = new Set<OwnerWritingSignalId>()
  let selected = 0, rejected = 0, undecided = 0
  for (const item of items) {
    if (!SIGNAL_IDS.has(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    if (item.decision === "selected") selected++
    else if (item.decision === "rejected") rejected++
    else undecided++
  }
  return JSON.stringify({
    schema: "FB-RELATE-LOCAL-REVIEW-v1",
    writingCuesReviewed: seen.size,
    selectedWritingCues: selected,
    rejectedWritingCues: rejected,
    undecidedWritingCues: undecided,
    interactionPreferenceDecision: ["selected", "rejected", "undecided"].includes(preferenceDecision)
      ? preferenceDecision : "undecided",
    memoryCandidatesCreated: 0,
    memoryApproved: false,
    rawFacebookWritingSent: false,
    note: "Local review only. Selection is not consent to save or activate Memory.",
  }, null, 2)
}

/** A selected review note never silently becomes a communication instruction. */
export function eligibleFacebookReviewNotes(items: readonly FacebookReviewItem[]): string[] {
  return items.filter((item) => item.decision === "selected")
    .map((item) => prepareFacebookReviewItem(item))
    .filter((item): item is FacebookReviewItem => item !== null)
    .map((item) => item.note)
}

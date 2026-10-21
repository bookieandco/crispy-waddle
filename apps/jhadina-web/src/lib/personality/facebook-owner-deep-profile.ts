import type { DeepWritingSignal, DeepWritingSignalId } from "./facebook-owner-deep-signals"

/**
 * FB-RELATE.DEEP.06: explicitly owner-selected local-only descriptions.
 * Not a trait, an instruction, a preference, or a Memory proposal by itself.
 * No FB excerpts, names, word lists or historical phrases are accepted.
 */
export type DeepReviewDecision = "undecided" | "selected" | "rejected"
export type DeepReviewItem = Readonly<{
  id: DeepWritingSignalId
  decision: DeepReviewDecision
}>

const ALLOWED_IDS: readonly DeepWritingSignalId[] = [
  "direct-address", "rhetorical-form", "casual-diction",
  "narrative-sequence", "dialogue-framing", "self-marked-humor",
  "possible-ironic-contrast", "exaggeration-terms", "contrast-turn",
]

// Short, fixed descriptions only; no automatic inferences about the owner.
const FIXED_NOTE: Record<DeepWritingSignalId, string> = {
  "direct-address": "Direct-address words appeared in sampled writing.",
  "rhetorical-form": "A few recognizable rhetorical question forms appeared.",
  "casual-diction": "Some informal conversational word forms appeared.",
  "narrative-sequence": "Some passages contained several narrative sequence markers.",
  "dialogue-framing": "Some passages used reported speech or quotation framing.",
  "self-marked-humor": "Some entries contained explicit laughter or joke markers.",
  "possible-ironic-contrast": "Some phrases resembled common irony markers, without confirming sarcasm.",
  "exaggeration-terms": "Some entries contained recognizable exaggeration-style expressions.",
  "contrast-turn": "Some entries contained contrast or reversal transitions.",
}

export function makeDeepReviewItems(signals: readonly DeepWritingSignal[]): DeepReviewItem[] {
  const visible = new Set(signals.map((signal) => signal.id))
  return ALLOWED_IDS.filter((id) => visible.has(id)).map((id) => ({ id, decision: "undecided" as const }))
}

export function updateDeepReviewDecision(
  items: readonly DeepReviewItem[], id: DeepWritingSignalId, decision: DeepReviewDecision,
): DeepReviewItem[] {
  if (!ALLOWED_IDS.includes(id) || !["undecided", "selected", "rejected"].includes(decision)) return [...items]
  return items.map((item) => item.id === id ? { ...item, decision } : item)
}

/**
 * A button click must explicitly request draft preparation. This function
 * does not save, propose, approve, or write any Memory.
 */
export function buildDeepProfileDraft(
  items: readonly DeepReviewItem[], signals: readonly DeepWritingSignal[],
): string {
  const valid = new Map(signals.filter((signal) =>
    ALLOWED_IDS.includes(signal.id) && signal.count >= 3 &&
    signal.denominator >= 10 && signal.reliability === "surface-pattern-only"
  ).map((signal) => [signal.id, signal]))
  const seen = new Set<DeepWritingSignalId>()
  const fragments: string[] = []
  for (const item of items) {
    if (item.decision !== "selected" || seen.has(item.id) || !valid.has(item.id)) continue
    seen.add(item.id)
    const s = valid.get(item.id)!
    fragments.push(FIXED_NOTE[item.id] + " (" + s.count + "/" + s.denominator + " sampled entries.)")
  }
  if (!fragments.length) return ""
  const beginning = "Owner-selected provisional observations from a bounded Facebook writing sample: "
  const ending = " These are not fixed traits, confirmed humor, or instructions to Jhadina."
  let body = ""
  for (const sentence of fragments) {
    if ((beginning + body + (body ? " " : "") + sentence + ending).length > 900) break
    body += (body ? " " : "") + sentence
  }
  return body ? beginning + body + ending : ""
}

/** Receipt is numeric only. No raw notes or private entry-derived strings. */
export function deepReviewReceipt(items: readonly DeepReviewItem[]): string {
  const seen = new Set<DeepWritingSignalId>()
  const totals = { selected: 0, rejected: 0, undecided: 0 }
  for (const item of items) {
    if (!ALLOWED_IDS.includes(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    totals[item.decision]++
  }
  return JSON.stringify({
    schema: "FB-RELATE-DEEP-LOCAL-REVIEW-v1",
    reviewedIndicators: seen.size, ...totals, savedMemories: 0, serverWrites: 0,
    approved: false, note: "Local owner choices only, no raw Facebook text.",
  }, null, 2)
}

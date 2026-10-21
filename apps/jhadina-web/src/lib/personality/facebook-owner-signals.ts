import type { WritingSample } from "./facebook-owner-import"

/**
 * A privacy-preserving, owner-reviewed *writing observation* layer.
 *
 * This module neither infers protected attributes nor claims to detect a
 * psychological personality. Examples remain local and untrusted. No output
 * is an independently verified PatternObservation/PersonalityState.
 */
export type OwnerWritingSignalId =
  | "questions" | "laugh-markers" | "expressive-punctuation" | "emoji"
  | "short-entries" | "long-entries"

export type OwnerWritingSignal = Readonly<{
  id: OwnerWritingSignalId
  label: string
  explanation: string
  count: number
  denominator: number
  percent: number
  confidence: "limited" | "moderate"
  /** Indexes are preview-only and must not be transmitted as evidence. */
  exampleIndexes: readonly number[]
}>

const SIGNALS: readonly {
  id: OwnerWritingSignalId
  label: string
  explanation: string
  match: (text: string, words: number) => boolean
}[] = [
  {
    id: "questions", label: "Question-led phrasing",
    explanation: "Question marks occur in your own writing; these may be genuine or rhetorical questions.",
    match: (text) => text.includes("?"),
  },
  {
    id: "laugh-markers", label: "Written laughter cues",
    explanation: "Recognizable laughter cues appear in some entries; they do not prove that a passage is a joke.",
    match: (text) => /(?:\b(?:lol|lmao|lmfao|haha(?:ha)*|hehe(?:he)*)\b|[😂🤣])/iu.test(text),
  },
  {
    id: "expressive-punctuation", label: "Emphatic punctuation",
    explanation: "Exclamation marks or repeated question marks occur in some entries.",
    match: (text) => /!|\?{2,}/u.test(text),
  },
  {
    id: "emoji", label: "Emoji in writing",
    explanation: "Pictographic emoji occur in some entries; usage alone does not establish tone.",
    match: (text) => /\p{Extended_Pictographic}/u.test(text),
  },
  {
    id: "short-entries", label: "Brief responses",
    explanation: "Some entries are 12 words or fewer; the sample may overrepresent short comments.",
    match: (_text, words) => words <= 12,
  },
  {
    id: "long-entries", label: "Long-form responses",
    explanation: "Some entries have 80 words or more; length alone does not establish storytelling style.",
    match: (_text, words) => words >= 80,
  },
]

export function deriveOwnerWritingSignals(samples: readonly WritingSample[]): OwnerWritingSignal[] {
  // Observations need a minimum denominator. No stable trait inference follows.
  if (samples.length < 10) return []
  return SIGNALS.map((signal) => {
    const indexes: number[] = []
    samples.forEach((sample, index) => {
      const text = sample.text.slice(0, 2000)
      const words = text.trim().split(/\s+/u).filter(Boolean).length
      if (signal.match(text, words)) indexes.push(index)
    })
    const count = indexes.length
    return {
      id: signal.id,
      label: signal.label,
      explanation: signal.explanation,
      count,
      denominator: samples.length,
      percent: Math.round(100 * count / samples.length),
      confidence: samples.length >= 50 ? "moderate" as const : "limited" as const,
      exampleIndexes: indexes.slice(0, 3),
    }
  }).filter((signal) => signal.count >= 3)
}

/**
 * Output is an owner-facing editable draft, not an instruction to Jhadina.
 * No individual posts or third-party personal details cross the server.
 */
export function buildOwnerWritingProfileDraft(
  samples: readonly WritingSample[],
  signals: readonly OwnerWritingSignal[] = deriveOwnerWritingSignals(samples),
): string {
  if (samples.length === 0) return ""
  const posts = samples.filter((item) => item.kind === "post").length
  const comments = samples.length - posts
  const distinctDates = new Set(samples.map((item) => item.at?.slice(0, 10)).filter(Boolean)).size
  const coverage = distinctDates
    ? " across " + distinctDates + " dated day(s)"
    : " (no verified dates)"
  const notes = signals.filter((s) => s.count > 0)
    .slice(0, 4)
    .map((s) => s.label.toLowerCase() + " (" + s.count + "/" + s.denominator + ")")
  return [
    "Owner-reviewed observation from " + samples.length + " Facebook writing excerpts (" +
      posts + " posts; " + comments + " comments)" + coverage + ".",
    notes.length ? "Observable writing cues: " + notes.join("; ") + "." :
      "Not enough recurring writing cues to characterize the sample.",
    "These are provisional observations about my writing, not stable personality traits, sensitive attributes, or permission to imitate me.",
  ].join(" ").slice(0, 900)
}

/**
 * An individual signal can be confirmed, corrected, or omitted by the owner.
 * This payload never claims eligibility for Personality Core.
 */
export function selectedOwnerWritingNote(
  samples: readonly WritingSample[],
  selected: readonly OwnerWritingSignalId[],
): string {
  const chosen = new Set(selected)
  return buildOwnerWritingProfileDraft(samples, deriveOwnerWritingSignals(samples).filter((signal) => chosen.has(signal.id)))
}

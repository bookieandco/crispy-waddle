import type { WritingSample } from "./facebook-owner-import"

/**
 * Private in-browser observations about the OWNER'S writing, never about
 * Jhadina's identity, ethics, policy, permissions, or durable PersonalityState.
 * No protected attributes, named people, topics, or raw excerpts are inferred.
 */
export const OWNER_WRITING_SIGNALS = [
  "question-led",
  "narrative-setup",
  "playful-contrast",
  "expressive-emphasis",
  "brief-punchlines",
] as const
export type OwnerWritingSignalId = (typeof OWNER_WRITING_SIGNALS)[number]
export type OwnerWritingSignal = Readonly<{
  id: OwnerWritingSignalId
  title: string
  observation: string
  matches: number
  examined: number
  exampleIndices: readonly number[] // browser-only; NEVER transmit
  confidence: number // heuristic coverage, not a psychological score
}>

const descriptions: Record<OwnerWritingSignalId, { title: string; observation: string }> = {
  "question-led": {
    title: "Question-driven conversation",
    observation: "Some of my Facebook writing opens up discussion through direct questions.",
  },
  "narrative-setup": {
    title: "Storytelling setup",
    observation: "Some of my writing sets up an event and follows it with a turn or consequence.",
  },
  "playful-contrast": {
    title: "Contrast and comic reversal",
    observation: "Some entries use contrast or reversals that may be part of my humor.",
  },
  "expressive-emphasis": {
    title: "Expressive punctuation",
    observation: "Some of my writing uses punctuation or emoji for rhythm and emphasis.",
  },
  "brief-punchlines": {
    title: "Concise phrasing",
    observation: "Some of my writing is brief and gets to the point quickly.",
  },
}

const detectors: Record<OwnerWritingSignalId, (text: string) => boolean> = {
  "question-led": (text) => text.includes("?"),
  "narrative-setup": (text) => /\b(when|then|after|before|one day|that time|next thing|turns out)\b/i.test(text),
  "playful-contrast": (text) => /\b(but|except|plot twist|meanwhile|actually|instead|turns out)\b/i.test(text),
  "expressive-emphasis": (text) => /[!?…]|\p{Extended_Pictographic}/u.test(text),
  "brief-punchlines": (text) => text.trim().split(/\s+/).length <= 12,
}

export function suggestOwnerWritingSignals(samples: readonly WritingSample[]): OwnerWritingSignal[] {
  // A single status or quote must never be promoted to an owner-level pattern.
  if (samples.length < 8) return []
  return OWNER_WRITING_SIGNALS.flatMap((id) => {
    const matching: number[] = []
    for (let index = 0; index < samples.length; index++) {
      if (detectors[id](samples[index].text)) matching.push(index)
    }
    if (matching.length < 3 || matching.length / samples.length < 0.18) return []
    const { title, observation } = descriptions[id]
    const confidence = Math.min(0.65, Number((matching.length / samples.length).toFixed(2)))
    return [{ id, title, observation, matches: matching.length, examined: samples.length,
      exampleIndices: matching.slice(0, 3), confidence }]
  })
}

/** Owner can opt into individual observations or remove any of them. */
export function formatOwnerWritingReview(
  allSamples: readonly WritingSample[],
  signals: readonly OwnerWritingSignal[],
  chosen: readonly OwnerWritingSignalId[],
): string {
  const selected = signals.filter((signal) => chosen.includes(signal.id))
  const summary = [
    "Owner-reviewed Facebook writing observations from " + allSamples.length + " locally inspected samples (not verified traits):",
    ...selected.map((signal) => signal.observation + " (" + signal.matches + "/" + signal.examined + " samples observed.)"),
    "Jhadina should treat this as tentative information about MY communication, not as Jhadina's own personality, a cultural stereotype, or a permission grant.",
  ].join(" ")
  return summary.slice(0, 900)
}

export function validateOwnerWritingSignalIds(value: unknown): OwnerWritingSignalId[] {
  if (!Array.isArray(value) || value.length > OWNER_WRITING_SIGNALS.length) {
    throw new Error("INVALID_OWNER_WRITING_SIGNALS")
  }
  const seen = new Set<OwnerWritingSignalId>()
  for (const id of value) {
    if (typeof id !== "string" || !OWNER_WRITING_SIGNALS.includes(id as OwnerWritingSignalId) || seen.has(id as OwnerWritingSignalId)) {
      throw new Error("INVALID_OWNER_WRITING_SIGNALS")
    }
    seen.add(id as OwnerWritingSignalId)
  }
  return [...seen]
}

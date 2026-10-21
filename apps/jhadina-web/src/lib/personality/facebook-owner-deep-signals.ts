import type { WritingSample } from "./facebook-owner-import"

/**
 * FB-RELATE.DEEP.03-.04. Local-only, fixed-language indicators of writing form.
 * NOT humor/sarcasm detection, identity profiling, or owner-approved Memory.
 * This module processes the same bounded sample; no post text, excerpts,
 * account IDs, source paths, or fingerprints are included in its output.
 */
export type DeepWritingSignalId =
  | "direct-address" | "rhetorical-form" | "casual-diction"
  | "narrative-sequence" | "dialogue-framing"
  | "self-marked-humor" | "possible-ironic-contrast"
  | "exaggeration-terms" | "contrast-turn"

export type DeepWritingSignal = Readonly<{
  id: DeepWritingSignalId
  label: string
  explanation: string
  count: number
  denominator: number
  posts: number
  comments: number
  percent: number
  reliability: "surface-pattern-only"
}>

type Rule = Readonly<{
  id: DeepWritingSignalId
  label: string
  explanation: string
  matches: (text: string, words: number) => boolean
}>

const RULES: readonly Rule[] = [
  {
    id: "direct-address", label: "Direct conversational address",
    explanation: "Second-person wording appears; its target and tone are unknown.",
    matches: (text) => /\b(?:you|your|you're|you've|y'all|ya'll)\b/iu.test(text),
  },
  {
    id: "rhetorical-form", label: "Rhetorical-form questions",
    explanation: "Some questions use familiar rhetorical forms; intent cannot be established from punctuation.",
    matches: (text) => /\?/.test(text) && /\b(?:who (?:even|really)|you (?:really|seriously) think|isn['’]t (?:that|it)|ain['’]t (?:that|it)|what (?:could|do) you expect|what could go wrong)\b/iu.test(text),
  },
  {
    id: "casual-diction", label: "Informal conversational spelling",
    explanation: "A small, language-dependent set of informal word forms appears. These do not indicate background or identity.",
    matches: (text) => /\b(?:ain['’]t|gonna|wanna|gotta|finna|tryna|lemme|y['’]?all|nah)\b/iu.test(text),
  },
  {
    id: "narrative-sequence", label: "Sequenced storytelling wording",
    explanation: "Two or more sequence markers occur together; this may be a story or ordinary explanation.",
    matches: (text, words) => words >= 15 &&
      (text.match(/\b(?:first|then|afterwards?|later|eventually|next thing|one day|back then|finally)\b/giu) ?? []).length >= 2,
  },
  {
    id: "dialogue-framing", label: "Dialogue or quoted-speech framing",
    explanation: "Quoted text or reported speech occurs; a quotation may belong to someone else.",
    matches: (text) => /(?:["“][^"”]{4,100}["”]|\b(?:i|he|she|they|we)\s+(?:said|asked|told)\b)/iu.test(text),
  },
  {
    id: "self-marked-humor", label: "Explicit humor or laughter markers",
    explanation: "Writing contains explicit joking or laughter words; this does not prove a joke landed.",
    matches: (text) => /\b(?:lol|lmao|lmfao|haha(?:ha)*|hehe(?:he)*|jk|just kidding|i['’]m joking|plot twist)\b|[😂🤣]/iu.test(text),
  },
  {
    id: "possible-ironic-contrast", label: "Possible ironic-contrast wording",
    explanation: "A limited set of familiar irony expressions occurs; sarcasm cannot be reliably determined without context.",
    matches: (text) => /\b(?:yeah right|as if|oh great|what could go wrong|sure jan)\b|(?:^|\s)\/s(?:\s|$)/iu.test(text),
  },
  {
    id: "exaggeration-terms", label: "Exaggeration-form wording",
    explanation: "Potentially emphatic terms occur; they may be literal and are not evidence of comedic intent.",
    matches: (text) => /\b(?:a million times|never ever|every single time|forever and ever|literally everyone|literally nobody)\b/iu.test(text),
  },
  {
    id: "contrast-turn", label: "Contrast and reversal phrasing",
    explanation: "Contrast transitions appear in longer entries. A transition alone does not establish a punchline.",
    matches: (text, words) => words >= 10 && /\b(?:but|except|until|turns out|plot twist)\b/iu.test(text),
  },
]

/**
 * Aggregates only fixed rule IDs and numeric counts. No user-derived lexicon,
 * excerpts, dates, word lists, embedding, or identity attributes are returned.
 * Not used by candidate approval or server-backed persistence pathways.
 */
export function deriveOwnerDeepWritingSignals(samples: readonly WritingSample[]): DeepWritingSignal[] {
  if (samples.length < 10) return []
  const bounded = samples.slice(0, 2500)
  return RULES.map((rule): DeepWritingSignal => {
    let posts = 0
    let comments = 0
    for (const sample of bounded) {
      const text = sample.text.slice(0, 2000)
      const words = text.trim().split(/\s+/u).filter(Boolean).length
      if (!rule.matches(text, words)) continue
      if (sample.kind === "post") posts++
      else comments++
    }
    const count = posts + comments
    return {
      id: rule.id, label: rule.label, explanation: rule.explanation,
      count, denominator: bounded.length, posts, comments,
      percent: Math.round((count * 100) / bounded.length),
      reliability: "surface-pattern-only" as const,
    }
  }).filter((item) => item.count >= 3)
}

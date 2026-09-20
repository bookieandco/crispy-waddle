import {
  projectBayesianPattern,
  type EvidenceRef,
  type Experience,
  type HippocampalEpisode,
  type PatternObservation,
} from "@jhadina/core-spine"

type Polarity = "support" | "contradict" | "ambiguous" | "none"

const NEGATORS = new Set(["not", "never", "no", "avoid", "avoids", "avoided", "avoiding", "without", "less"])
const MODIFIERS = new Set(["very", "really", "too", "so", "especially"])

function tokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []
}

function uniqueTerms(value: string): string[] {
  return [...new Set(tokens(value))]
}

function classify(value: string, term: string): Polarity {
  const all = tokens(value)
  let support = false
  let contradict = false

  for (let i = 0; i < all.length; i += 1) {
    if (all[i] !== term) continue
    const previous = all[i - 1]
    const twoBack = all[i - 2]
    const negated =
      (previous !== undefined && NEGATORS.has(previous)) ||
      (previous !== undefined && twoBack !== undefined && MODIFIERS.has(previous) && NEGATORS.has(twoBack))
    if (negated) contradict = true
    else support = true
  }

  if (support && contradict) return "ambiguous"
  if (support) return "support"
  if (contradict) return "contradict"
  return "none"
}

function experienceSignal(experience: Experience): string {
  return [experience.domain ?? "", experience.outcome ?? "", experience.content].join(" ")
}

function episodeSignal(episode: HippocampalEpisode): string {
  return [episode.domain ?? "", episode.outcome ?? "", episode.content].join(" ")
}

function matchingEvidence(
  refs: readonly EvidenceRef[],
  term: string,
  polarity: "support" | "contradict",
): EvidenceRef[] {
  const seen = new Set<string>()
  return refs
    .filter((ref) => classify(ref.summary, term) === polarity)
    .filter((ref) => {
      if (seen.has(ref.id)) return false
      seen.add(ref.id)
      return true
    })
    .map((ref) => ({ ...ref }))
}

function directExperienceEvidence(experience: Experience): EvidenceRef {
  return {
    id: experience.id,
    source: experience.source,
    observedAt: experience.occurredAt,
    summary: experienceSignal(experience).trim(),
    immutable: experience.evidence.some((ref) => ref.immutable === true),
  }
}

function directEpisodeEvidence(episode: HippocampalEpisode): EvidenceRef {
  return {
    id: episode.episodeId,
    source: episode.source,
    observedAt: episode.occurredAt,
    summary: episodeSignal(episode).trim(),
    immutable: true,
  }
}

interface Observation {
  support: 0 | 1
  evidence: EvidenceRef[]
}

function currentObservation(experience: Experience, term: string): Observation | undefined {
  const polarity = classify(experienceSignal(experience), term)
  if (polarity === "none" || polarity === "ambiguous") return undefined
  const wanted = polarity === "support" ? "support" : "contradict"
  const evidence = matchingEvidence(experience.evidence, term, wanted)
  return {
    support: polarity === "support" ? 1 : 0,
    evidence: evidence.length > 0 ? evidence : [directExperienceEvidence(experience)],
  }
}

function episodeObservation(episode: HippocampalEpisode, term: string): Observation | undefined {
  const polarity = classify(episodeSignal(episode), term)
  if (polarity === "none" || polarity === "ambiguous") return undefined
  const wanted = polarity === "support" ? "support" : "contradict"
  const evidence = matchingEvidence(episode.evidence, term, wanted)
  return {
    support: polarity === "support" ? 1 : 0,
    evidence: evidence.length > 0 ? evidence : [directEpisodeEvidence(episode)],
  }
}

function independent(observations: Observation[]): Observation[] {
  const used = new Set<string>()
  const result: Observation[] = []
  for (const observation of observations) {
    const novel = observation.evidence.filter((ref) => !used.has(ref.id))
    if (novel.length === 0) continue
    novel.forEach((ref) => used.add(ref.id))
    result.push({ support: observation.support, evidence: novel })
  }
  return result
}

/**
 * Adapter-level episodic Pattern detector.
 *
 * Historical Hippocampal episodes remain episodes; they are never converted to
 * approved MemoryProposal records. Output ids are intentionally distinct from
 * memory-backed recurrence hypotheses so the two evidence classes cannot be
 * silently conflated or double-counted.
 */
export class HippocampalEpisodePatternAdapter {
  detect(experience: Experience, episodes: readonly HippocampalEpisode[]): PatternObservation[] {
    const historical = episodes.filter((episode) => episode.episodeId !== experience.id)
    const historicalTerms = new Set(historical.flatMap((episode) => uniqueTerms(episodeSignal(episode))))
    const candidateTerms = uniqueTerms(experienceSignal(experience)).filter((term) => historicalTerms.has(term))
    const patterns: PatternObservation[] = []

    for (const term of candidateTerms) {
      const current = currentObservation(experience, term)
      if (!current) continue
      const observations = independent([
        current,
        ...historical
          .map((episode) => episodeObservation(episode, term))
          .filter((item): item is Observation => item !== undefined),
      ])
      if (observations.length < 2) continue

      const evidence = observations.filter((item) => item.support === 1).flatMap((item) => item.evidence)
      const contradictions = observations.filter((item) => item.support === 0).flatMap((item) => item.evidence)
      const raw: PatternObservation = {
        id: `episodic-recurrence:${term}`,
        pattern: `episodic recurring term: ${term}`,
        evidence,
        contradictions,
        occurrences: observations.length,
        confidence: 0.5,
        lastObservedAt: experience.occurredAt,
        personalityEligible: false,
        personalityDimension: undefined,
      }
      patterns.push(projectBayesianPattern(raw, observations.map((item) => ({ support: item.support, weight: 1 }))))
    }

    return patterns.sort((a, b) => a.id.localeCompare(b.id))
  }
}

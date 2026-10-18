import type { IntelligenceDomain } from "./source-registry"

export type TopicProfile = {
  domain: IntelligenceDomain
  topics: string[]
  entities: string[]
  keywords: string[]
  priority?: "low" | "normal" | "high" | "critical"
}

export type RelevantSignal = {
  domain: IntelligenceDomain
  matchedTopics: string[]
  matchedEntities: string[]
  score: number
  reasons: string[]
}

const normalize = (value: string) => value.toLowerCase().trim()

const matches = (text: string, terms: string[]) =>
  terms.filter((term) => text.includes(normalize(term)))

/**
 * Aggregate relevance only. This does not infer an individual's beliefs,
 * political affiliation, or susceptibility; it scores public content against
 * OS-declared topics/entities.
 */
export function scoreRelevance(
  text: string,
  profiles: TopicProfile[],
): RelevantSignal[] {
  const normalized = normalize(text)

  return profiles
    .map((profile) => {
      const matchedTopics = matches(normalized, profile.topics)
      const matchedEntities = matches(normalized, profile.entities)
      const matchedKeywords = matches(normalized, profile.keywords)
      const score = Math.min(
        100,
        matchedTopics.length * 25 +
          matchedEntities.length * 20 +
          matchedKeywords.length * 10,
      )

      return {
        domain: profile.domain,
        matchedTopics: [...new Set(matchedTopics)],
        matchedEntities: [...new Set(matchedEntities)],
        score,
        reasons: [
          ...matchedTopics.map((item) => `topic:${item}`),
          ...matchedEntities.map((item) => `entity:${item}`),
          ...matchedKeywords.map((item) => `keyword:${item}`),
        ],
      }
    })
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score)
}

export const DEFAULT_TOPIC_PROFILES: TopicProfile[] = [
  {
    domain: "campaign",
    topics: ["housing", "healthcare", "jobs", "inflation", "education", "infrastructure", "taxes", "public safety"],
    entities: ["candidate", "governor", "mayor", "senator", "representative"],
    keywords: ["poll", "election", "legislation", "budget", "policy"],
    priority: "high",
  },
  {
    domain: "overage",
    topics: ["tax sale", "surplus funds", "overage", "unclaimed property", "auction", "foreclosure"],
    entities: ["county", "treasurer", "tax collector", "clerk"],
    keywords: ["notice", "sale", "surplus", "claim", "parcel"],
    priority: "high",
  },
  {
    domain: "money",
    topics: ["earnings", "revenue", "inflation", "interest rates", "crypto", "bitcoin", "regulation"],
    entities: ["company", "ceo", "issuer", "exchange"],
    keywords: ["filing", "guidance", "earnings", "launch", "acquisition"],
    priority: "high",
  },
  {
    domain: "social",
    topics: ["content", "creator", "audience", "trend", "engagement"],
    entities: ["brand", "creator", "account"],
    keywords: ["viral", "views", "followers", "comments", "shares"],
    priority: "normal",
  },
]

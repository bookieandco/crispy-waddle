export type EntityType = "person" | "organization" | "company" | "politician" | "government" | "county" | "property" | "asset" | "account" | "unknown"

export type EntityCandidate = {
  id: string
  type: EntityType
  canonicalName: string
  aliases: string[]
  identifiers: string[]
  sourceId: string
  url?: string
}

export type EntityMention = {
  text: string
  sourceId: string
  externalId?: string
  url?: string
  typeHint?: EntityType
}

export type ResolvedEntity = {
  entityId: string
  confidence: number
  matchedBy: "identifier" | "exact_name" | "alias" | "url" | "unresolved"
}

const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/^@/, "").replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Resolves public-source mentions to canonical entities using explicit
 * identifiers, URLs, names and aliases. It intentionally does not infer
 * sensitive traits or political affiliation from behavior.
 */
export function resolveEntity(
  mention: EntityMention,
  candidates: EntityCandidate[],
): ResolvedEntity {
  if (mention.externalId) {
    const identifierMatch = candidates.find((candidate) =>
      candidate.identifiers.includes(mention.externalId!),
    )
    if (identifierMatch) {
      return { entityId: identifierMatch.id, confidence: 1, matchedBy: "identifier" }
    }
  }

  if (mention.url) {
    const urlMatch = candidates.find((candidate) => candidate.url === mention.url)
    if (urlMatch) {
      return { entityId: urlMatch.id, confidence: 0.98, matchedBy: "url" }
    }
  }

  const text = normalize(mention.text)
  const exact = candidates.find((candidate) => normalize(candidate.canonicalName) === text)
  if (exact) {
    return { entityId: exact.id, confidence: 0.95, matchedBy: "exact_name" }
  }

  const alias = candidates.find((candidate) => candidate.aliases.some((item) => normalize(item) === text))
  if (alias) {
    return { entityId: alias.id, confidence: 0.9, matchedBy: "alias" }
  }

  return { entityId: "unresolved", confidence: 0, matchedBy: "unresolved" }
}

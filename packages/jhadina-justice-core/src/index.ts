export type JusticeSourceKind =
  | "STATUTE"
  | "REGULATION"
  | "CASE_LAW"
  | "COURT_RULE"
  | "AGENCY_GUIDANCE"
  | "PUBLIC_RECORD"
  | "SECONDARY_SOURCE"
  | "DATASET"

export type JusticeEvidenceLevel =
  | "PRIMARY_AUTHORITY"
  | "OFFICIAL_GUIDANCE"
  | "PUBLIC_RECORD"
  | "SECONDARY_ANALYSIS"
  | "DISCOVERY_ONLY"

export type JusticeJurisdiction = {
  country?: string
  state?: string
  county?: string
  court?: string
}

export type JusticeCitation = {
  id: string
  raw: string
  normalized?: string
  sourceUrl?: string
  sourceKind: JusticeSourceKind
  jurisdiction: JusticeJurisdiction
  section?: string
  pinpoint?: string
  verified: boolean
}

export type JusticeEvidence = {
  id: string
  title: string
  sourceUrl: string
  sourceKind: JusticeSourceKind
  evidenceLevel: JusticeEvidenceLevel
  jurisdiction: JusticeJurisdiction
  publishedAt?: string
  effectiveFrom?: string
  effectiveTo?: string
  retrievedAt: string
  contentHash?: string
  citations: JusticeCitation[]
  provenance: {
    repository?: string
    commit?: string
    license?: string
    extractor?: string
  }
}

export type JusticeQuestion = {
  id: string
  userId: string
  question: string
  jurisdiction: JusticeJurisdiction
  asOf?: string
  requestedEvidenceLevels?: JusticeEvidenceLevel[]
}

export type JusticeFinding = {
  id: string
  questionId: string
  conclusion: string
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"
  evidence: JusticeEvidence[]
  citations: JusticeCitation[]
  limitations: string[]
  isLegalAdvice: false
}

export interface JusticeEvidenceProvider {
  search(question: JusticeQuestion): Promise<JusticeEvidence[]>
}

/**
 * Deterministic guardrail for the Justice Core. The model may summarize
 * evidence, but it cannot upgrade evidence authority, invent a citation, or
 * silently cross jurisdictions.
 */
export function validateJusticeFinding(finding: JusticeFinding, question: JusticeQuestion): string[] {
  const errors: string[] = []

  if (finding.isLegalAdvice !== false) errors.push("Justice findings must never be represented as legal advice")

  if (finding.evidence.length === 0) errors.push("No evidence supplied")

  for (const citation of finding.citations) {
    if (!citation.verified) errors.push(`Unverified citation: ${citation.id}`)
  }

  for (const evidence of finding.evidence) {
    if (evidence.jurisdiction.state && question.jurisdiction.state && evidence.jurisdiction.state !== question.jurisdiction.state) {
      errors.push(`Jurisdiction mismatch: ${evidence.id}`)
    }
    if (question.asOf && evidence.effectiveFrom && evidence.effectiveFrom > question.asOf) {
      errors.push(`Evidence was not effective at requested date: ${evidence.id}`)
    }
    if (question.asOf && evidence.effectiveTo && evidence.effectiveTo < question.asOf) {
      errors.push(`Evidence expired before requested date: ${evidence.id}`)
    }
  }

  return errors
}

export const JUSTICE_SOURCE_REGISTRY = {
  statedecoded: {
    repository: "statedecoded/statedecoded",
    role: "state legislation discovery and structured state-law data",
    defaultEvidenceLevel: "PRIMARY_AUTHORITY" as JusticeEvidenceLevel,
  },
  citationRegexes: {
    repository: "freelawproject/citation-regexes",
    role: "legal citation detection and normalization support",
    defaultEvidenceLevel: "DISCOVERY_ONLY" as JusticeEvidenceLevel,
  },
  statedb: {
    repository: "davidawad/statedb",
    role: "state data and jurisdiction-oriented discovery",
    defaultEvidenceLevel: "DATASET" as JusticeEvidenceLevel,
  },
  awesomeLegal: {
    repository: "ankane/awesome-legal",
    role: "legal technology resource discovery",
    defaultEvidenceLevel: "DISCOVERY_ONLY" as JusticeEvidenceLevel,
  },
  legalTextAnalytics: {
    repository: "Liquid-Legal-Institute/Legal-Text-Analytics",
    role: "legal text analytics and NLP research",
    defaultEvidenceLevel: "SECONDARY_ANALYSIS" as JusticeEvidenceLevel,
  },
  claudeLegalSkill: {
    repository: "evolsb/claude-legal-skill",
    role: "legal workflow/prompt reference",
    defaultEvidenceLevel: "SECONDARY_ANALYSIS" as JusticeEvidenceLevel,
  },
  taxCalculator: {
    repository: "PSLmodels/Tax-Calculator",
    role: "tax policy and tax-liability modeling reference",
    defaultEvidenceLevel: "SECONDARY_ANALYSIS" as JusticeEvidenceLevel,
  },
  digitalgovPra: {
    repository: "GSA/digitalgov-pra",
    role: "public-records / PRA workflow reference",
    defaultEvidenceLevel: "OFFICIAL_GUIDANCE" as JusticeEvidenceLevel,
  },
  justiaScraper: {
    repository: "nischalbasuti/justia_scraper",
    role: "discovery-only case-law/data acquisition reference",
    defaultEvidenceLevel: "DISCOVERY_ONLY" as JusticeEvidenceLevel,
  },
} as const

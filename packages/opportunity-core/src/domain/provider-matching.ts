import type { FulfillmentProvider } from './fulfillment-provider.js'
import { isFulfillmentProviderVerified } from './fulfillment-provider.js'
import type { OpportunityRequirement, OpportunityRequirementSet } from './opportunity-requirement.js'

export type RequirementMatchStatus = 'satisfied' | 'partial' | 'unresolved' | 'failed'
export type ProviderMatchDisposition = 'qualified_candidate' | 'review_required' | 'blocked'

export type RequirementProviderMatch = {
  requirementId: string
  status: RequirementMatchStatus
  score: number
  evidenceRefs: string[]
  reasons: string[]
  blockers: string[]
}

export type FulfillmentProviderMatch = {
  opportunityId: string
  providerId: string
  disposition: ProviderMatchDisposition
  score: number
  requirementCoverage: number
  capabilityEvidenceScore: number
  naicsIntelligenceScore: number
  matches: RequirementProviderMatch[]
  reasons: string[]
  blockers: string[]
  evidenceRefs: string[]
}

const norm = (value: string) => value.trim().toLowerCase()
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))]
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function isProviderAddressableRequirement(requirement: OpportunityRequirement): boolean {
  return ['capability', 'credential', 'geography', 'past_performance', 'capacity', 'socioeconomic', 'security'].includes(requirement.kind)
}

function tokenOverlap(required: string[], available: string[]): number {
  if (required.length === 0) return 0
  const pool = available.map(norm)
  const hits = required.filter((token) => pool.some((value) => value.includes(norm(token)) || norm(token).includes(value)))
  return hits.length / required.length
}

function naicsSimilarity(required: string[], providerCodes: string[]): number {
  if (required.length === 0 || providerCodes.length === 0) return 0
  let best = 0
  for (const r of required) for (const p of providerCodes) {
    if (r === p) best = Math.max(best, 100)
    else if (r.slice(0, 4) === p.slice(0, 4)) best = Math.max(best, 75)
    else if (r.slice(0, 3) === p.slice(0, 3)) best = Math.max(best, 60)
  }
  return best
}

function evidenceForCapabilities(provider: FulfillmentProvider): string[] {
  return uniq(provider.capabilities.filter((c) => c.verified).flatMap((c) => c.evidenceRefs))
}

function matchRequirement(requirement: OpportunityRequirement, provider: FulfillmentProvider): RequirementProviderMatch {
  const reasons: string[] = []
  const blockers: string[] = []
  let evidenceRefs: string[] = []
  let score = 0
  let status: RequirementMatchStatus = 'unresolved'

  const verifiedCapabilities = provider.capabilities.filter((item) => item.verified)
  const capabilityTerms = verifiedCapabilities.flatMap((item) => [item.name, ...item.keywords])
  const providerNaics = uniq(verifiedCapabilities.flatMap((item) => item.naicsCodes))
  const providerPsc = uniq(verifiedCapabilities.flatMap((item) => item.pscCodes))
  const verifiedCredentials = provider.credentials.filter((item) => item.verified)

  switch (requirement.kind) {
    case 'capability': {
      const overlap = tokenOverlap(requirement.keywords, capabilityTerms)
      evidenceRefs = evidenceForCapabilities(provider)
      score = clamp(overlap * 100)
      if (overlap >= 0.6 && evidenceRefs.length > 0) { status = 'satisfied'; reasons.push('Evidence-backed capability coverage found.') }
      else if (overlap > 0 && evidenceRefs.length > 0) { status = 'partial'; blockers.push('Only partial capability coverage is evidenced.') }
      else { status = 'failed'; blockers.push('Required capability is not evidence-backed.') }
      break
    }
    case 'naics': {
      score = naicsSimilarity(requirement.naicsCodes, providerNaics)
      evidenceRefs = uniq(verifiedCapabilities.filter((c) => c.naicsCodes.some((code) => providerNaics.includes(code))).flatMap((c) => c.evidenceRefs))
      if (score === 100) { status = 'satisfied'; reasons.push('Exact NAICS intelligence match.') }
      else if (score > 0) { status = 'partial'; reasons.push('Related/hierarchical NAICS intelligence match.') }
      else { status = 'unresolved'; blockers.push('No NAICS intelligence match.') }
      break
    }
    case 'psc': {
      const matched = requirement.pscCodes.some((code) => providerPsc.includes(code))
      score = matched ? 100 : 0
      evidenceRefs = uniq(verifiedCapabilities.filter((c) => c.pscCodes.some((code) => requirement.pscCodes.includes(code))).flatMap((c) => c.evidenceRefs))
      status = matched ? 'satisfied' : 'unresolved'
      if (matched) reasons.push('PSC capability classification matched.')
      else blockers.push('PSC classification not found.')
      break
    }
    case 'credential':
    case 'security':
    case 'socioeconomic': {
      const terms = requirement.keywords.length ? requirement.keywords : [requirement.label]
      const matched = verifiedCredentials.filter((credential) => tokenOverlap(terms, [credential.name, credential.kind, credential.issuer ?? '']) > 0)
      evidenceRefs = uniq(matched.flatMap((item) => item.evidenceRefs))
      score = matched.length > 0 ? 100 : 0
      status = matched.length > 0 ? 'satisfied' : 'failed'
      if (matched.length > 0) reasons.push('Required credential/eligibility evidence found.')
      else blockers.push('Required credential/eligibility evidence is missing.')
      break
    }
    case 'geography': {
      const terms = requirement.keywords
      const areas = provider.serviceAreas.flatMap((area) => [area.country, area.state, area.county, area.locality].filter((v): v is string => Boolean(v)))
      const overlap = tokenOverlap(terms, areas)
      const matchedAreas = provider.serviceAreas.filter((area) => tokenOverlap(terms, [area.country, area.state, area.county, area.locality].filter((v): v is string => Boolean(v))) > 0)
      evidenceRefs = uniq(matchedAreas.flatMap((area) => area.evidenceRefs))
      score = clamp(overlap * 100)
      status = overlap > 0 && evidenceRefs.length > 0 ? 'satisfied' : 'failed'
      if (status === 'satisfied') reasons.push('Evidence-backed service geography matched.')
      else blockers.push('Required service geography is not evidenced.')
      break
    }
    case 'past_performance': {
      const verified = provider.pastPerformance.filter((item) => item.verified)
      evidenceRefs = uniq(verified.flatMap((item) => item.evidenceRefs))
      score = verified.length > 0 ? 100 : 0
      status = verified.length > 0 ? 'satisfied' : 'failed'
      if (verified.length > 0) reasons.push('Verified past performance found.')
      else blockers.push('Required past performance is not verified.')
      break
    }
    case 'capacity': {
      evidenceRefs = provider.capacity.evidenceRefs
      if (provider.capacity.status === 'available' && evidenceRefs.length > 0) { score = 100; status = 'satisfied'; reasons.push('Evidence-backed available capacity found.') }
      else if (provider.capacity.status === 'limited' && evidenceRefs.length > 0) { score = 50; status = 'partial'; blockers.push('Provider capacity is limited.') }
      else { status = 'unresolved'; blockers.push('Provider capacity is unknown or unavailable.') }
      break
    }
    case 'schedule':
    case 'commercial':
    case 'other':
      status = 'unresolved'
      blockers.push('Requirement requires opportunity-specific human/commercial review.')
      break
  }

  return { requirementId: requirement.id, status, score, evidenceRefs, reasons, blockers }
}

export function matchFulfillmentProvider(
  set: OpportunityRequirementSet,
  provider: FulfillmentProvider,
): FulfillmentProviderMatch {
  const matches = set.requirements.map((requirement) => matchRequirement(requirement, provider))
  const requiredIds = new Set(set.requirements.filter((r) => r.severity === 'required' && isProviderAddressableRequirement(r)).map((r) => r.id))
  const hardFailures = matches.filter((m) => requiredIds.has(m.requirementId) && m.status === 'failed')
  const unresolvedRequired = matches.filter((m) => requiredIds.has(m.requirementId) && m.status === 'unresolved')
  const capabilityMatches = matches.filter((m) => set.requirements.find((r) => r.id === m.requirementId)?.kind !== 'naics')
  const capabilityEvidenceScore = capabilityMatches.length ? capabilityMatches.reduce((sum, m) => sum + m.score, 0) / capabilityMatches.length : 0
  const naicsMatches = matches.filter((m) => set.requirements.find((r) => r.id === m.requirementId)?.kind === 'naics')
  const naicsIntelligenceScore = naicsMatches.length ? naicsMatches.reduce((sum, m) => sum + m.score, 0) / naicsMatches.length : 0
  const requirementCoverage = matches.length ? matches.filter((m) => m.status === 'satisfied').length / matches.length : 0

  // OPP-CORE.48 invariant: evidence-backed requirements dominate; NAICS is intelligence only.
  const score = clamp(capabilityEvidenceScore * 0.75 + naicsIntelligenceScore * 0.25)
  const blockers = uniq([
    ...hardFailures.flatMap((m) => m.blockers),
    ...unresolvedRequired.flatMap((m) => m.blockers),
    ...set.unresolved,
    ...(!isFulfillmentProviderVerified(provider) ? ['Provider has not completed canonical verification.'] : []),
  ])
  const reasons = uniq(matches.flatMap((m) => m.reasons))
  const evidenceRefs = uniq(matches.flatMap((m) => m.evidenceRefs))

  const satisfiedRequired = matches.filter((m) => requiredIds.has(m.requirementId) && m.status === 'satisfied')
  const substantiveKinds = new Set<OpportunityRequirement['kind']>(['capability', 'credential', 'past_performance', 'capacity', 'socioeconomic', 'security'])
  const hasSubstantiveRequired = set.requirements.some((r) => requiredIds.has(r.id) && substantiveKinds.has(r.kind))
  const satisfiedSubstantiveRequired = satisfiedRequired.filter((m) => {
    const requirement = set.requirements.find((r) => r.id === m.requirementId)
    return requirement ? substantiveKinds.has(requirement.kind) : false
  })
  let disposition: ProviderMatchDisposition = 'review_required'
  if (!isFulfillmentProviderVerified(provider)) disposition = 'blocked'
  else if (
    requiredIds.size > 0 &&
    (hasSubstantiveRequired ? satisfiedSubstantiveRequired.length === 0 : satisfiedRequired.length === 0) &&
    (hardFailures.length > 0 || unresolvedRequired.length > 0)
  ) disposition = 'blocked'
  else if (hardFailures.length === 0 && unresolvedRequired.length === 0 && set.unresolved.length === 0) disposition = 'qualified_candidate'

  return {
    opportunityId: set.opportunityId,
    providerId: provider.id,
    disposition,
    score,
    requirementCoverage,
    capabilityEvidenceScore: clamp(capabilityEvidenceScore),
    naicsIntelligenceScore: clamp(naicsIntelligenceScore),
    matches,
    reasons,
    blockers,
    evidenceRefs,
  }
}

export function rankFulfillmentProviders(
  set: OpportunityRequirementSet,
  providers: FulfillmentProvider[],
): FulfillmentProviderMatch[] {
  return providers
    .map((provider) => matchFulfillmentProvider(set, provider))
    .sort((a, b) => {
      const rank = { qualified_candidate: 0, review_required: 1, blocked: 2 }
      return rank[a.disposition] - rank[b.disposition] || b.score - a.score || a.providerId.localeCompare(b.providerId)
    })
}

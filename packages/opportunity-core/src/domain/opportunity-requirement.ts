import type { Opportunity } from './opportunity.js'

export type OpportunityRequirementKind =
  | 'capability'
  | 'naics'
  | 'psc'
  | 'credential'
  | 'geography'
  | 'past_performance'
  | 'capacity'
  | 'socioeconomic'
  | 'security'
  | 'schedule'
  | 'commercial'
  | 'other'

export type OpportunityRequirementSeverity = 'required' | 'important' | 'optional'
export type OpportunityRequirementEvidenceStatus = 'explicit' | 'inferred' | 'unknown'

export type OpportunityRequirement = {
  id: string
  opportunityId: string
  kind: OpportunityRequirementKind
  label: string
  severity: OpportunityRequirementSeverity
  evidenceStatus: OpportunityRequirementEvidenceStatus
  sourceClaimIds: string[]
  sourceEvidenceIds: string[]
  naicsCodes: string[]
  pscCodes: string[]
  keywords: string[]
  attributes: Record<string, string | number | boolean>
  confidence: number
  blockers: string[]
}

export type OpportunityRequirementSet = {
  opportunityId: string
  requirements: OpportunityRequirement[]
  unresolved: string[]
  generatedAt: string
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function tokens(value: string): string[] {
  return uniq(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((token) => token.length > 2))
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function claimIds(opportunity: Opportunity, fields: string[]): string[] {
  return opportunity.claims.filter((claim) => fields.includes(claim.field)).map((claim) => claim.id)
}

function evidenceIdsForClaims(opportunity: Opportunity, ids: string[]): string[] {
  const sourceIds = new Set(opportunity.claims.filter((claim) => ids.includes(claim.id)).map((claim) => claim.sourceId))
  return uniq(opportunity.evidence.filter((evidence) => sourceIds.has(evidence.sourceId)).map((evidence) => evidence.id))
}

function makeRequirement(
  opportunity: Opportunity,
  input: Omit<OpportunityRequirement, 'opportunityId' | 'sourceEvidenceIds'> & { sourceEvidenceIds?: string[] },
): OpportunityRequirement {
  const sourceEvidenceIds = input.sourceEvidenceIds ?? evidenceIdsForClaims(opportunity, input.sourceClaimIds)
  return {
    ...input,
    opportunityId: opportunity.id,
    sourceClaimIds: uniq(input.sourceClaimIds),
    sourceEvidenceIds: uniq(sourceEvidenceIds),
    naicsCodes: uniq(input.naicsCodes),
    pscCodes: uniq(input.pscCodes),
    keywords: uniq(input.keywords),
    confidence: Math.max(0, Math.min(1, input.confidence)),
    blockers: uniq(input.blockers),
  }
}

export function decomposeOpportunityRequirements(
  opportunity: Opportunity,
  now = new Date().toISOString(),
): OpportunityRequirementSet {
  if (opportunity.type !== 'contract') {
    return { opportunityId: opportunity.id, requirements: [], unresolved: ['Requirement decomposition currently supports contract opportunities only.'], generatedAt: now }
  }

  const requirements: OpportunityRequirement[] = []
  const unresolved: string[] = []
  const eligibility = opportunity.eligibility ?? {}
  const metadata = opportunity.metadata ?? {}
  const naics = str(eligibility.naicsCode) ?? str(metadata.naicsCode)
  const psc = str(eligibility.pscCode) ?? str(metadata.pscCode)
  const setAside = str(eligibility.setAside)
  const place = str(eligibility.placeOfPerformance)
  const description = opportunity.description ?? ''
  const title = opportunity.title
  const textTokens = tokens(`${title} ${description}`)
  const allOfficialEvidence = opportunity.evidence.filter((item) => item.sourceType === 'official').map((item) => item.id)

  if (naics) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:naics:${naics}`,
      kind: 'naics',
      label: `NAICS ${naics}`,
      severity: 'important',
      evidenceStatus: 'explicit',
      sourceClaimIds: claimIds(opportunity, ['eligibility.naicsCode', 'naicsCode']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: [naics],
      pscCodes: [],
      keywords: [],
      attributes: { code: naics },
      confidence: 1,
      blockers: [],
    }))
  } else unresolved.push('NAICS code is not available.')

  if (psc) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:psc:${psc}`,
      kind: 'psc',
      label: `PSC ${psc}`,
      severity: 'important',
      evidenceStatus: 'explicit',
      sourceClaimIds: claimIds(opportunity, ['eligibility.pscCode', 'pscCode']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: [],
      pscCodes: [psc],
      keywords: [],
      attributes: { code: psc },
      confidence: 1,
      blockers: [],
    }))
  }

  if (setAside) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:set-aside`,
      kind: 'socioeconomic',
      label: `Set-aside: ${setAside}`,
      severity: 'required',
      evidenceStatus: 'explicit',
      sourceClaimIds: claimIds(opportunity, ['eligibility.setAside', 'setAside']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: [],
      pscCodes: [],
      keywords: tokens(setAside),
      attributes: { setAside },
      confidence: 1,
      blockers: ['Eligibility must be independently verified before treating the set-aside as satisfied.'],
    }))
  }

  if (place) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:geography`,
      kind: 'geography',
      label: `Place of performance: ${place}`,
      severity: 'required',
      evidenceStatus: 'explicit',
      sourceClaimIds: claimIds(opportunity, ['eligibility.placeOfPerformance', 'placeOfPerformance']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: [],
      pscCodes: [],
      keywords: tokens(place),
      attributes: { placeOfPerformance: place },
      confidence: 1,
      blockers: [],
    }))
  } else unresolved.push('Place of performance is not available.')

  if (opportunity.deadline) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:deadline`,
      kind: 'schedule',
      label: `Response deadline: ${opportunity.deadline}`,
      severity: 'required',
      evidenceStatus: 'explicit',
      sourceClaimIds: claimIds(opportunity, ['deadline']),
      naicsCodes: [],
      pscCodes: [],
      keywords: [],
      attributes: { deadline: opportunity.deadline },
      confidence: 1,
      blockers: [],
    }))
  } else unresolved.push('Response deadline is not available.')

  const amount = num(opportunity.amount?.max)
  if (amount !== undefined) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:capacity`,
      kind: 'capacity',
      label: 'Execution capacity',
      severity: 'important',
      evidenceStatus: 'inferred',
      sourceClaimIds: claimIds(opportunity, ['amount.max']),
      naicsCodes: [],
      pscCodes: [],
      keywords: [],
      attributes: { estimatedContractValue: amount, currency: opportunity.amount?.currency ?? 'USD' },
      confidence: 0.75,
      blockers: ['Contract value is a capacity signal, not proof of required workforce or bonding.'],
    }))
  } else unresolved.push('Contract value/capacity requirement is unresolved.')

  const capabilityKeywords = textTokens.filter((token) => !['contract', 'solicitation', 'services', 'service', 'support', 'government', 'federal'].includes(token)).slice(0, 24)
  if (capabilityKeywords.length > 0) {
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:capability`,
      kind: 'capability',
      label: title,
      severity: 'required',
      evidenceStatus: description ? 'explicit' : 'inferred',
      sourceClaimIds: claimIds(opportunity, ['title', 'description']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: naics ? [naics] : [],
      pscCodes: psc ? [psc] : [],
      keywords: capabilityKeywords,
      attributes: {},
      confidence: description ? 0.9 : 0.6,
      blockers: description ? [] : ['Capability requirement was inferred from title because no description was available.'],
    }))
  } else unresolved.push('Capability requirement could not be extracted.')

  const patterns: Array<{ regex: RegExp; kind: OpportunityRequirementKind; label: string; severity: OpportunityRequirementSeverity }> = [
    { regex: /\b(clearance|classified|secret|top secret|security clearance)\b/i, kind: 'security', label: 'Security/clearance requirement', severity: 'required' },
    { regex: /\b(bond|bonding|bonded)\b/i, kind: 'credential', label: 'Bonding requirement', severity: 'required' },
    { regex: /\b(license|licensed|licensure|certification|certified)\b/i, kind: 'credential', label: 'License/certification requirement', severity: 'required' },
    { regex: /\b(past performance|prior experience|similar contract)\b/i, kind: 'past_performance', label: 'Relevant past performance', severity: 'important' },
    { regex: /\b(insurance|insured)\b/i, kind: 'credential', label: 'Insurance requirement', severity: 'required' },
  ]
  for (const pattern of patterns) {
    const match = description.match(pattern.regex)
    if (!match) continue
    requirements.push(makeRequirement(opportunity, {
      id: `${opportunity.id}:requirement:${pattern.kind}:${requirements.length}`,
      kind: pattern.kind,
      label: pattern.label,
      severity: pattern.severity,
      evidenceStatus: 'inferred',
      sourceClaimIds: claimIds(opportunity, ['description']),
      sourceEvidenceIds: allOfficialEvidence,
      naicsCodes: [],
      pscCodes: [],
      keywords: tokens(match[0]),
      attributes: {},
      confidence: 0.65,
      blockers: ['Keyword detection identifies a review target; solicitation documents must confirm the exact requirement.'],
    }))
  }

  if (description.length < 80) unresolved.push('Solicitation description is too limited for high-confidence requirement decomposition.')

  return { opportunityId: opportunity.id, requirements, unresolved: uniq(unresolved), generatedAt: now }
}

export function hasUnresolvedRequiredRequirements(set: OpportunityRequirementSet): boolean {
  return set.requirements.some((requirement) => requirement.severity === 'required' && requirement.blockers.length > 0) ||
    set.unresolved.length > 0
}

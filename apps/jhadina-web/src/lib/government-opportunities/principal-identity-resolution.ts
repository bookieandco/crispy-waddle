export type PrincipalIdentityStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED'
export type PrincipalRoleStatus = 'CURRENT' | 'FORMER' | 'UNKNOWN'

export interface PrincipalCandidate {
  id: string
  corporateEntityId: string
  name: string
  role?: string | null
  jurisdiction?: string | null
  providerId: string
  providerRecordId?: string | null
  registryUid?: string | null
  corporateIdentifier?: string | null
  sourceRecordId?: string | null
  evidenceIds: string[]
  observedAt?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface PrincipalIdentityResolution {
  canonicalPrincipalId: string | null
  status: PrincipalIdentityStatus
  identityConfidence: number
  roleStatus: PrincipalRoleStatus
  roleConfidence: number
  ownershipConfidence: number
  controlConfidence: number
  matchedCandidateIds: string[]
  supportingEvidenceIds: string[]
  conflictingEvidenceIds: string[]
  reasons: string[]
  resolverVersion: string
  resolvedAt: string
}

export interface PrincipalResolutionContext {
  corporateEntityId: string
  jurisdiction?: string | null
  expectedRole?: string | null
  canonicalName?: string | null
}

const RESOLVER_VERSION = '6.68.0'

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeIdentifier(value: string | null | undefined): string {
  return normalize(value).replace(/\s+/g, '')
}

function roleStatus(candidate: PrincipalCandidate, now = new Date()): PrincipalRoleStatus {
  const end = candidate.endDate ? new Date(candidate.endDate) : null
  if (end && !Number.isNaN(end.getTime()) && end < now) return 'FORMER'
  if (candidate.startDate) {
    const start = new Date(candidate.startDate)
    if (!Number.isNaN(start.getTime()) && start > now) return 'UNKNOWN'
  }
  if (candidate.endDate === null || candidate.endDate === undefined) return 'CURRENT'
  return 'UNKNOWN'
}

function roleMatches(candidate: PrincipalCandidate, expectedRole?: string | null): boolean {
  if (!expectedRole || !candidate.role) return false
  return normalize(candidate.role) === normalize(expectedRole)
}

function nameSimilarity(a: string, b: string): number {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const aTokens = new Set(left.split(' '))
  const bTokens = new Set(right.split(' '))
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length
  const union = new Set([...aTokens, ...bTokens]).size
  return union ? intersection / union : 0
}

export function resolvePrincipalIdentity(
  candidates: PrincipalCandidate[],
  context: PrincipalResolutionContext,
  now = new Date(),
): PrincipalIdentityResolution {
  const eligible = candidates.filter((candidate) => candidate.corporateEntityId === context.corporateEntityId)
  const supportingEvidenceIds = [...new Set(eligible.flatMap((candidate) => candidate.evidenceIds))]
  const reasons: string[] = []

  if (eligible.length === 0) {
    return {
      canonicalPrincipalId: null,
      status: 'UNMATCHED',
      identityConfidence: 0,
      roleStatus: 'UNKNOWN',
      roleConfidence: 0,
      ownershipConfidence: 0,
      controlConfidence: 0,
      matchedCandidateIds: [],
      supportingEvidenceIds: [],
      conflictingEvidenceIds: [],
      reasons: ['No candidates matched the corporate entity.'],
      resolverVersion: RESOLVER_VERSION,
      resolvedAt: now.toISOString(),
    }
  }

  const canonicalName = normalize(context.canonicalName)
  const exactIdentifierGroups = new Map<string, PrincipalCandidate[]>()
  for (const candidate of eligible) {
    const identifiers = [candidate.registryUid, candidate.providerRecordId, candidate.corporateIdentifier]
      .map(normalizeIdentifier)
      .filter(Boolean)
    for (const identifier of identifiers) {
      const group = exactIdentifierGroups.get(identifier) ?? []
      group.push(candidate)
      exactIdentifierGroups.set(identifier, group)
    }
  }

  const exactGroups = [...exactIdentifierGroups.entries()].filter(([, group]) => group.length > 0)
  const exactMatches = exactGroups.flatMap(([, group]) => group)
  const uniqueExactMatches = [...new Map(exactMatches.map((candidate) => [candidate.id, candidate])).values()]

  let matched: PrincipalCandidate[] = []
  let identityConfidence = 0

  if (uniqueExactMatches.length > 0) {
    matched = uniqueExactMatches
    identityConfidence = 98
    reasons.push('Matched using an exact provider, registry, or corporate identifier.')
  } else {
    const scored = eligible.map((candidate) => {
      const nameScore = canonicalName ? nameSimilarity(candidate.name, canonicalName) : 0
      const jurisdictionScore = context.jurisdiction && candidate.jurisdiction && normalize(context.jurisdiction) === normalize(candidate.jurisdiction) ? 1 : 0
      const roleScore = roleMatches(candidate, context.expectedRole) ? 1 : 0
      const score = nameScore * 60 + jurisdictionScore * 20 + roleScore * 20
      return { candidate, score, nameScore, jurisdictionScore, roleScore }
    }).sort((a, b) => b.score - a.score)

    const top = scored[0]
    const second = scored[1]

    if (top && top.nameScore === 1 && top.jurisdictionScore === 1 && top.roleScore === 1 && (!second || top.score - second.score >= 15)) {
      matched = [top.candidate]
      identityConfidence = Math.round(top.score)
      reasons.push('Matched on normalized name, jurisdiction, and compatible role.')
    } else if (top && top.nameScore >= 0.8 && top.jurisdictionScore === 1 && (!second || top.score - second.score >= 20)) {
      matched = [top.candidate]
      identityConfidence = Math.round(Math.min(89, top.score))
      reasons.push('Strong candidate match using name, jurisdiction, and supporting context; no exact identifier was available.')
    } else {
      const conflicting = scored.filter((entry) => entry.nameScore >= 0.8 && entry.candidate.registryUid && top && entry.candidate.registryUid !== top.candidate.registryUid)
      return {
        canonicalPrincipalId: null,
        status: top && second && Math.abs(top.score - second.score) < 15 ? 'AMBIGUOUS' : 'UNMATCHED',
        identityConfidence: top ? Math.round(Math.min(69, top.score)) : 0,
        roleStatus: top ? roleStatus(top.candidate, now) : 'UNKNOWN',
        roleConfidence: top ? (roleMatches(top.candidate, context.expectedRole) ? 70 : 0) : 0,
        ownershipConfidence: 0,
        controlConfidence: 0,
        matchedCandidateIds: [],
        supportingEvidenceIds,
        conflictingEvidenceIds: [...new Set(conflicting.flatMap((entry) => entry.candidate.evidenceIds))],
        reasons: [
          'No deterministic identity match was established.',
          ...(top && second && Math.abs(top.score - second.score) < 15 ? ['Multiple candidates remain materially plausible.'] : []),
          ...(conflicting.length ? ['Conflicting identifiers were detected.'] : []),
        ],
        resolverVersion: RESOLVER_VERSION,
        resolvedAt: now.toISOString(),
      }
    }
  }

  const roles = matched.map((candidate) => roleStatus(candidate, now))
  const current = roles.includes('CURRENT')
  const former = roles.includes('FORMER')
  const resolvedRoleStatus: PrincipalRoleStatus = current ? 'CURRENT' : former ? 'FORMER' : 'UNKNOWN'
  const expectedRoleMatch = context.expectedRole ? matched.filter((candidate) => roleMatches(candidate, context.expectedRole)).length : 0
  const roleConfidence = context.expectedRole ? (expectedRoleMatch > 0 ? 95 : 35) : 60

  if (matched.length > 1) reasons.push('Multiple source records corroborate the same principal identity.')
  if (resolvedRoleStatus === 'FORMER') reasons.push('The available officership evidence is historical; no current end-date-free record was found.')

  return {
    canonicalPrincipalId: `principal:${context.corporateEntityId}:${normalize(matched[0].name).replace(/ /g, '-')}`,
    status: 'MATCHED',
    identityConfidence,
    roleStatus: resolvedRoleStatus,
    roleConfidence,
    ownershipConfidence: 0,
    controlConfidence: 0,
    matchedCandidateIds: matched.map((candidate) => candidate.id),
    supportingEvidenceIds,
    conflictingEvidenceIds: [],
    reasons,
    resolverVersion: RESOLVER_VERSION,
    resolvedAt: now.toISOString(),
  }
}

export { normalize as normalizePrincipalName }

export interface CorporateCandidate {
  id: string
  legalName: string
  jurisdiction: string
  registrationNumber?: string
  source: string
  sourceUrl?: string
}

export interface CorporateIdentityInput {
  recipientName: string
  jurisdiction?: string
  registrationNumber?: string
}

export interface CorporateIdentityResolution {
  recipientName: string
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED'
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  matchedEntityId?: string
  candidates: CorporateCandidate[]
  reasons: string[]
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolves a procurement recipient against supplied corporate records.
 * This function performs deterministic matching only; external registry lookups
 * belong to the connector layer and must return provenance with each candidate.
 */
export function resolveCorporateIdentity(
  input: CorporateIdentityInput,
  candidates: CorporateCandidate[],
): CorporateIdentityResolution {
  if (!input.recipientName.trim()) throw new Error('recipientName is required')

  const name = normalizeName(input.recipientName)
  const registration = input.registrationNumber?.trim().toLowerCase()
  const jurisdiction = input.jurisdiction?.trim().toLowerCase()

  const ranked = candidates
    .map((candidate) => {
      const candidateName = normalizeName(candidate.legalName)
      const exactName = candidateName === name
      const registrationMatch = Boolean(registration && candidate.registrationNumber?.trim().toLowerCase() === registration)
      const jurisdictionMatch = Boolean(jurisdiction && candidate.jurisdiction.trim().toLowerCase() === jurisdiction)
      const score = (registrationMatch ? 100 : 0) + (exactName ? 50 : 0) + (jurisdictionMatch ? 20 : 0)
      return { candidate, score, registrationMatch, exactName, jurisdictionMatch }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) {
    return { recipientName: input.recipientName.trim(), status: 'UNMATCHED', confidence: 'LOW', candidates: [], reasons: ['No supplied corporate record matched the provided identifiers.'] }
  }

  const best = ranked[0]
  const tied = ranked.filter((item) => item.score === best.score)
  const high = best.registrationMatch || (best.exactName && best.jurisdictionMatch)

  return {
    recipientName: input.recipientName.trim(),
    status: tied.length > 1 ? 'AMBIGUOUS' : 'MATCHED',
    confidence: tied.length > 1 ? 'LOW' : high ? 'HIGH' : 'MEDIUM',
    matchedEntityId: tied.length === 1 ? best.candidate.id : undefined,
    candidates: ranked.map((item) => item.candidate),
    reasons: [
      ...(best.registrationMatch ? ['Registration number matched.'] : []),
      ...(best.exactName ? ['Normalized legal name matched.'] : []),
      ...(best.jurisdictionMatch ? ['Jurisdiction matched.'] : []),
      ...(tied.length > 1 ? ['Multiple candidates share the top match score; human review is required.'] : []),
    ],
  }
}

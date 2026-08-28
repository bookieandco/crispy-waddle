import type { ProcurementSource } from './procurement-source-registry'

export interface ProcurementSourceCandidate {
  name: string
  jurisdiction: string
  level: ProcurementSource['level']
  url: string
  sourceType: ProcurementSource['sourceType']
  discoveredFrom: string
  discoveredAt: string
}

export interface ProcurementSourceVerification {
  sourceId: string
  reachable: boolean
  httpStatus?: number
  verifiedAt: string
  reason: string
}

/** Turns externally discovered procurement endpoints into registry-ready candidates. */
export function discoverProcurementSources(
  candidates: ProcurementSourceCandidate[],
): ProcurementSourceCandidate[] {
  const dedupe = new Map<string, ProcurementSourceCandidate>()
  for (const candidate of candidates) {
    if (!candidate.name || !candidate.jurisdiction || !candidate.url || !candidate.discoveredFrom) continue
    const key = `${candidate.level}|${candidate.jurisdiction.trim().toLowerCase()}|${candidate.url.trim().toLowerCase()}`
    dedupe.set(key, candidate)
  }
  return [...dedupe.values()].sort((a, b) => a.url.localeCompare(b.url))
}

/** Records verification results; network access is intentionally owned by adapters. */
export function recordProcurementSourceVerification(
  source: ProcurementSource,
  verification: Omit<ProcurementSourceVerification, 'sourceId'>,
): ProcurementSource {
  return {
    ...source,
    active: verification.reachable,
    lastVerifiedAt: verification.verifiedAt,
    metadata: {
      ...source.metadata,
      verification: {
        httpStatus: verification.httpStatus,
        reason: verification.reason,
      },
    },
  }
}

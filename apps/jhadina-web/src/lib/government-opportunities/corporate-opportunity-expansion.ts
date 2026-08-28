export interface CorporateOpportunitySignal {
  companyEntityId: string
  capability: string
  jurisdiction?: string
  agencyId?: string
  opportunityId?: string
  source: string
  sourceReference: string
  confidence: number
  evidenceIds: string[]
  metadata?: Record<string, unknown>
}

export interface CorporateOpportunityExpansion {
  companyEntityId: string
  capabilities: string[]
  agencies: string[]
  opportunities: string[]
  signals: CorporateOpportunitySignal[]
}

function normalizeSignal(signal: CorporateOpportunitySignal): CorporateOpportunitySignal {
  return {
    ...signal,
    confidence: Math.max(0, Math.min(1, signal.confidence)),
    evidenceIds: [...new Set(signal.evidenceIds)].sort(),
  }
}

/**
 * Expands a known company into procurement opportunities without claiming
 * that a capability or opportunity exists unless it is backed by a source.
 */
export function buildCorporateOpportunityExpansion(
  companyEntityId: string,
  signals: CorporateOpportunitySignal[],
): CorporateOpportunityExpansion {
  const relevant = signals
    .filter((signal) => signal.companyEntityId === companyEntityId)
    .map(normalizeSignal)

  return {
    companyEntityId,
    capabilities: [...new Set(relevant.map((s) => s.capability))].sort(),
    agencies: [...new Set(relevant.flatMap((s) => s.agencyId ? [s.agencyId] : []))].sort(),
    opportunities: [...new Set(relevant.flatMap((s) => s.opportunityId ? [s.opportunityId] : []))].sort(),
    signals: relevant,
  }
}

export function rankCorporateOpportunitySignals(
  signals: CorporateOpportunitySignal[],
): CorporateOpportunitySignal[] {
  return signals
    .map(normalizeSignal)
    .sort((a, b) => b.confidence - a.confidence || a.capability.localeCompare(b.capability))
}

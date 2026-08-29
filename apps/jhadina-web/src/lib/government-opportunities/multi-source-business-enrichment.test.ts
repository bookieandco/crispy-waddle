import { describe, expect, it } from 'vitest'
import {
  enrichPrincipalFromProviders,
  type BusinessEnrichmentProvider,
} from './multi-source-business-enrichment'

function provider(
  id: string,
  disposition: 'ENRICHED' | 'PARTIAL' | 'NO_MATCH' | 'RATE_LIMITED' | 'REVIEW_REQUIRED' | 'FAILED',
): BusinessEnrichmentProvider {
  return {
    id,
    async enrich() {
      return {
        providerId: id,
        disposition,
        fields: {},
        evidence:
          disposition === 'ENRICHED'
            ? [{ evidenceId: `${id}:1`, providerId: id, sourceRecordId: 'record-1' }]
            : [],
        reasons: [`${id}:${disposition}`],
      }
    },
  }
}

describe('enrichPrincipalFromProviders', () => {
  const baseRequest = {
    principalId: 'principal-1',
    corporateEntityId: 'company-1',
    minimumIdentityConfidence: 90,
    minimumRoleConfidence: 80,
  }

  it('aggregates independent provider evidence without selecting an authority', async () => {
    const outcome = await enrichPrincipalFromProviders(baseRequest, [
      provider('OPENCORPORATES', 'ENRICHED'),
      provider('SEC_EDGAR', 'ENRICHED'),
      provider('SAM_GOV', 'PARTIAL'),
    ])

    expect(outcome.disposition).toBe('ENRICHED')
    expect(outcome.providerResults).toHaveLength(3)
    expect(outcome.evidence).toHaveLength(2)
  })

  it('honors the provider allow-list', async () => {
    const outcome = await enrichPrincipalFromProviders(
      { ...baseRequest, allowedProviders: ['SEC_EDGAR'] },
      [provider('OPENCORPORATES', 'ENRICHED'), provider('SEC_EDGAR', 'NO_MATCH')],
    )

    expect(outcome.providerResults.map((result) => result.providerId)).toEqual(['SEC_EDGAR'])
    expect(outcome.disposition).toBe('NO_MATCH')
  })

  it('reports rate limiting when every selected provider is rate limited', async () => {
    const outcome = await enrichPrincipalFromProviders(baseRequest, [
      provider('OPENCORPORATES', 'RATE_LIMITED'),
      provider('SEC_EDGAR', 'RATE_LIMITED'),
    ])

    expect(outcome.disposition).toBe('RATE_LIMITED')
  })

  it('surfaces review-required provider results', async () => {
    const outcome = await enrichPrincipalFromProviders(baseRequest, [
      provider('STATE_REGISTRY', 'REVIEW_REQUIRED'),
    ])

    expect(outcome.disposition).toBe('REVIEW_REQUIRED')
  })

  it('does not enable contact enrichment through the base orchestrator', async () => {
    await expect(
      enrichPrincipalFromProviders(
        { ...baseRequest, allowContactEnrichment: true },
        [provider('OPENCORPORATES', 'ENRICHED')],
      ),
    ).rejects.toThrow('permitted-contact escalation boundary')
  })

  it('validates confidence thresholds', async () => {
    await expect(
      enrichPrincipalFromProviders(
        { ...baseRequest, minimumIdentityConfidence: 101 },
        [provider('OPENCORPORATES', 'ENRICHED')],
      ),
    ).rejects.toThrow('between 0 and 100')
  })
})

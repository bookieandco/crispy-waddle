import { describe, expect, it, vi } from 'vitest'
import { SamGovProviderError, SamOpportunityDiscoveryProvider } from './sam-gov.js'

describe('SamOpportunityDiscoveryProvider', () => {
  it('maps published SAM notices into canonical discovered opportunities', async () => {
    process.env.sam_key = 'test-sam-key'

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        opportunitiesData: [{
          noticeId: 'N-123',
          title: 'Test federal contract',
          noticeType: 'Combined Synopsis/Solicitation',
          solicitationNumber: 'SOL-123',
          department: 'Department of Test',
          office: 'Test Office',
          naicsCode: '541511',
          typeOfSetAside: 'SBA',
          responseDeadLine: '09/15/2026',
          estimatedValue: '$125,000',
          placeOfPerformance: { city: 'Washington', state: 'DC', zip: '20001', country: 'US' },
          description: 'A test opportunity',
          uiLink: 'https://sam.gov/opp/N-123/view',
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

    const provider = new SamOpportunityDiscoveryProvider({ fetchImpl })
    const records = await provider.discover({ since: '08/01/2026' })

    expect(records).toHaveLength(1)
    expect(records[0]?.externalId).toBe('N-123')
    expect(records[0]?.opportunity.id).toBe('sam:N-123')
    expect(records[0]?.opportunity.sourceId).toBe('us.sam.gov')
    expect(records[0]?.opportunity.type).toBe('contract')
    expect(records[0]?.opportunity.amount?.max).toBe(125000)
    expect(records[0]?.opportunity.claims.length).toBeGreaterThan(0)
    expect(records[0]?.opportunity.evidence.length).toBeGreaterThan(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]))
    expect(requestUrl.searchParams.get('api_key')).toBe('test-sam-key')
    expect(requestUrl.searchParams.get('postedFrom')).toBe('08/01/2026')
  })

  it('never exposes an upstream SAM response body on request failure', async () => {
    process.env.sam_key = 'test-sam-key'
    const secretBody = 'sensitive upstream diagnostic payload'
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(secretBody, { status: 429 }))

    const provider = new SamOpportunityDiscoveryProvider({ fetchImpl })

    await expect(provider.discover()).rejects.toMatchObject({
      name: 'SamGovProviderError',
      code: 'SAM_GOV_REQUEST_FAILED',
      status: 429,
    })
    await expect(provider.discover()).rejects.not.toThrow(secretBody)
  })

  it('reports a missing key without exposing configuration details', async () => {
    delete process.env.sam_key
    delete process.env.SAM_GOV_API_KEY
    const fetchImpl = vi.fn<typeof fetch>()
    const provider = new SamOpportunityDiscoveryProvider({ fetchImpl })

    await expect(provider.discover()).rejects.toEqual(expect.objectContaining({
      code: 'SAM_GOV_KEY_NOT_CONFIGURED',
    }))
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(SamGovProviderError).toBeDefined()
  })
})

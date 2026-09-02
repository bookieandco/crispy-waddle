import { describe, expect, it, vi } from 'vitest'
import { GrantsGovProviderError, GrantsGovOpportunityDiscoveryProvider } from './grants-gov.js'

describe('GrantsGovOpportunityDiscoveryProvider', () => {
  it('maps Simpler.Grants.gov opportunities into canonical discovered opportunities', async () => {
    process.env.SIMPLER_GRANTS_API_KEY = 'test-grants-key'

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        message: 'Success',
        data: [{
          opportunity_id: '11111111-1111-1111-1111-111111111111',
          opportunity_number: 'TEST-GRANT-26-001',
          opportunity_title: 'Test federal grant',
          agency_code: 'NSF',
          agency_name: 'National Science Foundation',
          top_level_agency_name: 'National Science Foundation',
          post_date: '2026-08-31',
          close_date: '2026-10-15',
          opportunity_status: 'posted',
          funding_instrument: 'grant',
          funding_category: 'science',
          award_floor: 10000,
          award_ceiling: 250000,
          estimated_total_program_funding: 1000000,
          expected_number_of_awards: 10,
          applicant_types: ['small_businesses'],
          summary: 'A test opportunity',
        }],
        pagination_info: { page_offset: 1, page_size: 25, total_pages: 1, total_records: 1 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

    const provider = new GrantsGovOpportunityDiscoveryProvider({ fetchImpl, limit: 25, keyword: 'science' })
    const records = await provider.discover({ since: '2026-08-01' })

    expect(records).toHaveLength(1)
    expect(records[0]?.externalId).toBe('11111111-1111-1111-1111-111111111111')
    expect(records[0]?.opportunity.id).toBe('grants:11111111-1111-1111-1111-111111111111')
    expect(records[0]?.opportunity.sourceId).toBe('us.grants.gov')
    expect(records[0]?.opportunity.type).toBe('grant')
    expect(records[0]?.opportunity.amount).toEqual({ min: 10000, max: 250000, currency: 'USD' })
    expect(records[0]?.opportunity.eligibility?.applicantTypes).toEqual(['small_businesses'])
    expect(records[0]?.opportunity.claims.length).toBeGreaterThan(0)
    expect(records[0]?.opportunity.evidence.length).toBeGreaterThan(0)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-API-Key': 'test-grants-key' }),
    }))

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body.query).toBe('science')
    expect(body.filters.opportunity_status.one_of).toEqual(['posted', 'forecasted'])
    expect(body.filters.post_date).toEqual({ start_date: '2026-08-01' })
    expect(body.pagination.page_offset).toBe(1)
    expect(body.pagination.page_size).toBe(25)
  })

  it('does not expose upstream response bodies on request failure', async () => {
    process.env.SIMPLER_GRANTS_API_KEY = 'test-grants-key'
    const secretBody = 'sensitive upstream diagnostic payload'
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(secretBody, { status: 429 }))
    const provider = new GrantsGovOpportunityDiscoveryProvider({ fetchImpl })

    await expect(provider.discover()).rejects.toMatchObject({
      name: 'GrantsGovProviderError',
      code: 'GRANTS_GOV_REQUEST_FAILED',
      status: 429,
    })
    await expect(provider.discover()).rejects.not.toThrow(secretBody)
  })

  it('reports a missing key without making a request', async () => {
    delete process.env.SIMPLER_GRANTS_API_KEY
    delete process.env.simpler_grants_api_key
    const fetchImpl = vi.fn<typeof fetch>()
    const provider = new GrantsGovOpportunityDiscoveryProvider({ fetchImpl })

    await expect(provider.discover()).rejects.toEqual(expect.objectContaining({
      code: 'GRANTS_GOV_KEY_NOT_CONFIGURED',
    }))
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(GrantsGovProviderError).toBeDefined()
  })
})

import { describe, expect, it } from 'vitest'
import { splitSamEntityRequestBudget } from './sam-provider-runtime'
import { rankSamNoticeRows } from './sam-wide-runtime'

describe('SAM live closeout selection', () => {
  it('prefers real solicitation attachments over hydrated timestamp-only notices', () => {
    const selected = rankSamNoticeRows([
      {
        notice_id: 'hydrated-no-attachment',
        posted_date: '2026-09-30T22:55:15.000Z',
        notice_type: 'Solicitation',
        description: 'Request for proposal with a detailed statement of work',
        resource_links: [],
      },
      {
        notice_id: 'bulk-with-attachment',
        posted_date: '2026-09-30',
        notice_type: 'Combined Synopsis/Solicitation',
        description: 'Solicitation',
        resource_links: [
          'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/abc123/download',
          'https://api.sam.gov/prod/opportunities/v2/search?noticeid=bulk-with-attachment&limit=1',
        ],
      },
    ], 1)

    expect(selected).toEqual(['bulk-with-attachment'])
  })

  it('does not treat the SAM detail search URL as a solicitation attachment', () => {
    const selected = rankSamNoticeRows([
      {
        notice_id: 'api-link-only',
        posted_date: '2026-09-30',
        notice_type: 'Sources Sought',
        description: '',
        resource_links: [
          'https://api.sam.gov/prod/opportunities/v2/search?noticeid=api-link-only&limit=1',
        ],
      },
      {
        notice_id: 'real-file',
        posted_date: '2026-09-29',
        notice_type: 'Solicitation',
        description: '',
        resource_links: [
          'https://sam.gov/api/prod/opps/v3/opportunities/resources/files/file456/download',
        ],
      },
    ], 1)

    expect(selected).toEqual(['real-file'])
  })

  it('reserves bounded SAM Entity calls for exact-UEI corroboration', () => {
    expect(splitSamEntityRequestBudget(6, 5)).toEqual({ discovery: 1, verification: 5 })
    expect(splitSamEntityRequestBudget(2, 5)).toEqual({ discovery: 0, verification: 2 })
    expect(splitSamEntityRequestBudget(10, 3)).toEqual({ discovery: 7, verification: 3 })
  })
})

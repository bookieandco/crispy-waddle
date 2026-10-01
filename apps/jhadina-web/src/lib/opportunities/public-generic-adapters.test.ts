import { describe,expect,it } from 'vitest'
import {
  parseGenericHtmlOpportunityTable,
  parseGenericJsonOpportunityCollection,
  parseGenericRssAtomFeed,
} from './public-generic-adapters'

const source={
  sourceId:'test.public.source',
  sourceName:'Example Public Procurement',
  sourceUrl:'https://example.gov/procurement',
  state:'CA' as const,
  county:'Los Angeles',
  buyer:'Example County',
}

describe('generic public procurement adapters',()=>{
  it('parses an HTML opportunity table with stable solicitation IDs',()=>{
    const html=`
      <table>
        <tr><th>Project Title</th><th>Solicitation Number</th><th>Closing Date</th></tr>
        <tr>
          <td><a href="/procurement/123">Roof Replacement</a></td>
          <td>RFP-123</td>
          <td>10/31/2026</td>
        </tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,source,'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      externalId:'RFP-123',
      title:'Roof Replacement',
      deadline:'2026-10-31',
      sourceUrl:'https://example.gov/procurement/123',
    })
    expect(result.stableExternalIdCount).toBe(1)
    expect(result.duplicateExternalIds).toBe(0)
  })

  it('uses a detail link as a stable ID only when no explicit number exists',()=>{
    const html=`
      <table>
        <tr><th>Project</th><th>Reference</th></tr>
        <tr><td><a href="/bid/alpha">HVAC Upgrade</a></td><td></td></tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,source,'2026-10-01T00:00:00Z')
    expect(result.signals[0]?.externalId).toBe('https://example.gov/bid/alpha')
  })

  it('parses RSS/Atom items using guid/id/link as stable identity',()=>{
    const xml=`
      <rss><channel>
        <item>
          <title>Street resurfacing bid</title>
          <link>https://example.gov/bids/77</link>
          <guid>BID-77</guid>
          <description>Public works solicitation</description>
        </item>
      </channel></rss>`
    const result=parseGenericRssAtomFeed(xml,source,'2026-10-01T00:00:00Z')
    expect(result.signals[0]).toMatchObject({
      externalId:'BID-77',
      title:'Street resurfacing bid',
      sourceUrl:'https://example.gov/bids/77',
    })
  })

  it('parses common JSON collection/result field names',()=>{
    const payload={results:[{
      solicitationNumber:'RFQ-9',
      title:'Security camera maintenance',
      closeDate:'2026-11-15',
      detailUrl:'/bids/rfq-9',
    }]}
    const result=parseGenericJsonOpportunityCollection(payload,source,'2026-10-01T00:00:00Z')
    expect(result.signals[0]).toMatchObject({
      externalId:'RFQ-9',
      title:'Security camera maintenance',
      deadline:'2026-11-15',
      sourceUrl:'https://example.gov/bids/rfq-9',
    })
  })

  it('reports duplicate IDs for certification instead of silently deduping them',()=>{
    const payload={items:[
      {id:'same',title:'A'},
      {id:'same',title:'B'},
    ]}
    const result=parseGenericJsonOpportunityCollection(payload,source,'2026-10-01T00:00:00Z')
    expect(result.duplicateExternalIds).toBe(1)
  })

  it('parses explicit HTML award rows only on award-capable sources',()=>{
    const awardSource={...source,sourceKinds:['award'] as const}
    const html=`
      <table>
        <tr><th>Project Title</th><th>Contract Number</th><th>Awarded Vendor</th><th>Award Amount</th><th>Award Date</th></tr>
        <tr>
          <td>County janitorial services</td>
          <td>CTR-2026-44</td>
          <td>CleanCo LLC</td>
          <td>$245,000.00</td>
          <td>09/15/2026</td>
        </tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,awardSource,'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      stage:'award',
      externalId:'CTR-2026-44',
      awardedPrimeName:'CleanCo LLC',
      awardDate:'2026-09-15',
      amount:{max:245000,currency:'USD'},
    })
  })

  it('does not infer an award from an award-capable source without explicit awardee evidence',()=>{
    const awardSource={...source,sourceKinds:['award'] as const}
    const html=`
      <table>
        <tr><th>Project</th><th>Contract Number</th><th>Award Amount</th></tr>
        <tr><td>Roof repair</td><td>CTR-1</td><td>$10,000</td></tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,awardSource,'2026-10-01T00:00:00Z')
    expect(result.signals[0]?.stage).toBe('open_solicitation')
    expect(result.signals[0]?.awardedPrimeName).toBeUndefined()
  })

  it('parses structured JSON awards with prime, amount and date',()=>{
    const awardSource={...source,sourceKinds:['award'] as const}
    const payload={results:[{
      id:'AW-9',
      title:'HVAC maintenance award',
      awardeeName:'Mechanical Partner Inc',
      awardAmount:'1,250,500.50',
      awardDate:'2026-09-30',
      naicsCode:'238220',
    }]}
    const result=parseGenericJsonOpportunityCollection(payload,awardSource,'2026-10-01T00:00:00Z')
    expect(result.signals[0]).toMatchObject({
      stage:'award',
      awardedPrimeName:'Mechanical Partner Inc',
      awardDate:'2026-09-30',
      naicsCode:'238220',
      amount:{max:1250500.5,currency:'USD'},
    })
  })

})

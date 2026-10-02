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

  it('parses a linked opportunity table without a separate solicitation-number column',()=>{
    const html=`
      <table>
        <tr><th>Title</th><th>Posted Date</th><th>Closing Date</th></tr>
        <tr>
          <td><a href="/rfps/itb-26-07-holt-road-resurfacing">ITB 26-07 Holt Road Resurfacing</a></td>
          <td>August 21, 2026</td>
          <td>September 15, 2026</td>
        </tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,source,'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      externalId:'https://example.gov/rfps/itb-26-07-holt-road-resurfacing',
      title:'ITB 26-07 Holt Road Resurfacing',
      deadline:'2026-09-15',
    })
  })

  it('parses CivicPlus-style bid links and labeled textual deadlines',()=>{
    const html=`
      <section>
        <a href="/bids.aspx?bidID=445">Snow Removal Services - November 2026 June 2030 Area II</a>
        <p>Bid Posting Date: September 22, 2026 Project: Snow Removal Services</p>
        <p>Bids Due: Sealed bids will be accepted until 4:00pm local time on September 30, 2026.</p>
      </section>`
    const result=parseGenericHtmlOpportunityTable(html,source,'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      externalId:'https://example.gov/bids.aspx?bidID=445',
      title:'Snow Removal Services - November 2026 June 2030 Area II',
      deadline:'2026-09-30',
    })
  })

  it('uses a verified individual bid detail page when the discovered title is echoed in the body',()=>{
    const detailSource={
      ...source,
      sourceName:'RFP - PRCS NYE Fireworks',
      sourceUrl:'https://example.gov/bids.aspx?bidID=444',
    }
    const html=`
      <main>
        <h1>RFP - PRCS NYE Fireworks</h1>
        <p>Bids Due: September 15, 2026</p>
      </main>`
    const result=parseGenericHtmlOpportunityTable(html,detailSource,'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      externalId:'https://example.gov/bids.aspx?bidID=444',
      title:'RFP - PRCS NYE Fireworks',
      deadline:'2026-09-15',
    })
  })

  it('does not turn generic procurement navigation into an opportunity',()=>{
    const html=`
      <main>
        <h1>Contract Opportunities</h1>
        <a href="https://portal.example.com/open">View Open Contract Opportunities</a>
        <a href="/purchasing">Purchasing</a>
      </main>`
    const result=parseGenericHtmlOpportunityTable(html,{
      ...source,
      sourceName:'Contract Opportunities',
      sourceUrl:'https://example.gov/contract-opportunities',
    },'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(0)
  })

  it('parses award tables only when an awarded vendor is present',()=>{
    const html=`
      <table>
        <tr><th>Project Title</th><th>Contract Number</th><th>Awarded Vendor</th><th>Award Amount</th></tr>
        <tr>
          <td>Road Striping Services</td>
          <td>AWD-26-44</td>
          <td>Example Striping LLC</td>
          <td>$125,000.00</td>
        </tr>
      </table>`
    const result=parseGenericHtmlOpportunityTable(html,{
      ...source,
      sourceKinds:['award'],
    },'2026-10-01T00:00:00Z')
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]).toMatchObject({
      externalId:'AWD-26-44',
      stage:'award',
      awardedPrimeName:'Example Striping LLC',
      amount:{max:125000,currency:'USD'},
    })
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
})

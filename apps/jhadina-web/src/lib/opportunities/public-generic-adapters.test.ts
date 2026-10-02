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
    expect(result.structureMatched).toBe(true)
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

  it('distinguishes a structurally valid empty feed from an unrelated page',()=>{
    const emptyHtml='<table><tr><th>Project Title</th><th>Solicitation Number</th></tr></table>'
    const emptyResult=parseGenericHtmlOpportunityTable(emptyHtml,source,'2026-10-01T00:00:00Z')
    expect(emptyResult.structureMatched).toBe(true)
    expect(emptyResult.signals).toHaveLength(0)

    const unrelated=parseGenericHtmlOpportunityTable(
      '<html><body><h1>Procurement</h1><p>No bid table here.</p></body></html>',
      source,
      '2026-10-01T00:00:00Z',
    )
    expect(unrelated.structureMatched).toBe(false)
    expect(unrelated.signals).toHaveLength(0)

    expect(parseGenericRssAtomFeed('<rss><channel></channel></rss>',source).structureMatched).toBe(true)
    expect(parseGenericJsonOpportunityCollection({results:[]},source).structureMatched).toBe(true)
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

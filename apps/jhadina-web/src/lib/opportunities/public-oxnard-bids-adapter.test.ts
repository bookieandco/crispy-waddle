import {test,expect} from 'vitest'
import {isOxnardPublicProjectBidSource,parseOxnardPublicProjectBids,OXNARD_PUBLIC_BIDS_SOURCE_ID} from './public-oxnard-bids-adapter'

const url='https://www.oxnard.gov/finance/purchasing/public-project-bidding'
const candidate={id:OXNARD_PUBLIC_BIDS_SOURCE_ID,jurisdiction_id:'city:0654652',
 source_url:url,verification_status:'official_owner_verified',adapter_kind:'html'}
const descriptor={sourceId:candidate.id,sourceUrl:url,sourceName:'Oxnard Official Public Works',state:'CA' as const,sourceKinds:['solicitation' as const]}
function fixture(){
 return '<table><thead><tr><th>Specification #</th><th>Project Name</th><th>Link to PDF</th><th>Bids Due Date</th></tr></thead><tbody>'+
 '<tr><td>PW 25-96</td><td>Well 20 Rehabilitation Project Phase II</td><td><a href="/files/scope.pdf">View Details</a></td><td>11/16/26</td></tr>'+
 '<tr><td>PW 25-96</td><td>Well 20 Rehabilitation Project Phase II</td><td>duplicate</td><td>11/16/26</td></tr>'+
 '<tr><td></td><td>Addendum 1</td><td>View Details</td><td></td></tr>'+
 '<tr><td>PW 24-109</td><td>John C. Zaragoza Transit Center Improvements</td><td>View Details</td><td>10/28/26</td></tr>'+
 '<tr><td>PW 25-70</td><td>Wastewater Plant Improvements</td><td>View Details</td><td>10/21/26</td></tr>'+
 '<tr><td>PW 27-99</td><td>Cancelled Planned Project</td><td>View Details</td><td>12/02/26</td></tr>'+
 '<tr><td>PW 27-80</td><td>Malformed Date</td><td>View Details</td><td>02/30/27</td></tr>'+
 '</tbody></table>'
}
test('exact official source admission rejects forged host, id and URL parameters',()=>{
 expect(isOxnardPublicProjectBidSource(candidate)).toBe(true)
 for(const override of [
  {id:'other'}, {source_url:'https://www.oxnard.gov.evil.example/finance/purchasing/public-project-bidding'},
  {source_url:url+'?user=1'}, {source_url:'http://www.oxnard.gov/finance/purchasing/public-project-bidding'},
  {verification_status:'candidate'}, {adapter_kind:'rss'}, {jurisdiction_id:'city:other'}
 ])expect(isOxnardPublicProjectBidSource({...candidate,...override})).toBe(false)
})
test('Oxnard extracts future announced bids with stable IDs and excludes expired, cancelled, duplicate/addendum',()=>{
 const observed='2026-10-22T19:00:00Z'
 const p=parseOxnardPublicProjectBids(fixture(),descriptor,observed)
 expect(p.structureMatched).toBe(true)
 expect(p.signals.map(x=>x.externalId)).toEqual(['OXNARD:PW 25-96','OXNARD:PW 24-109'])
 expect(p.signals.map(x=>x.deadline)).toEqual(['2026-11-16','2026-10-28'])
 expect(p.skippedRows).toBe(5)
 expect(p.duplicateExternalIds).toBe(0)
 expect(p.stableExternalIdCount).toBe(2)
 expect(p.signals.every(x=>x.stage==='open_solicitation'&&x.evidenceRef.includes(candidate.id))).toBe(true)
})
test('expired rows and nonbid tables cannot masquerade as live bidding opportunities',()=>{
 const after=parseOxnardPublicProjectBids(fixture(),descriptor,'2026-12-15T20:00:00Z')
 expect(after.structureMatched).toBe(true)
 expect(after.signals).toHaveLength(0)
 const wrong=parseOxnardPublicProjectBids('<table><tr><th>Project Name</th><th>Bid ID</th></tr><tr><td>Fake</td><td>100</td></tr></table>',descriptor,'2026-10-22T19:00:00Z')
 expect(wrong.structureMatched).toBe(false)
 expect(wrong.signals).toHaveLength(0)
})

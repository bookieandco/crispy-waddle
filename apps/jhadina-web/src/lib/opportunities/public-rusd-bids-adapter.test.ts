import assert from 'node:assert/strict'
import {parseRiversideUnifiedPublicBidList,isRiversideOfficialBidListSource,RUSD_BIDS_SOURCE_ID} from './public-rusd-bids-adapter'
const base='https://webapps.riversideunified.org/apps/planholdersregistration/BidsSelect.aspx'
const candidate={id:RUSD_BIDS_SOURCE_ID,jurisdiction_id:'school_district:unified:0633150',source_url:base,
 verification_status:'official_owner_verified',adapter_kind:'html'}
assert.equal(isRiversideOfficialBidListSource(candidate),true)
for(const input of [
 {...candidate,id:'public-source:forged'},
 {...candidate,jurisdiction_id:'school_district:unified:2000351'},
 {...candidate,source_url:'https://webapps.riversideunified.org.evil.com/apps/planholdersregistration/BidsSelect.aspx'},
 {...candidate,source_url:base+'?secret=1'},
 {...candidate,verification_status:'candidate'},
 {...candidate,adapter_kind:'api'},
])assert.equal(isRiversideOfficialBidListSource(input),false)
const desc={sourceId:candidate.id,sourceName:'RUSD Bids',sourceUrl:base,state:'CA' as const,buyer:'Riverside Unified School District',sourceKinds:['solicitation' as const]}
const fixture=[
'<html><body><table><tr><th>BidID</th><th>Project Name</th><th>Number</th><th>Bids to be Opened</th><th>Estimated Value</th><th>Status</th><th>Select</th></tr>',
'<tr><td>628</td><td>CUPCCAA Chemawa and Rivera Public Address System Replacement</td><td>2026/27-12</td><td>11/10/2026 10:30:00 AM</td><td>150,000.00</td><td>Accepting Bids</td><td><input type="submit"/></td></tr>',
'<tr><td>626</td><td>RFQ Nutrition Services Vented Box Truck</td><td>2026/27-11</td><td>11/4/2026 10:00:00 AM</td><td>&nbsp;</td><td>Accepting Bids</td><td><input type="submit"/></td></tr>',
'<tr><td>626</td><td>RFQ Nutrition Services Vented Box Truck</td><td>2026/27-11</td><td>11/4/2026 10:00:00 AM</td><td>&nbsp;</td><td>Accepting Bids</td><td><input type="submit"/></td></tr>',
'<tr><td>625</td><td>RFQ Aquatic Pool Chemical Delivery Service</td><td>2026/27-08</td><td>10/21/2026 10:30:00 AM</td><td>&nbsp;</td><td>Closed</td><td></td></tr>',
'<tr><td>623</td><td>Painting Jefferson and Sierra</td><td>2026/27-07</td><td>10/22/2026 10:00:00 AM</td><td>600,000.00</td><td>Accepting Bids</td><td></td></tr>',
'<tr><td>618</td><td>Remodel CANCELLED</td><td>2026/27-01</td><td>9/8/2026 10:30:00 AM</td><td>900,000</td><td>Withdrawn</td><td></td></tr>',
'</table></body></html>'
].join('')
const observedAt='2026-10-22T17:30:00Z'
const p=parseRiversideUnifiedPublicBidList(fixture,desc,observedAt)
assert.equal(p.structureMatched,true)
assert.deepEqual(p.signals.map(x=>x.externalId),['RUSD:2026/27-12','RUSD:2026/27-11'])
assert.equal(p.stableExternalIdCount,2)
assert.equal(p.duplicateExternalIds,0)
assert.ok(p.skippedRows>=4)
assert.equal(p.signals[1]?.deadline,'2026-11-04')
assert.equal(p.signals[1]?.stage,'open_solicitation')
assert.equal(p.signals[1]?.sourceUrl,base)
assert.ok(p.signals.every(x=>x.evidenceRef.includes(RUSD_BIDS_SOURCE_ID)))
const expired=parseRiversideUnifiedPublicBidList(fixture,desc,'2026-11-11T20:00:00Z')
assert.equal(expired.signals.length,0)
assert.equal(expired.structureMatched,true)
const wrong=parseRiversideUnifiedPublicBidList('<table><tr><th>Project</th><th>Name</th></tr><tr><td>Fake</td><td>Accepting Bids</td></tr></table>',desc,observedAt)
assert.equal(wrong.structureMatched,false)
assert.equal(wrong.signals.length,0)
const invalidDate=fixture.replace('11/4/2026 10:00:00 AM','2/31/2026 10:00:00 AM')
assert.equal(parseRiversideUnifiedPublicBidList(invalidDate,desc,observedAt).signals.length,1)
console.log('RUSD school bidder parser: current, closed, duplicates, expiry, provenance and source allowlist PASS')

import assert from 'node:assert/strict'
import {prioritizeNationalProcurementBatch} from './national-procurement-batch.js'
const seed=(id:string)=>({id,state:'CA',buyer:id,publicNoticeUrl:'https://oxnard.gov/notice',
 listedDeadlineLocal:'2026-11-16T14:00:00',localTimeZone:'America/Los_Angeles',
 officialBuyerVerified:true,accessReviewed:false,parserCertified:false,
 fullSolicitationCertified:false,licensedPrimeQualified:false,
 scopeSpecificPartnerConsent:false,firmQuoteVerified:false})
const r=prioritizeNationalProcurementBatch({
 candidates:[seed('Oxnard'),{...seed('Old'),listedDeadlineLocal:'2026-10-20T12:00:00'},
  {...seed('Unverified'),officialBuyerVerified:false},seed('RUSD')],
 asOf:'2026-10-22T19:00:00Z',maxBatch:2})
assert.equal(r.selected.length,2)
assert.equal(r.considered,4)
assert.equal(r.skippedAfterBatch,2)
assert.equal(r.selected[0]?.canEnterManualResearch,true)
assert.equal(r.sourceJobsActivated,0)
assert.equal(r.selected[0]?.publicNoticeUrl,'https://oxnard.gov/notice')
const urgent=prioritizeNationalProcurementBatch({candidates:[
 {...seed('Later'),listedDeadlineLocal:'2026-11-16T14:00:00'},
 {...seed('Earlier'),listedDeadlineLocal:'2026-10-28T14:00:00'}
],asOf:'2026-10-22T19:00:00Z'})
assert.equal(urgent.selected[0]?.id,'Earlier')
assert.equal(r.outreachAuthorized,false)
assert.ok(r.selected.every(x=>x.bidSubmissionAuthorized===false&&x.paymentAuthorized===false))
const expired=prioritizeNationalProcurementBatch({candidates:[{...seed('Old'),listedDeadlineLocal:'2026-10-20T12:00:00'}],asOf:'2026-10-22T19:00:00Z'})
assert.equal(expired.selected[0]?.deadlineState,'past_or_due')
assert.equal(expired.selected[0]?.canEnterManualResearch,false)
const all=prioritizeNationalProcurementBatch({candidates:[{...seed('Hypothetical'),accessReviewed:true,parserCertified:true,
 fullSolicitationCertified:true,licensedPrimeQualified:true,scopeSpecificPartnerConsent:true,firmQuoteVerified:true}],
 asOf:'2026-10-22T19:00:00Z'})
assert.equal(all.selected[0]?.reviewScore,100)
assert.equal(all.selected[0]?.bidReady,false)
assert.equal(all.selected[0]?.sourceFetchAuthorized,false)
assert.throws(()=>prioritizeNationalProcurementBatch({candidates:[seed('one')],asOf:'2026-10-22T19:00:00Z',maxBatch:100}),/1–10/)
console.log('PROCURE.ACTIVATE.24 national research batch and DST-safe cutoff PASS')

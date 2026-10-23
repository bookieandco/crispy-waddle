import test from 'node:test'
import assert from 'node:assert/strict'
import {assessSniperFastlane,orderSniperFastlaneWork} from './sniper-opportunity-clock.js'
const fresh={
 eventObservedAt:'2026-10-22T20:00:00.000Z',
 serverReceivedAt:'2026-10-22T20:00:00.600Z',
 riskEvidenceAvailableAt:'2026-10-22T20:00:00.800Z',
 selectedQuoteAvailableAt:'2026-10-22T20:00:01.000Z',
 entryOrderExpiresAt:'2026-10-22T20:00:05.000Z',
 now:'2026-10-22T20:00:01.050Z',
 hasOpenPosition:false,unresolvedExitAttempt:false,
 policy:{
  maxOpportunityAgeMs:3000,maxProviderToReceiptMs:1500,
  maxRiskEvidenceAgeMs:1000,maxSelectedQuoteAgeMs:350,minOrderRemainingMs:500,
 },
} as const
test('fresh source+verified risk+selected quote+order have one independent entry clock',()=>{
 const r=assessSniperFastlane(fresh)
 assert.equal(r.disposition,'ENTRY_WINDOW_OPEN')
 assert.equal(r.providerToReceiptMs,600)
 assert.equal(r.selectedQuoteAgeMs,50)
 assert.equal(r.orderRemainingMs,3950)
 assert.equal(r.canExecute,false)
 assert.equal(r.canSign,false)
})
test('late provider receipt cannot be laundered by a newer quote',()=>{
 const r=assessSniperFastlane({
  ...fresh,serverReceivedAt:'2026-10-22T20:00:02.000Z',
  now:'2026-10-22T20:00:02.010Z',
  riskEvidenceAvailableAt:'2026-10-22T20:00:02.000Z',
  selectedQuoteAvailableAt:'2026-10-22T20:00:02.000Z',
 })
 assert.equal(r.disposition,'ENTRY_EXPIRED')
 assert.ok(r.reasonCodes.includes('PROVIDER_INGRESS_TOO_LATE'))
})
test('slow chain->risk or old selected quote never reaches a paper entry',()=>{
 assert.ok(assessSniperFastlane({
  ...fresh,now:'2026-10-22T20:00:04.000Z',
 }).reasonCodes.includes('OPPORTUNITY_ENTRY_WINDOW_EXPIRED'))
 const q=assessSniperFastlane({...fresh,selectedQuoteAvailableAt:'2026-10-22T20:00:00.650Z'})
 assert.equal(q.disposition,'ENTRY_EXPIRED')
 assert.ok(q.reasonCodes.includes('SELECTED_ROUTE_QUOTE_EXPIRED'))
})
test('expiration and unknown freshness fail closed without making up a quote',()=>{
 const expired=assessSniperFastlane({...fresh,entryOrderExpiresAt:'2026-10-22T20:00:01.100Z'})
 assert.equal(expired.disposition,'ENTRY_EXPIRED')
 assert.ok(expired.reasonCodes.includes('ENTRY_ORDER_DEADLINE_TOO_CLOSE'))
 const missing=assessSniperFastlane({
  ...fresh,selectedQuoteAvailableAt:undefined,entryOrderExpiresAt:undefined,
 })
 assert.equal(missing.disposition,'REVIEW_MISSING_EVIDENCE')
 assert.equal(missing.canSubmit,false)
})
test('open exposure and unknown exits outrank expired opportunities',()=>{
 const stale={...fresh,now:'2026-10-22T20:01:00.000Z'}
 assert.equal(assessSniperFastlane({...stale,hasOpenPosition:true}).disposition,'EXIT_PRIORITY')
 const unknown=assessSniperFastlane({...stale,unresolvedExitAttempt:true})
 assert.ok(unknown.reasonCodes.includes('RECONCILE_UNRESOLVED_EXIT'))
 assert.equal(unknown.canExecute,false)
})
test('invalid clocks and fake future freshness throw, never relax thresholds',()=>{
 assert.throws(()=>assessSniperFastlane({...fresh,serverReceivedAt:'2026-10-22T19:59:59Z'}),/CHRONOLOGY/)
 assert.throws(()=>assessSniperFastlane({...fresh,selectedQuoteAvailableAt:'2026-10-22T20:00:02Z'}),/QUOTE_CHRONOLOGY/)
 assert.throws(()=>assessSniperFastlane({...fresh,policy:{...fresh.policy,maxSelectedQuoteAgeMs:-1}}),/POLICY/)
})
test('queue prioritizes unresolved exits then exit monitoring, drops old entries only',()=>{
 const now='2026-10-22T20:01:00Z'
 const r=orderSniperFastlaneWork([
  {workId:'stale',kind:'RESEARCH_ENTRY',queuedAt:'2026-10-22T20:00:30Z'},
  {workId:'new',kind:'RESEARCH_ENTRY',queuedAt:'2026-10-22T20:00:59.900Z'},
  {workId:'exit',kind:'MONITOR_EXIT',queuedAt:'2026-10-22T20:00:00Z'},
  {workId:'reconcile',kind:'RECONCILE_EXIT',queuedAt:'2026-10-22T20:00:15Z'},
 ],{now,maxItems:2,maxEntryQueueMs:2000})
 assert.deepEqual(r.ready.map(x=>x.workId),['reconcile','exit'])
 assert.deepEqual(r.deferred,['new'])
 assert.deepEqual(r.expiredEntries,['stale'])
 assert.equal(r.canExecute,false)
})
test('queue never silently discards an exit because its observation is old',()=>{
 const r=orderSniperFastlaneWork([
  {workId:'exit',kind:'MONITOR_EXIT',queuedAt:'2026-10-20T20:00:00Z'},
 ],{now:'2026-10-22T20:00:00Z',maxItems:1,maxEntryQueueMs:0})
 assert.deepEqual(r.ready.map(x=>x.workId),['exit'])
 assert.throws(()=>orderSniperFastlaneWork([
  {workId:'dup',kind:'MONITOR_EXIT',queuedAt:'2026-10-22T20:00:00Z'},
  {workId:'dup',kind:'RESEARCH_ENTRY',queuedAt:'2026-10-22T20:00:00Z'},
 ],{now:'2026-10-22T20:00:00Z',maxItems:2,maxEntryQueueMs:0}),/QUEUE_ID_INVALID/)
})

import {describe,it,expect} from 'vitest'
import {summarizeSniperPaperCoverage} from './sniper-paper-coverage'
import type {SniperPaperMonitorRecord} from './sniper-live-paper-monitor'
const t='2026-10-23T00:00:00Z',later='2026-10-23T00:01:00Z'
const receipt=(workId:string,outcome:SniperPaperMonitorRecord['outcome'],observedAt=t,
 extra:Partial<SniperPaperMonitorRecord>={}):SniperPaperMonitorRecord=>({
 recordId:'sniper-paper:'+workId+':'+observedAt,workId,observedAt,outcome,
 reasonCodes:['read-only-test'],authority:'PAPER_RESEARCH_ONLY',
 canExecute:false,canSign:false,canCreditPurse:false,...extra,
})
describe('CONTINUITY.14 prospective paper denominator',()=>{
 it('preserves expired mints, misses, and outstanding exit reconciliation without claiming live trades',()=>{
  const rows=[
   receipt('exit','EXIT_REVIEW',t,{exitAction:'UNRESOLVED_PREVIOUS_ATTEMPT'}),
   receipt('stale','ENTRY_EXPIRED'),
   receipt('paper','PAPER_RECORDED',t,{paperRunId:'run:paper'}),
   receipt('missing','CHAIN_PROOF_REQUIRED'),
   receipt('exit','EXIT_REVIEW',t,{exitAction:'UNRESOLVED_PREVIOUS_ATTEMPT'}),
  ]
  const view=summarizeSniperPaperCoverage(rows,'2026-10-23T00:01:00Z')
  expect(view.recordedDecisions).toBe(4)
  expect(view.recordedEntryExpired).toBe(1)
  expect(view.recordedMissingProofs).toBe(1)
  expect(view.recordedPaperCycles).toBe(1)
  expect(view.exitWorkIdsNeedingFollowup).toEqual(['exit'])
  expect(view.newestReceiptAgeMs).toBe(60000)
  expect(view.canTrade).toBe(false)
  expect(view.canCreditPurse).toBe(false)
  expect(view.sourceLaunchCoverage).toBe('UNKNOWN')
  expect(view.alwaysOnCertified).toBe(false)
 })
 it('counts only latest decision for same queued work and never rewrites an old result',()=>{
  const r=summarizeSniperPaperCoverage([
   receipt('entry','CHAIN_PROOF_REQUIRED',t),
   receipt('entry','NO_TRADE',later),
  ],'2026-10-23T00:02:00Z')
  expect(r.recordedDecisions).toBe(1)
  expect(r.recordedNoTrades).toBe(1)
  expect(r.recordedMissingProofs).toBe(0)
  expect(r.latestPaperReceiptAt).toBe(later)
 })
 it('rejects incompatible identical receipt replay and future evidence',()=>{
  const base=receipt('a','ENTRY_EXPIRED')
  expect(()=>summarizeSniperPaperCoverage([
   base,{...base,outcome:'PAPER_RECORDED'},
  ],'2026-10-23T00:01:00Z')).toThrow('REPLAY_CONFLICT')
  expect(()=>summarizeSniperPaperCoverage([base],'2026-10-22T23:59:00Z'))
   .toThrow('PROVENANCE_INVALID')
 })
 it('zero records means no source coverage assertion',()=>{
  const empty=summarizeSniperPaperCoverage([],'2026-10-23T00:01:00Z')
  expect(empty.recordedDecisions).toBe(0)
  expect(empty.sourceLaunchCoverage).toBe('UNKNOWN')
  expect(empty.latestPaperReceiptAt).toBeUndefined()
  expect(empty.exitWorkIdsNeedingFollowup).toEqual([])
 })
 it('rejects signatures or purse authority in forged journal view',()=>{
  expect(()=>summarizeSniperPaperCoverage([
   {...receipt('evil','PAPER_RECORDED'),canTrade:true} as unknown as SniperPaperMonitorRecord,
  ],'2026-10-23T00:01:00Z')).toThrow('PROVENANCE_INVALID')
  expect(()=>summarizeSniperPaperCoverage([
   {...receipt('evil','PAPER_RECORDED'),canCreditPurse:true} as unknown as SniperPaperMonitorRecord,
  ],'2026-10-23T00:01:00Z')).toThrow('PROVENANCE_INVALID')
 })
})

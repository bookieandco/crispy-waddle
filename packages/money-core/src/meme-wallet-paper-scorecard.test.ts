import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreMemeWalletPaperSevenDay } from './meme-wallet-paper-scorecard.js'
import type { MemePaperRecovery } from './meme-wallet-paper-scheduler.js'
const days=Array.from({length:7},(_,i)=>new Date(Date.UTC(2026,9,14+i)).toISOString().slice(0,10))
const source=(day:string):MemePaperRecovery=>({
  state:{day,enteredMinor:100n,grossExposureMinor:100n,realizedLossMinor:0n,
    orders:1,unresolvedIds:[],halted:false},
  candidates:2,blocked:1,simulatedFailed:1,simulatedFilled:0,
  simulatedUnknown:0,pending:0,costMinor:5n,realizedProfitMinor:null,
  drawdownBps:null,performanceCertified:false,
  authority:'PAPER_JOURNAL_OBSERVATION_ONLY',canExecute:false,
})
test('seven-day scorecard refuses invented profit, win-rate or drawdown',()=>{
  const out=scoreMemeWalletPaperSevenDay({
    expectedUtcDays:days,recovered:days.map(source),
    independentExitValuationsVerified:true,
    authorizedSourceCoverageVerified:true,
  })
  assert.equal(out.observedDays,7)
  assert.equal(out.recordedSimulatedCostMinor,35n)
  assert.equal(out.simulatedFailed,7)
  assert.equal(out.realizedPnlMinor,null)
  assert.equal(out.drawdownBps,null)
  assert.equal(out.winRate,null)
  assert.equal(out.status,'INCOMPLETE')
  assert.equal(out.canAuthorizeLive,false)
  assert.ok(out.blockers.includes('REALIZED_PNL_AND_DRAWDOWN_NOT_SUPPORTED_BY_JOURNAL'))
})
test('missing days, unresolved entries and unverified source coverage stay explicit',()=>{
  const partial=scoreMemeWalletPaperSevenDay({
    expectedUtcDays:days,
    recovered:[{...source(days[0]!),pending:1,
      state:{...source(days[0]!).state,unresolvedIds:['case:1']}}],
    authorizedSourceCoverageVerified:false,
    independentExitValuationsVerified:false,
  })
  assert.equal(partial.observedDays,1)
  assert.equal(partial.missingDays.length,6)
  assert.ok(partial.blockers.includes('INCOMPLETE_SEVEN_DAY_COVERAGE'))
  assert.ok(partial.blockers.includes('UNRESOLVED_PAPER_OUTCOMES'))
  assert.ok(partial.blockers.includes('SOURCE_COVERAGE_NOT_VERIFIED'))
  assert.ok(partial.blockers.includes('EXIT_VALUATION_NOT_VERIFIED'))
})
test('scorecard rejects duplicate or misbound paper days',()=>{
  assert.throws(()=>scoreMemeWalletPaperSevenDay({
    expectedUtcDays:days,recovered:[source(days[0]!),source(days[0]!)],
    authorizedSourceCoverageVerified:false,independentExitValuationsVerified:false,
  }),/MEME_PAPER_SCORECARD_EVIDENCE_INVALID/)
  assert.throws(()=>scoreMemeWalletPaperSevenDay({
    expectedUtcDays:days.slice(0,6),recovered:[],
    authorizedSourceCoverageVerified:false,independentExitValuationsVerified:false,
  }),/MEME_PAPER_SCORECARD_DAYS_INVALID/)
})

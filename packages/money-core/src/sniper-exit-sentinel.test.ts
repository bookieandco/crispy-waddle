import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateSniperExit,type SniperPositionState,type SniperExitQuote,type SniperExitPolicy} from './sniper-exit-sentinel.js'
const now='2026-10-21T20:00:10Z'
const position:SniperPositionState={
 positionId:'position:1',tokenAddress:'MINT1',entryConfirmedAt:'2026-10-21T20:00:00Z',
 openTokenAmountAtomic:100n,peakReturnBps:100,markedReturnBps:50,
 availableAt:'2026-10-21T20:00:09Z',evidenceIds:['fill:entry'],
}
const policy:SniperExitPolicy={maxHoldSeconds:8,profitTakeBps:300,trailingGivebackBps:200,maxDrawdownBps:400,maxQuoteAgeMs:2000}
const quote:SniperExitQuote={quoteId:'reverse:q1',tokenAddress:'MINT1',sellAmountAtomic:100n,
 quotedAt:'2026-10-21T20:00:09Z',expiresAt:'2026-10-21T20:00:11Z',
 minimumProceedsLamports:1000n,evidenceIds:['rpc:reverse'],verifiedSellPath:true}
test('expired hold creates exit candidate ONLY with verified fresh reverse route',()=>{
 const approved=evaluateSniperExit({position,policy,now,quote})
 assert.equal(approved.action,'EXIT_PAPER_CANDIDATE')
 assert.ok(approved.reasonCodes.includes('MAX_HOLD_EXPIRED'))
 assert.equal(approved.canExecute,false)
 assert.equal(evaluateSniperExit({position,policy,now}).action,'EXIT_ROUTE_MISSING')
})
test('a rug signal never fabricates a realizable exit',()=>{
 const result=evaluateSniperExit({position:{...position,entryConfirmedAt:now},policy,now,rugAction:'EXIT_RECOMMENDED'})
 assert.equal(result.action,'EXIT_ROUTE_MISSING')
 assert.ok(result.reasonCodes.includes('RUG_SENTINEL_EXIT_SIGNAL'))
})
test('unknown settlement blocks duplicate exit attempts',()=>{
 assert.equal(evaluateSniperExit({position,policy,now,quote,unresolvedPreviousExit:true}).action,'UNRESOLVED_PREVIOUS_ATTEMPT')
})
test('full position sell mismatch never counts as verified exit',()=>{
 const result=evaluateSniperExit({position,policy,now,quote:{...quote,sellAmountAtomic:10n}})
 assert.equal(result.action,'EXIT_ROUTE_MISSING')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSniperLatencyReceipt,summarizeSniperLatency,type SniperLatencyStamp} from './sniper-latency-telemetry.js'
const stamp=(stage:SniperLatencyStamp['stage'],monotonicMs:number):SniperLatencyStamp=>({
 stage,monotonicMs,wallClock:'2026-10-21T20:00:00Z',evidenceId:'e:'+stage,
})
test('latency receipt measures stage-to-stage monotonic durations only',()=>{
 const receipt=buildSniperLatencyReceipt('t1',[stamp('EVENT_RECEIVED',10),stamp('QUOTE_READY',410),stamp('SUBMITTED',610)])
 assert.equal(receipt.endToEndMs,600)
 assert.equal(receipt.intervalsMs['EVENT_RECEIVED->QUOTE_READY'],400)
 assert.equal(receipt.scope,'FIRST_TO_LAST_RECORDED_STAGE')
 assert.equal(receipt.canExecute,false)
 assert.equal(summarizeSniperLatency([receipt]).p95Ms,600)
})
test('missing stages are not invented and out-of-order/future-clock regressions reject',()=>{
 assert.throws(()=>buildSniperLatencyReceipt('t',[stamp('QUOTE_READY',10),stamp('EVENT_RECEIVED',20)]),/NONMONOTONIC/)
 assert.throws(()=>buildSniperLatencyReceipt('t',[stamp('EVENT_RECEIVED',30),stamp('LANDED',20)]),/NONMONOTONIC/)
 assert.equal(summarizeSniperLatency([]).p50Ms,undefined)
})

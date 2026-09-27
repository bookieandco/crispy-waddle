import type { ExecutionAttempt } from './execution-attempt.js'
import type { ProviderExecutionEvent } from './execution-receipt-contracts.js'
import type { MoneyFeedEvent,MoneyFeedLane } from './money-feed-contracts.js'

export function buildExecutionMoneyFeedEvent(input:{
 attempt:ExecutionAttempt
 event:ProviderExecutionEvent
 lane:MoneyFeedLane
 route?:string
}):MoneyFeedEvent{
 const {attempt:a,event:e}=input
 if(a.operation!=='money.trade.submit'||a.actionSnapshot.capability!=='money.trade.submit')throw new Error('MONEY_FEED1_EXECUTION_NOT_TRADE')
 if(e.executionId!==a.attemptId||e.actionFingerprint!==a.actionFingerprint)throw new Error('MONEY_FEED1_EXECUTION_BINDING_MISMATCH')
 const instrument=a.actionSnapshot.instrumentId
 if(!instrument)throw new Error('MONEY_FEED1_EXECUTION_INSTRUMENT_REQUIRED')
 const notional=BigInt(a.actionSnapshot.amount)
 if(notional<=0n)throw new Error('MONEY_FEED1_EXECUTION_NOTIONAL_INVALID')
 const side=a.actionSnapshot.side??'BUY'
 const base={eventId:'money-feed:execution:'+e.eventId,userId:a.actionSnapshot.userId,lane:input.lane,subjectId:a.attemptId,route:input.route??'/money/live-operations',occurredAt:e.occurredAt,evidenceIds:Object.freeze([...new Set([...e.evidenceIds,'execution:'+a.attemptId])]),authority:'FEED_EVIDENCE_ONLY' as const,canExecute:false as const}
 if(e.state==='ACKNOWLEDGED'||e.state==='PARTIALLY_FILLED'||e.state==='FILLED'){
  const title=e.state==='FILLED'?side+' '+instrument+' fill recorded':e.state==='PARTIALLY_FILLED'?side+' '+instrument+' partially filled':side+' '+instrument+' order acknowledged'
  const body=e.state==='FILLED'
   ?'Provider fill evidence has been recorded. The amount shown is the bound order notional; settlement and final portfolio state remain separately reconciled.'
   :e.state==='PARTIALLY_FILLED'
    ?'The provider reports a partial fill. The bound order notional remains committed while final fills and settlement are reconciled.'
    :'The provider acknowledged the live order. Capital is committed to a real order, but this is not yet proof of a final fill.'
  return Object.freeze({...base,type:'POSITION_UPDATED' as const,commitment:'COMMITTED' as const,title,body,fundedAmountMinor:notional,currency:a.actionSnapshot.currency,materiality:e.state==='FILLED'?90:e.state==='PARTIALLY_FILLED'?85:75})
 }
 const title=e.state==='UNKNOWN'?'Live execution needs reconciliation':e.state==='REJECTED'?side+' '+instrument+' order rejected':e.state==='CANCELLED'?side+' '+instrument+' order cancelled':side+' '+instrument+' order pending'
 const body=e.state==='UNKNOWN'
  ?'The provider outcome is ambiguous. New conflicting execution must remain blocked until reconciliation resolves it.'
  :'Provider state: '+e.state+'. No funded position is asserted by this feed event.'
 return Object.freeze({...base,type:'PROVIDER_ATTENTION' as const,commitment:e.state==='PENDING'?'WATCHING' as const:'RISK' as const,title,body,materiality:e.state==='UNKNOWN'?95:e.state==='REJECTED'?75:e.state==='CANCELLED'?55:50})
}

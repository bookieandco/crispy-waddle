import type { MoneyFeedEvent,MoneyFeedEventSink } from './money-feed-contracts.js'
import type { SportsPaperWager } from './sports-paper-betting.js'
import type { SportsBetCanaryExecutionResult,SportsBetLiveWagerRequest } from './sports-bet-live-canary.js'

const pct=(n:number)=>(n*100).toFixed(1)+'%'

export function buildSportsSuggestionFeedEvent(input:{
 userId:string
 wager:SportsPaperWager
 route?:string
 materiality?:number
}):MoneyFeedEvent{
 const w=input.wager
 if(w.simulationAuthority!=='PAPER_ONLY'||w.bettingAuthority!=='NONE'||w.financialAuthority!=='NONE'||w.canExecute!==false)throw new Error('MONEY_FEED1_SPORTS_SUGGESTION_AUTHORITY_INVALID')
 return Object.freeze({
  eventId:'money-feed:sports-suggestion:'+w.wagerId,userId:input.userId,type:'OPPORTUNITY_SUGGESTED' as const,lane:'SPORTS' as const,commitment:'SUGGESTED' as const,
  title:'Suggested sports angle · '+w.selectionId,
  body:'Paper model: fair '+pct(w.fairProbability)+' vs implied '+pct(w.impliedProbability)+'; estimated edge '+pct(w.estimatedEdge)+'. Research/simulation only — no money is committed.',
  subjectId:w.eventId,route:input.route??'/worlds/sports',materiality:input.materiality??65,occurredAt:w.placedAt,
  evidenceIds:Object.freeze([...w.evidenceIds]),authority:'FEED_EVIDENCE_ONLY' as const,canExecute:false as const,
 })
}

export function buildSportsLiveCanaryFeedEvent(input:{
 userId:string
 request:SportsBetLiveWagerRequest
 result:SportsBetCanaryExecutionResult
 route?:string
}):MoneyFeedEvent{
 const {request:r,result:x}=input
 if(x.executionId.length===0||r.stakeMinor!==x.stakeMinor||r.currency!==x.currency)throw new Error('MONEY_FEED1_SPORTS_LIVE_BINDING_MISMATCH')
 const base={eventId:'money-feed:sports-live:'+x.executionId,userId:input.userId,lane:'SPORTS' as const,subjectId:r.eventId,route:input.route??'/worlds/sports',occurredAt:r.requestedAt,evidenceIds:Object.freeze([...new Set([...r.quote.evidenceIds,...x.evidenceIds])]),authority:'FEED_EVIDENCE_ONLY' as const,canExecute:false as const}
 if(x.providerState==='ACKNOWLEDGED'){
  return Object.freeze({...base,type:'POSITION_UPDATED' as const,commitment:'COMMITTED' as const,title:'Live wager acknowledged · '+r.selectionId,body:'The sportsbook acknowledged the tiny live canary wager. This is real committed stake; settlement remains separately reconciled.',fundedAmountMinor:r.stakeMinor,currency:r.currency,materiality:90})
 }
 return Object.freeze({...base,type:'PROVIDER_ATTENTION' as const,commitment:'RISK' as const,title:x.providerState==='UNKNOWN'?'Sports wager needs reconciliation':'Sports wager rejected',body:x.providerState==='UNKNOWN'?'Sportsbook outcome is ambiguous. No funded-position assertion is shown until reconciliation resolves the provider state.':'The sportsbook rejected the wager. No committed position is asserted.',materiality:x.providerState==='UNKNOWN'?95:75})
}

export type SportsFeedPublisher=Readonly<{sink:MoneyFeedEventSink;route?:string}>

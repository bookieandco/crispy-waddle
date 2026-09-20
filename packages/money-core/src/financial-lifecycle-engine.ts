import { compareDecimal, parseDecimal, type ExactDecimal, type MoneyAmount } from './exact-money.js'
import type { LotState } from './financial-state-engine.js'
import type { MarketSession } from './market-instrument-contracts.js'

export type LotSelectionPolicy='FIFO'|'LIFO'|'HIFO'|'SPECIFIC_ID'
export type LotDisposition=Readonly<{lotId:string;quantity:ExactDecimal}>
export function selectLotsForDisposition(lots:readonly LotState[],quantityText:string,policy:LotSelectionPolicy,specificIds:readonly string[]=[]):readonly LotDisposition[]{
 let remaining=parseDecimal(quantityText);if(remaining.coefficient<=0n)throw new Error('MONEY_LOT_QUANTITY_INVALID')
 let candidates=[...lots].filter(l=>l.quantity.coefficient>0n)
 if(policy==='FIFO')candidates.sort((a,b)=>a.openedAt.localeCompare(b.openedAt)||a.lotId.localeCompare(b.lotId))
 if(policy==='LIFO')candidates.sort((a,b)=>b.openedAt.localeCompare(a.openedAt)||a.lotId.localeCompare(b.lotId))
 if(policy==='HIFO')candidates.sort((a,b)=>-compareDecimal(a.unitCost,b.unitCost)||a.openedAt.localeCompare(b.openedAt))
 if(policy==='SPECIFIC_ID'){const order=new Map(specificIds.map((id,i)=>[id,i]));candidates=candidates.filter(l=>order.has(l.lotId)).sort((a,b)=>order.get(a.lotId)!-order.get(b.lotId)!)}
 const out:LotDisposition[]=[]
 for(const lot of candidates){if(remaining.coefficient<=0n)break;const s=Math.max(remaining.scale,lot.quantity.scale),r=remaining.coefficient*10n**BigInt(s-remaining.scale),q=lot.quantity.coefficient*10n**BigInt(s-lot.quantity.scale),take=r<q?r:q;out.push(Object.freeze({lotId:lot.lotId,quantity:Object.freeze({coefficient:take,scale:s})}));remaining={coefficient:r-take,scale:s}}
 if(remaining.coefficient!==0n)throw new Error('MONEY_INSUFFICIENT_LOTS')
 return Object.freeze(out)
}

export type CorporateAction=Readonly<{actionId:string;instrumentId:string;type:'DIVIDEND'|'SPLIT'|'REVERSE_SPLIT'|'MERGER'|'SPINOFF'|'SYMBOL_CHANGE'|'DELISTING';effectiveAt:string;availableAt:string;cashAmount?:MoneyAmount;ratio?:string;successorInstrumentId?:string;evidenceRefs:readonly string[];provenanceHash:string}>
export function assertCorporateActionAtCutoff(a:CorporateAction,cutoff:string){if(a.availableAt>cutoff)throw new Error('MONEY_CORPORATE_ACTION_FUTURE_LEAK');if(!a.evidenceRefs.length||!a.provenanceHash)throw new Error('MONEY_CORPORATE_ACTION_UNPROVEN');if((a.type==='SPLIT'||a.type==='REVERSE_SPLIT')&&!a.ratio)throw new Error('MONEY_CORPORATE_ACTION_RATIO_REQUIRED')}

export type BorrowState=Readonly<{instrumentId:string;status:'UNLOCATED'|'LOCATED'|'BORROWED'|'RECALLED'|'UNAVAILABLE'|'UNKNOWN';quantity:string;rate?:string;availableAt:string;evidenceRefs:readonly string[]}>
export function assertShortExecutable(b:BorrowState,cutoff:string){if(b.availableAt>cutoff||b.status!=='BORROWED'||!b.evidenceRefs.length)throw new Error('MONEY_SHORT_BORROW_NOT_VERIFIED')}

export type VenueOperationalState=Readonly<{venue:string;status:'ACCEPTING'|'HALTED'|'DEGRADED'|'CLOSED'|'UNKNOWN';observedAt:string;evidenceRefs:readonly string[]}>
export type BrokerOperationalState=Readonly<{provider:string;venue:string;status:'ACCEPTING'|'REJECTING'|'DEGRADED'|'UNKNOWN';observedAt:string;evidenceRefs:readonly string[]}>
export function assertMarketAcceptingOrders(session:MarketSession,venue:VenueOperationalState,broker:BrokerOperationalState,now:string){if(session.status!=='OPEN'||now<session.opensAt||now>=session.closesAt)throw new Error('MONEY_SESSION_CLOSED');if(venue.status!=='ACCEPTING'||broker.status!=='ACCEPTING')throw new Error('MONEY_MARKET_NOT_ACCEPTING');if(!session.evidenceRefs.length||!venue.evidenceRefs.length||!broker.evidenceRefs.length)throw new Error('MONEY_MARKET_STATE_UNPROVEN')}

export type ExecutionQuality=Readonly<{fillId:string;referenceQuoteId:string;side:'BUY'|'SELL';quotedPrice:MoneyAmount;fillPrice:MoneyAmount;spread?:MoneyAmount;slippage?:MoneyAmount;quoteObservedAt:string;fillExecutedAt:string;methodologyVersion:string;evidenceRefs:readonly string[]}>
export function assertExecutionQuality(q:ExecutionQuality,maxQuoteAgeMs:number){const age=Date.parse(q.fillExecutedAt)-Date.parse(q.quoteObservedAt);if(age<0||age>maxQuoteAgeMs)throw new Error('MONEY_EXECUTION_QUOTE_STALE');if(!q.evidenceRefs.length)throw new Error('MONEY_EXECUTION_QUALITY_UNPROVEN')}

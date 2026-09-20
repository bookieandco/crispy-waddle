import { createHash } from 'node:crypto'
import { addMoney, compareMoney, money, multiplyMoney, parseDecimal, subtractMoney, type ExactDecimal, type MoneyAmount } from './exact-money.js'
import type { OrderState, SettlementState } from './accounting-lifecycle-contracts.js'

export type FinancialEvent =
 | Readonly<{eventId:string;kind:'CASH';accountId:string;effectiveAt:string;recordedAt:string;amount:MoneyAmount;bucket:'SETTLED'|'UNSETTLED'|'RESERVED';evidenceRefs:readonly string[]}>
 | Readonly<{eventId:string;kind:'FILL';accountId:string;effectiveAt:string;recordedAt:string;fillId:string;orderId:string;instrumentId:string;side:'BUY'|'SELL';quantity:string;price:MoneyAmount;fee?:MoneyAmount;evidenceRefs:readonly string[]}>
 | Readonly<{eventId:string;kind:'SETTLEMENT';accountId:string;effectiveAt:string;recordedAt:string;settlementId:string;fillId:string;status:SettlementState;evidenceRefs:readonly string[]}>
 | Readonly<{eventId:string;kind:'CORPORATE_ACTION';accountId:string;effectiveAt:string;recordedAt:string;instrumentId:string;action:'SPLIT'|'REVERSE_SPLIT'|'DIVIDEND'|'MERGER'|'SPINOFF'|'SYMBOL_CHANGE'|'DELISTING';ratio?:string;cashAmount?:MoneyAmount;successorInstrumentId?:string;evidenceRefs:readonly string[]}>
 | Readonly<{eventId:string;kind:'COST';accountId:string;effectiveAt:string;recordedAt:string;costType:'COMMISSION'|'EXCHANGE'|'REGULATORY'|'BORROW'|'FUNDING'|'TAX'|'OTHER';amount:MoneyAmount;evidenceRefs:readonly string[]}>

export type LotState=Readonly<{lotId:string;instrumentId:string;openedAt:string;quantity:ExactDecimal;unitCost:MoneyAmount;sourceFillId:string}>
export type DerivedFinancialState=Readonly<{accountId:string;informationCutoff:string;settledCash:MoneyAmount;unsettledCash:MoneyAmount;reservedCash:MoneyAmount;availableCash:MoneyAmount;positions:Readonly<Record<string,string>>;lots:readonly LotState[];realizedPnl:MoneyAmount;costs:MoneyAmount;sourceEventIds:readonly string[];stateHash:string}>

function hash(value:unknown):string{return createHash('sha256').update(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')}
function requireEvidence(e:FinancialEvent){if(!e.eventId||!e.evidenceRefs.length)throw new Error('MONEY_EVENT_UNPROVEN');if(Date.parse(e.recordedAt)<Date.parse(e.effectiveAt))throw new Error('MONEY_EVENT_CLOCK_INVALID')}
function zero(currency:string){return money(0n,0,currency)}
function qtext(q:ExactDecimal){const sign=q.coefficient<0n?'-':'';const d=(q.coefficient<0n?-q.coefficient:q.coefficient).toString().padStart(q.scale+1,'0');return sign+(q.scale?d.slice(0,-q.scale)+'.'+d.slice(-q.scale):d)}

export function deriveFinancialState(input:{accountId:string;currency:string;informationCutoff:string;events:readonly FinancialEvent[]}):DerivedFinancialState{
 let settled=zero(input.currency),unsettled=zero(input.currency),reserved=zero(input.currency),realized=zero(input.currency),costs=zero(input.currency)
 const qty=new Map<string,ExactDecimal>(),lots:LotState[]=[]
 const events=input.events.filter(e=>e.accountId===input.accountId&&e.recordedAt<=input.informationCutoff).sort((a,b)=>a.effectiveAt.localeCompare(b.effectiveAt)||a.recordedAt.localeCompare(b.recordedAt)||a.eventId.localeCompare(b.eventId))
 const seen=new Set<string>()
 for(const e of events){requireEvidence(e);if(seen.has(e.eventId))throw new Error('MONEY_DUPLICATE_EVENT');seen.add(e.eventId)
  if(e.kind==='CASH'){if(e.amount.currency!==input.currency)throw new Error('MONEY_STATE_CURRENCY_MISMATCH');if(e.bucket==='SETTLED')settled=addMoney(settled,e.amount);else if(e.bucket==='UNSETTLED')unsettled=addMoney(unsettled,e.amount);else reserved=addMoney(reserved,e.amount)}
  if(e.kind==='COST'){costs=addMoney(costs,e.amount);settled=subtractMoney(settled,e.amount)}
  if(e.kind==='FILL'){const q=parseDecimal(e.quantity);const signed=e.side==='BUY'?q:{coefficient:-q.coefficient,scale:q.scale};const prev=qty.get(e.instrumentId)??{coefficient:0n,scale:0};const next=(()=>{const s=Math.max(prev.scale,signed.scale),a=prev.coefficient*10n**BigInt(s-prev.scale),b=signed.coefficient*10n**BigInt(s-signed.scale);return{coefficient:a+b,scale:s}})();qty.set(e.instrumentId,next)
   const notional=multiplyMoney(e.price,q);if(e.side==='BUY'){unsettled=subtractMoney(unsettled,notional);lots.push(Object.freeze({lotId:`lot:${e.fillId}`,instrumentId:e.instrumentId,openedAt:e.effectiveAt,quantity:q,unitCost:e.price,sourceFillId:e.fillId}))}else{unsettled=addMoney(unsettled,notional)}
   if(e.fee){costs=addMoney(costs,e.fee);unsettled=subtractMoney(unsettled,e.fee)}
  }
  if(e.kind==='CORPORATE_ACTION'&&(e.action==='SPLIT'||e.action==='REVERSE_SPLIT')){if(!e.ratio)throw new Error('MONEY_CORPORATE_ACTION_RATIO_REQUIRED');const r=parseDecimal(e.ratio);const p=qty.get(e.instrumentId);if(p)qty.set(e.instrumentId,{coefficient:p.coefficient*r.coefficient,scale:p.scale+r.scale})}
  if(e.kind==='CORPORATE_ACTION'&&e.action==='DIVIDEND'){if(!e.cashAmount)throw new Error('MONEY_DIVIDEND_AMOUNT_REQUIRED');unsettled=addMoney(unsettled,e.cashAmount)}
 }
 const available=subtractMoney(settled,reserved);const positions=Object.freeze(Object.fromEntries([...qty.entries()].map(([k,v])=>[k,qtext(v)])))
 const sourceEventIds=Object.freeze(events.map(e=>e.eventId));const payload={accountId:input.accountId,cutoff:input.informationCutoff,settled,unsettled,reserved,positions,sourceEventIds}
 return Object.freeze({accountId:input.accountId,informationCutoff:input.informationCutoff,settledCash:settled,unsettledCash:unsettled,reservedCash:reserved,availableCash:available,positions,lots:Object.freeze(lots),realizedPnl:realized,costs,sourceEventIds,stateHash:hash(payload)})
}

const allowed:Readonly<Record<OrderState,readonly OrderState[]>>={
 PROPOSED:['AUTHORIZED','REJECTED','CANCELLED'],AUTHORIZED:['SUBMITTED','CANCELLED','EXPIRED'],SUBMITTED:['ACKNOWLEDGED','PARTIALLY_FILLED','FILLED','REJECTED','CANCEL_REQUESTED','BROKER_ERROR','UNKNOWN'],ACKNOWLEDGED:['PARTIALLY_FILLED','FILLED','CANCEL_REQUESTED','EXPIRED','EXTERNALLY_CANCELLED','BROKER_ERROR','UNKNOWN'],PARTIALLY_FILLED:['PARTIALLY_FILLED','FILLED','CANCEL_REQUESTED','EXTERNALLY_CANCELLED','BROKER_ERROR','UNKNOWN'],FILLED:[],REJECTED:[],CANCEL_REQUESTED:['CANCELLED','FILLED','PARTIALLY_FILLED','EXTERNALLY_CANCELLED','UNKNOWN'],CANCELLED:[],EXPIRED:[],EXTERNALLY_CANCELLED:[],BROKER_ERROR:['UNKNOWN'],UNKNOWN:['ACKNOWLEDGED','PARTIALLY_FILLED','FILLED','REJECTED','CANCELLED','EXTERNALLY_CANCELLED','BROKER_ERROR']
}
export function assertOrderTransition(from:OrderState,to:OrderState){if(!allowed[from].includes(to))throw new Error(`MONEY_ORDER_TRANSITION_INVALID:${from}->${to}`)}

export type FxObservation=Readonly<{fxId:string;base:string;quote:string;rate:ExactDecimal;effectiveAt:string;availableAt:string;provider:string;evidenceRefs:readonly string[];provenanceHash:string}>
export function convertMoneyAtCutoff(amount:MoneyAmount,target:string,observations:readonly FxObservation[],cutoff:string):MoneyAmount{if(amount.currency===target)return amount;const candidates=observations.filter(x=>x.base===amount.currency&&x.quote===target&&x.availableAt<=cutoff&&x.evidenceRefs.length&&x.provenanceHash).sort((a,b)=>b.effectiveAt.localeCompare(a.effectiveAt));const fx=candidates[0];if(!fx)throw new Error('MONEY_FX_RATE_UNAVAILABLE');const n=multiplyMoney(amount,fx.rate);return money(n.coefficient,n.scale,target)}

export type LeverageState=Readonly<{equity:MoneyAmount;grossExposure:MoneyAmount;netExposure:MoneyAmount;borrowedCapital:MoneyAmount;initialMarginRequired:MoneyAmount;maintenanceMarginRequired:MoneyAmount;maxLeverage:string}>
export function assertLiveLeveragePolicy(s:LeverageState){if(s.maxLeverage!=='1')throw new Error('MONEY_LIVE_LEVERAGE_DISABLED');if(compareMoney(s.borrowedCapital,zero(s.borrowedCapital.currency))>0)throw new Error('MONEY_LIVE_BORROW_DISABLED')}
export type LiquidationEvent=Readonly<{liquidationId:string;accountId:string;reason:'MARGIN'|'RISK'|'PROVIDER'|'REGULATORY';forced:boolean;instrumentId:string;quantity:string;observedAt:string;evidenceRefs:readonly string[]}>
export function assertLiquidation(e:LiquidationEvent){if(!e.forced||!e.evidenceRefs.length)throw new Error('MONEY_LIQUIDATION_UNPROVEN')}

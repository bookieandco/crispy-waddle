export const MONEY_FEED_LANES=['MONEY','STOCK','FOREX','DEX','CRYPTO','MEME','SPORTS','PREDICTION','METALS'] as const
export type MoneyFeedLane=typeof MONEY_FEED_LANES[number]
export type MoneyFeedCommitment='WATCHING'|'SUGGESTED'|'COMMITTED'|'CLOSED'|'ACCOUNTING'|'RISK'
export type MoneyFeedEventType=
 |'MARKET_WATCH'
 |'LIVE_GAME'
 |'SIMULATION_UPDATE'
 |'OPPORTUNITY_SUGGESTED'
 |'POSITION_OPENED'
 |'POSITION_UPDATED'
 |'POSITION_CLOSED'
 |'PROFIT_SWEEP'
 |'COFFER_STATE_CHANGED'
 |'PROVIDER_ATTENTION'
 |'FUNDING_PROPOSAL'

export type MoneyFeedEvent=Readonly<{
 eventId:string
 userId:string
 type:MoneyFeedEventType
 lane:MoneyFeedLane
 commitment:MoneyFeedCommitment
 title:string
 body:string
 subjectId?:string
 route:string
 fundedAmountMinor?:bigint
 currency?:string
 materiality:number
 occurredAt:string
 evidenceIds:readonly string[]
 authority:'FEED_EVIDENCE_ONLY'
 canExecute:false
}>

export function assertMoneyFeedEvent(e:MoneyFeedEvent){
 if(e.authority!=='FEED_EVIDENCE_ONLY'||e.canExecute!==false)throw new Error('MONEY_FEED1_AUTHORITY_INVALID')
 if(!e.eventId||!e.userId||!e.title||!e.body||!e.route||!e.evidenceIds.length)throw new Error('MONEY_FEED1_FIELDS_REQUIRED')
 if(!MONEY_FEED_LANES.includes(e.lane))throw new Error('MONEY_FEED1_LANE_INVALID')
 if(!Number.isInteger(e.materiality)||e.materiality<0||e.materiality>100)throw new Error('MONEY_FEED1_MATERIALITY_INVALID')
 const funded=e.fundedAmountMinor??0n
 if(funded<0n)throw new Error('MONEY_FEED1_FUNDED_AMOUNT_INVALID')
 if((e.commitment==='COMMITTED'||e.commitment==='CLOSED')&&funded<=0n)throw new Error('MONEY_FEED1_FUNDED_EVIDENCE_REQUIRED')
 if((e.commitment==='WATCHING'||e.commitment==='SUGGESTED')&&funded!==0n)throw new Error('MONEY_FEED1_UNFUNDED_EVENT_HAS_MONEY')
 if(funded>0n&&!e.currency)throw new Error('MONEY_FEED1_CURRENCY_REQUIRED')
}

export function moneyFeedHasCommittedCapital(e:MoneyFeedEvent):boolean{
 assertMoneyFeedEvent(e)
 return e.commitment==='COMMITTED'||e.commitment==='CLOSED'
}

export function moneyFeedSource(e:MoneyFeedEvent):'Money'|'Sports'{
 return e.lane==='SPORTS'?'Sports':'Money'
}


export interface MoneyFeedEventSink{
 publish(event:MoneyFeedEvent):Promise<void>|void
}

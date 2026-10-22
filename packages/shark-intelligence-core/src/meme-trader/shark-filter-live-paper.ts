import type {PublicDexPair,PublicFilterCanary} from './shark-filter-live-public'

export type LiveFilterProspectiveCase=Readonly<{
  caseId:string
  mint:string
  originalPairAddress:string
  entryObservedAt:string
  sealedAt:string
  entryPriceUsd?:number
  originalMarketReceiptId:string
  screenDisposition:'MATCH'|'REVIEW'|'SKIP'|'BLOCKED'|'UNKNOWN_STAGE'
  source:'PUBLIC_READ_ONLY_UNATTESTED'
  authority:'PRICE_OBSERVATION_NOT_PAPER_FILL'
  tradingAllowed:false
}>
export type LiveFilterPriceMark=Readonly<{
  caseId:string
  mint:string
  originalPairAddress:string
  status:'PRICE_ONLY_UNVERIFIED'|'CENSORED_MISSING_OR_WRONG_PAIR'|'OPEN_AWAITING_WINDOW'
  returnFraction?:number
  observedAt?:string
  availableAt?:string
  evidenceIds:readonly string[]
  sellableReturnProven:false
  moneyCorePaperFill:false
  realTrade:false
}>
const moment=(text:string,field:string)=>{
  const n=Date.parse(text)
  if(!text.trim()||!Number.isFinite(n))throw new Error('shark_live_paper_time_invalid:'+field)
  return n
}
export function sealLiveFilterProspectiveCase(input:{
  caseId:string
  canary:PublicFilterCanary
  sealedAt:string
}):LiveFilterProspectiveCase{
  const p=input.canary.pair
  if(!p||!input.caseId.trim()||!p.localReceiptId.trim()||!p.pairAddress.trim())
    throw new Error('shark_live_paper_case_source_required')
  const observed=moment(p.receivedAt,'observed')
  const sealed=moment(input.sealedAt,'sealed')
  if(sealed<observed||sealed-observed>60_000)
    throw new Error('shark_live_paper_not_prospectively_sealed')
  const disp=input.canary.screen?.disposition??'UNKNOWN_STAGE'
  return Object.freeze({
    caseId:input.caseId,mint:p.mint,originalPairAddress:p.pairAddress,
    entryObservedAt:p.receivedAt,sealedAt:input.sealedAt,
    entryPriceUsd:p.priceUsd,originalMarketReceiptId:p.localReceiptId,
    screenDisposition:disp,source:'PUBLIC_READ_ONLY_UNATTESTED',
    authority:'PRICE_OBSERVATION_NOT_PAPER_FILL',tradingAllowed:false,
  })
}
/**
 * Revisit the *original* pair. 24–30h price-only marks are not route-capable
 * buy/sell fills; stale/missing/wrong-pair quotes must remain censored.
 */
export function observeLiveFilterPriceMark(input:{
  study:LiveFilterProspectiveCase
  followup?:PublicDexPair
  evaluatedAt:string
}):LiveFilterPriceMark{
  const {study,followup}=input
  const evaluated=moment(input.evaluatedAt,'evaluated')
  const entry=moment(study.entryObservedAt,'entry')
  const evidenceIds=[study.originalMarketReceiptId]
  const base={
    caseId:study.caseId,mint:study.mint,originalPairAddress:study.originalPairAddress,
    sellableReturnProven:false as const,moneyCorePaperFill:false as const,
    realTrade:false as const,
  }
  if(evaluated-entry<24*3600_000)return Object.freeze({
    ...base,status:'OPEN_AWAITING_WINDOW' as const,evidenceIds:Object.freeze(evidenceIds),
  })
  if(!followup||followup.mint!==study.mint||followup.pairAddress!==study.originalPairAddress)
    return Object.freeze({
      ...base,status:'CENSORED_MISSING_OR_WRONG_PAIR' as const,
      evidenceIds:Object.freeze(evidenceIds),
    })
  const available=moment(followup.receivedAt,'followup')
  if(available>evaluated||available<entry)throw new Error('shark_live_paper_followup_lookahead')
  const hours=(available-entry)/3600_000
  if(hours<24||hours>30)return Object.freeze({
    ...base,status:'CENSORED_MISSING_OR_WRONG_PAIR' as const,
    evidenceIds:Object.freeze([...evidenceIds,followup.localReceiptId]),
  })
  if(!Number.isFinite(study.entryPriceUsd)||study.entryPriceUsd===undefined||
     study.entryPriceUsd<=0||!Number.isFinite(followup.priceUsd)||
     followup.priceUsd===undefined||followup.priceUsd<0)
    return Object.freeze({
      ...base,status:'CENSORED_MISSING_OR_WRONG_PAIR' as const,
      evidenceIds:Object.freeze([...evidenceIds,followup.localReceiptId]),
    })
  return Object.freeze({
    ...base,status:'PRICE_ONLY_UNVERIFIED' as const,
    returnFraction:followup.priceUsd/study.entryPriceUsd-1,
    observedAt:followup.receivedAt,availableAt:followup.receivedAt,
    evidenceIds:Object.freeze([...evidenceIds,followup.localReceiptId]),
  })
}

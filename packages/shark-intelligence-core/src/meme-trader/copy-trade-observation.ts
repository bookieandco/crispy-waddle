export type CopyTradeVenue='PUMPFUN'|'PUMPSWAP'|'RAYDIUM'|'METEORA'|'OTHER'

export type ObservedWalletTrade=Readonly<{
  evidenceId:string
  chainId:string
  walletId:string
  tokenAddress:string
  side:'BUY'|'SELL'
  venue:CopyTradeVenue
  transactionId:string
  observedAt:string
  availableAt:string
  tokenAmountRaw?:string
  quoteAmountRaw?:string
  liquidityQuoteRaw?:string
  creatorAddress?:string
}>

export type CopyTradeSignalTelemetry=Readonly<{
  signalId:string
  evidenceId:string
  walletId:string
  tokenAddress:string
  side:'BUY'|'SELL'
  venue:CopyTradeVenue
  observedAt:string
  availableAt:string
  observationLagMs:number
  timingClass:'SUB_SECOND'|'FAST'|'DELAYED'
  quoteAmountRaw?:string
  tokenAmountRaw?:string
  memoryTier:'KNOWN'
  authority:'EVIDENCE_ONLY'
  canAutoCopy:false
  canAuthorizeTrade:false
}>

const iso=(v:string,c:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(c)}
const raw=(v:string|undefined)=>{if(v!==undefined&&!/^[0-9]+$/.test(v))throw new Error('shark_copy_trade_amount_invalid')}

export function observeWalletTradeSignal(input:ObservedWalletTrade):CopyTradeSignalTelemetry{
  if(!input.evidenceId.trim()||!input.walletId.trim()||!input.tokenAddress.trim()||!input.transactionId.trim())throw new Error('shark_copy_trade_identity_required')
  iso(input.observedAt,'shark_copy_trade_observed_at_invalid');iso(input.availableAt,'shark_copy_trade_available_at_invalid')
  const lag=Date.parse(input.availableAt)-Date.parse(input.observedAt)
  if(lag<0)throw new Error('shark_copy_trade_availability_invalid')
  raw(input.tokenAmountRaw);raw(input.quoteAmountRaw);raw(input.liquidityQuoteRaw)
  const timingClass=lag<1000?'SUB_SECOND':lag<15000?'FAST':'DELAYED'
  return Object.freeze({
    signalId:`copy-signal:${input.chainId}:${input.transactionId}:${input.walletId}`,
    evidenceId:input.evidenceId,walletId:input.walletId,tokenAddress:input.tokenAddress,side:input.side,venue:input.venue,
    observedAt:input.observedAt,availableAt:input.availableAt,observationLagMs:lag,timingClass,quoteAmountRaw:input.quoteAmountRaw,tokenAmountRaw:input.tokenAmountRaw,memoryTier:'KNOWN',authority:'EVIDENCE_ONLY',canAutoCopy:false,canAuthorizeTrade:false,
  })
}

export type CopyTradeResolvedOutcome=Readonly<{
  signalId:string
  resolvedAt:string
  returnBps:number
  evidenceIds:readonly string[]
  memoryTier:'LEARNED'
  authority:'LEARNING_ONLY'
  canAutoCopy:false
}>

export function resolveCopyTradeSignal(input:{
  signal:CopyTradeSignalTelemetry
  resolvedAt:string
  returnBps:number
  evidenceIds:readonly string[]
}):CopyTradeResolvedOutcome{
  iso(input.resolvedAt,'shark_copy_trade_resolution_time_invalid')
  if(Date.parse(input.resolvedAt)<Date.parse(input.signal.availableAt))throw new Error('shark_copy_trade_resolution_before_signal_available')
  if(!Number.isFinite(input.returnBps)||!input.evidenceIds.length)throw new Error('shark_copy_trade_resolution_invalid')
  return Object.freeze({
    signalId:input.signal.signalId,resolvedAt:input.resolvedAt,returnBps:input.returnBps,
    evidenceIds:Object.freeze([...new Set([input.signal.evidenceId,...input.evidenceIds])].sort()),
    memoryTier:'LEARNED',authority:'LEARNING_ONLY',canAutoCopy:false,
  })
}


export type CopyTradeReflexivityAssessment=Readonly<{
  walletId:string
  tokenAddress:string
  buyCount:number
  rapidRepeatBuyCount:number
  smallRepeatBuyCount:number
  sellCount:number
  riskScore:number
  band:'LOW'|'CAUTION'|'HIGH'
  reasons:readonly string[]
  evidenceIds:readonly string[]
  authority:'DEFENSIVE_EVIDENCE_ONLY'
  canAutoCopy:false
  canAuthorizeTrade:false
}>

const bounded=(n:number)=>Math.max(0,Math.min(1,n))
const amount=(v:string|undefined):bigint|undefined=>v===undefined?undefined:BigInt(v)

/**
 * Defensive copy-trade reflexivity check.
 * Repeated rapid buys—especially much smaller adds after an initial buy—can
 * create follower demand without representing fresh independent conviction.
 * This only raises caution; it never labels motive or wrongdoing as fact.
 */
export function assessCopyTradeReflexivity(
  signals:readonly CopyTradeSignalTelemetry[],
  options:Readonly<{rapidWindowMs?:number;smallRepeatFraction?:number}>={},
):CopyTradeReflexivityAssessment{
  if(!signals.length)throw new Error('shark_copy_trade_reflexivity_signals_required')
  const first=signals[0]!
  if(signals.some(signal=>signal.walletId!==first.walletId||signal.tokenAddress!==first.tokenAddress))throw new Error('shark_copy_trade_reflexivity_identity_mismatch')
  const sorted=[...signals].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt))
  const buys=sorted.filter(signal=>signal.side==='BUY')
  const sells=sorted.filter(signal=>signal.side==='SELL')
  const rapidWindowMs=options.rapidWindowMs??60_000
  const smallRepeatFraction=options.smallRepeatFraction??0.25
  if(!Number.isFinite(rapidWindowMs)||rapidWindowMs<0||!Number.isFinite(smallRepeatFraction)||smallRepeatFraction<=0||smallRepeatFraction>1)throw new Error('shark_copy_trade_reflexivity_options_invalid')

  let rapidRepeatBuyCount=0
  let smallRepeatBuyCount=0
  const initial=amount(buys[0]?.quoteAmountRaw)
  for(let i=1;i<buys.length;i++){
    const previous=buys[i-1]!,current=buys[i]!
    if(Date.parse(current.observedAt)-Date.parse(previous.observedAt)<=rapidWindowMs)rapidRepeatBuyCount+=1
    const currentAmount=amount(current.quoteAmountRaw)
    if(initial!==undefined&&currentAmount!==undefined&&Number(currentAmount*10_000n/initial)/10_000<=smallRepeatFraction)smallRepeatBuyCount+=1
  }

  const repeatDenominator=Math.max(1,buys.length-1)
  const rapidRatio=rapidRepeatBuyCount/repeatDenominator
  const smallRatio=smallRepeatBuyCount/repeatDenominator
  const repeatPressure=buys.length<=1?0:Math.min(1,(buys.length-1)/4)
  const riskScore=bounded(0.45*rapidRatio+0.35*smallRatio+0.20*repeatPressure)
  const reasons:string[]=[]
  if(rapidRepeatBuyCount>0)reasons.push('rapid-repeat-buys')
  if(smallRepeatBuyCount>0)reasons.push('small-repeat-buys-after-initial-entry')
  if(buys.length>=4)reasons.push('high-repeat-buy-count')
  const band=riskScore>=0.7?'HIGH':riskScore>=0.35?'CAUTION':'LOW'

  return Object.freeze({
    walletId:first.walletId,
    tokenAddress:first.tokenAddress,
    buyCount:buys.length,
    rapidRepeatBuyCount,
    smallRepeatBuyCount,
    sellCount:sells.length,
    riskScore,
    band,
    reasons:Object.freeze(reasons),
    evidenceIds:Object.freeze([...new Set(sorted.map(signal=>signal.evidenceId))].sort()),
    authority:'DEFENSIVE_EVIDENCE_ONLY',
    canAutoCopy:false,
    canAuthorizeTrade:false,
  })
}

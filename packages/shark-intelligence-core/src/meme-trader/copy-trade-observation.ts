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
  observationLagMs:number
  timingClass:'SUB_SECOND'|'FAST'|'DELAYED'
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
    observationLagMs:lag,timingClass,memoryTier:'KNOWN',authority:'EVIDENCE_ONLY',canAutoCopy:false,canAuthorizeTrade:false,
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
  if(!Number.isFinite(input.returnBps)||!input.evidenceIds.length)throw new Error('shark_copy_trade_resolution_invalid')
  return Object.freeze({
    signalId:input.signal.signalId,resolvedAt:input.resolvedAt,returnBps:input.returnBps,
    evidenceIds:Object.freeze([...new Set([input.signal.evidenceId,...input.evidenceIds])].sort()),
    memoryTier:'LEARNED',authority:'LEARNING_ONLY',canAutoCopy:false,
  })
}

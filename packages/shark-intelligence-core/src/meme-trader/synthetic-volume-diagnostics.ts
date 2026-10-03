export type SyntheticVolumeTrade=Readonly<{
  evidenceId:string
  walletId:string
  side:'BUY'|'SELL'
  observedAt:string
  quoteUsd?:number
  fundingGroupId?:string
}>

export type SyntheticVolumeThresholds=Readonly<{
  minFeeToVolumeRatio?:number
  maxVolumeToLiquidityRatio?:number
  maxRepeatedBuySizeShare?:number
  maxTimingRegularity?:number
  maxCommonFundingGroupShare?:number
  maxMirroredTradeShare?:number
}>

export type SyntheticVolumeDiagnostics=Readonly<{
  sampleSize:number
  feeToVolumeRatio?:number
  volumeToLiquidityRatio?:number
  repeatedBuySizeShare?:number
  timingRegularity?:number
  commonFundingGroupShare?:number
  mirroredTradeShare?:number
  flags:readonly string[]
  coverage:Readonly<{
    fees:boolean
    liquidity:boolean
    buySizes:boolean
    timing:boolean
    funding:boolean
    mirroredFlow:boolean
  }>
  evidenceIds:readonly string[]
  authority:'FORENSIC_EVIDENCE_ONLY'
  canLabelWashTrading:false
  canAuthorizeTrade:false
}>

const unit=(value:number,code:string)=>{
  if(!Number.isFinite(value)||value<0||value>1)throw new Error(code)
}
const nonNegative=(value:number|undefined,code:string)=>{
  if(value!==undefined&&(!Number.isFinite(value)||value<0))throw new Error(code)
}
const iso=(value:string)=>{
  if(!value||Number.isNaN(Date.parse(value)))throw new Error('synthetic_volume_trade_time_invalid')
}
const cv=(values:readonly number[]):number|undefined=>{
  if(values.length<2)return undefined
  const mean=values.reduce((a,b)=>a+b,0)/values.length
  if(mean===0)return 0
  const variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length
  return Math.sqrt(variance)/mean
}
const maxShare=(values:readonly string[]):number|undefined=>{
  if(!values.length)return undefined
  const counts=new Map<string,number>()
  for(const value of values)counts.set(value,(counts.get(value)??0)+1)
  return Math.max(...counts.values())/values.length
}
const roundedSizeKey=(value:number)=>value.toFixed(6)

/**
 * Defensive synthetic-volume diagnostics.
 *
 * This deliberately does NOT encode universal fee/volume or volume/liquidity
 * constants. Those ratios vary by venue, fee schedule and market structure.
 * Optional thresholds must come from a versioned paper/shadow calibration.
 *
 * Likewise, suspicious rhythm or funding concentration is evidence to review,
 * not proof that a natural person or wallet intentionally wash-traded.
 */
export function analyzeSyntheticVolumeEvidence(input:Readonly<{
  trades:readonly SyntheticVolumeTrade[]
  totalVolumeUsd?:number
  totalFeesUsd?:number
  liquidityUsd?:number
  thresholds?:SyntheticVolumeThresholds
}>):SyntheticVolumeDiagnostics{
  if(!input.trades.length)throw new Error('synthetic_volume_trades_required')
  nonNegative(input.totalVolumeUsd,'synthetic_volume_total_volume_invalid')
  nonNegative(input.totalFeesUsd,'synthetic_volume_total_fees_invalid')
  nonNegative(input.liquidityUsd,'synthetic_volume_liquidity_invalid')
  for(const trade of input.trades){
    if(!trade.evidenceId.trim()||!trade.walletId.trim())throw new Error('synthetic_volume_trade_identity_required')
    iso(trade.observedAt)
    nonNegative(trade.quoteUsd,'synthetic_volume_trade_quote_invalid')
  }

  const thresholds=input.thresholds
  if(thresholds){
    for(const [key,value] of Object.entries(thresholds)){
      if(value===undefined)continue
      if(key==='maxVolumeToLiquidityRatio'){
        if(!Number.isFinite(value)||value<0)throw new Error('synthetic_volume_threshold_invalid')
      }else unit(value,'synthetic_volume_threshold_invalid')
    }
  }

  const ordered=[...input.trades].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt))
  const buys=ordered.filter(trade=>trade.side==='BUY'&&trade.quoteUsd!==undefined)
  const buySizeShare=maxShare(buys.map(trade=>roundedSizeKey(trade.quoteUsd!)))

  const intervals:number[]=[]
  for(let i=1;i<ordered.length;i++)intervals.push(Date.parse(ordered[i]!.observedAt)-Date.parse(ordered[i-1]!.observedAt))
  const timingCv=cv(intervals)
  // Regularity is 1 for perfectly equal spacing and trends toward 0 as timing becomes noisier.
  const timingRegularity=timingCv===undefined?undefined:1/(1+timingCv)

  const fundingShare=maxShare(ordered.flatMap(trade=>trade.fundingGroupId?[trade.fundingGroupId]:[]))

  let mirrored=0
  let comparable=0
  for(let i=1;i<ordered.length;i++){
    const previous=ordered[i-1]!,current=ordered[i]!
    if(previous.quoteUsd===undefined||current.quoteUsd===undefined||previous.side===current.side)continue
    comparable++
    const larger=Math.max(previous.quoteUsd,current.quoteUsd)
    const smaller=Math.min(previous.quoteUsd,current.quoteUsd)
    if(larger===0?smaller===0:smaller/larger>=0.98)mirrored++
  }
  const mirroredTradeShare=comparable?mirrored/comparable:undefined

  const feeToVolumeRatio=
    input.totalFeesUsd!==undefined&&input.totalVolumeUsd!==undefined&&input.totalVolumeUsd>0
      ? input.totalFeesUsd/input.totalVolumeUsd
      : undefined
  const volumeToLiquidityRatio=
    input.totalVolumeUsd!==undefined&&input.liquidityUsd!==undefined&&input.liquidityUsd>0
      ? input.totalVolumeUsd/input.liquidityUsd
      : undefined

  const flags:string[]=[]
  if(thresholds?.minFeeToVolumeRatio!==undefined&&feeToVolumeRatio!==undefined&&feeToVolumeRatio<thresholds.minFeeToVolumeRatio)flags.push('fee-to-volume-below-calibrated-floor')
  if(thresholds?.maxVolumeToLiquidityRatio!==undefined&&volumeToLiquidityRatio!==undefined&&volumeToLiquidityRatio>thresholds.maxVolumeToLiquidityRatio)flags.push('volume-to-liquidity-above-calibrated-ceiling')
  if(thresholds?.maxRepeatedBuySizeShare!==undefined&&buySizeShare!==undefined&&buySizeShare>thresholds.maxRepeatedBuySizeShare)flags.push('repeated-buy-size-concentration')
  if(thresholds?.maxTimingRegularity!==undefined&&timingRegularity!==undefined&&timingRegularity>thresholds.maxTimingRegularity)flags.push('transaction-timing-too-regular')
  if(thresholds?.maxCommonFundingGroupShare!==undefined&&fundingShare!==undefined&&fundingShare>thresholds.maxCommonFundingGroupShare)flags.push('common-funding-group-concentration')
  if(thresholds?.maxMirroredTradeShare!==undefined&&mirroredTradeShare!==undefined&&mirroredTradeShare>thresholds.maxMirroredTradeShare)flags.push('mirrored-buy-sell-pattern')

  return Object.freeze({
    sampleSize:ordered.length,
    feeToVolumeRatio,
    volumeToLiquidityRatio,
    repeatedBuySizeShare:buySizeShare,
    timingRegularity,
    commonFundingGroupShare:fundingShare,
    mirroredTradeShare,
    flags:Object.freeze(flags),
    coverage:Object.freeze({
      fees:feeToVolumeRatio!==undefined,
      liquidity:volumeToLiquidityRatio!==undefined,
      buySizes:buySizeShare!==undefined,
      timing:timingRegularity!==undefined,
      funding:fundingShare!==undefined,
      mirroredFlow:mirroredTradeShare!==undefined,
    }),
    evidenceIds:Object.freeze([...new Set(ordered.map(trade=>trade.evidenceId))].sort()),
    authority:'FORENSIC_EVIDENCE_ONLY',
    canLabelWashTrading:false,
    canAuthorizeTrade:false,
  })
}

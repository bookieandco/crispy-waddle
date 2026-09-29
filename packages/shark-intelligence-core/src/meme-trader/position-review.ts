import { planProfitTaking, type ProfitTakingState } from './profit-taking'

export type MemePositionReviewAction='ADD'|'HOLD'|'TRIM'|'EXIT'

export type MemePositionReviewState=ProfitTakingState & {
  incrementalEdgeBps:number
  correlationRiskBps:number
  costBasisUsd?:number
  currentValueUsd?:number
  smartWalletExitScore?:number
  smartWalletNetFlowUsd?:number
  narrativeDegradationScore?:number
  whaleDistributionScore?:number
  whaleNetFlowUsd?:number
  thesisInvalidated?:boolean
  thesisInvalidationReasons?:readonly string[]
  crossDomainAlphaIds?:readonly string[]
}

export type MemePositionReview=Readonly<{
  action:MemePositionReviewAction
  winning:boolean
  pros:readonly string[]
  cons:readonly string[]
  reasonCodes:readonly string[]
  crossDomainAlphaIds:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  financialAuthority:'NONE'
  walletSigningAuthority:'NONE'
  requiresMoneyCoreReview:true
  canExecute:false
}>

const bps=(n:number,c:string)=>{if(!Number.isInteger(n)||n<0||n>10000)throw new Error(c)}
const signedBps=(n:number,c:string)=>{if(!Number.isInteger(n)||n<-10000||n>10000)throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const score=(n:number|undefined,c:string)=>{if(n!==undefined&&(!Number.isFinite(n)||n<0||n>1))throw new Error(c);return n??0}

/**
 * Re-underwrites an already-open meme position.
 *
 * This deliberately does not submit orders or sign wallets. SHARK may say that a
 * winning position still has enough incremental edge to consider adding, or that
 * deteriorating risk/liquidity argues for trimming/exiting. Money Core remains the
 * capital/risk/execution authority.
 */
export function reviewMemePosition(state:MemePositionReviewState,config:{
  minAddEdgeBps?:number
  maxAddRiskBps?:number
  maxCorrelationRiskBps?:number
  minAddThesisBps?:number
  minAddMomentumBps?:number
  minLiquidityUsd?:number
}={}):MemePositionReview{
  signedBps(state.incrementalEdgeBps,'SHARK_POSITION_EDGE_INVALID')
  bps(state.correlationRiskBps,'SHARK_POSITION_CORRELATION_INVALID')
  const smartWalletExitScore=score(state.smartWalletExitScore,'SHARK_POSITION_SMART_WALLET_EXIT_INVALID')
  const narrativeDegradationScore=score(state.narrativeDegradationScore,'SHARK_POSITION_NARRATIVE_DEGRADATION_INVALID')
  const whaleDistributionScore=score(state.whaleDistributionScore,'SHARK_POSITION_WHALE_DISTRIBUTION_INVALID')
  if(state.costBasisUsd!==undefined&&(!Number.isFinite(state.costBasisUsd)||state.costBasisUsd<0))throw new Error('SHARK_POSITION_COST_BASIS_INVALID')
  if(state.smartWalletNetFlowUsd!==undefined&&!Number.isFinite(state.smartWalletNetFlowUsd))throw new Error('SHARK_POSITION_SMART_WALLET_FLOW_INVALID')
  if(state.whaleNetFlowUsd!==undefined&&!Number.isFinite(state.whaleNetFlowUsd))throw new Error('SHARK_POSITION_WHALE_FLOW_INVALID')
  if(state.currentValueUsd!==undefined&&(!Number.isFinite(state.currentValueUsd)||state.currentValueUsd<0))throw new Error('SHARK_POSITION_CURRENT_VALUE_INVALID')
  if(state.thesisInvalidated&&!(state.thesisInvalidationReasons?.length))throw new Error('SHARK_POSITION_INVALIDATION_REASON_REQUIRED')

  const minAddEdgeBps=config.minAddEdgeBps??500
  const maxAddRiskBps=config.maxAddRiskBps??4500
  const maxCorrelationRiskBps=config.maxCorrelationRiskBps??6000
  const minAddThesisBps=config.minAddThesisBps??8000
  const minAddMomentumBps=config.minAddMomentumBps??6500
  for(const [v,c] of [
    [minAddEdgeBps,'SHARK_POSITION_ADD_EDGE_INVALID'],
    [maxAddRiskBps,'SHARK_POSITION_ADD_RISK_INVALID'],
    [maxCorrelationRiskBps,'SHARK_POSITION_ADD_CORRELATION_INVALID'],
    [minAddThesisBps,'SHARK_POSITION_ADD_THESIS_INVALID'],
    [minAddMomentumBps,'SHARK_POSITION_ADD_MOMENTUM_INVALID'],
  ] as const)bps(v,c)

  const winning=state.currentPrice>state.entryPrice
  const roi=state.currentPrice/state.entryPrice-1
  const pros:string[]=[]
  const cons:string[]=[]
  const reasons:string[]=[]
  const alphaIds=unique(state.crossDomainAlphaIds??[])

  if(winning)pros.push(`Position is profitable by ${(roi*100).toFixed(1)}% at the current observed price.`)
  else cons.push('Position is not currently profitable.')
  if(state.incrementalEdgeBps>=minAddEdgeBps)pros.push('Fresh incremental edge remains above the configured add threshold.')
  else cons.push('Fresh incremental edge does not justify increasing exposure.')
  if(state.thesisStrength*10000>=minAddThesisBps)pros.push('Current SHARK thesis evidence remains strong.')
  else cons.push('Thesis strength is below the add threshold.')
  if(state.momentumScore*10000>=minAddMomentumBps)pros.push('Momentum remains supportive.')
  else cons.push('Momentum is not strong enough to justify adding.')
  if(state.correlationRiskBps>maxCorrelationRiskBps)cons.push('Correlated exposure is above the configured concentration limit.')
  if(smartWalletExitScore>=.7)cons.push('Tracked smart wallets are exiting or materially reducing exposure.')
  if(narrativeDegradationScore>=.7)cons.push('The narrative has materially degraded from the entry thesis.')
  if(whaleDistributionScore>=.7)cons.push('Whale distribution risk is elevated.')
  if(state.thesisInvalidated)cons.push('Current evidence explicitly invalidates the position thesis.')
  if(alphaIds.length)pros.push(`${alphaIds.length} cross-domain alpha reference(s) are available as supporting evidence only.`)

  const profitPlan=planProfitTaking(state,{minLiquidityUsd:config.minLiquidityUsd})
  const severeExit=Boolean(state.thesisInvalidated)||state.riskScore>=.9||state.distributionScore>=.9||smartWalletExitScore>=.9||narrativeDegradationScore>=.9||whaleDistributionScore>=.9||((config.minLiquidityUsd??0)>0&&state.liquidityUsd<(config.minLiquidityUsd??0)*.5)

  let action:MemePositionReviewAction='HOLD'
  if(severeExit){
    action='EXIT'
    reasons.push(state.thesisInvalidated?'THESIS_EXPLICITLY_INVALIDATED':'SEVERE_RISK_OR_DISTRIBUTION')
  }else{
    const addEligible=
      state.incrementalEdgeBps>=minAddEdgeBps&&
      state.riskScore*10000<maxAddRiskBps&&
      state.correlationRiskBps<=maxCorrelationRiskBps&&
      state.thesisStrength*10000>=minAddThesisBps&&
      state.momentumScore*10000>=minAddMomentumBps&&
      state.distributionScore<.4&&
      smartWalletExitScore<.4&&
      narrativeDegradationScore<.4&&
      whaleDistributionScore<.4&&
      !state.thesisInvalidated&&
      ((config.minLiquidityUsd??0)===0||state.liquidityUsd>=(config.minLiquidityUsd??0))

    if(addEligible){
      action='ADD'
      reasons.push(winning?'WINNER_STILL_HAS_INCREMENTAL_EDGE':'FRESH_INCREMENTAL_EDGE')
    }else if(profitPlan.remainingPositionFraction<=.25){
      action='EXIT'
      reasons.push('PROFIT_TAKING_PLAN_REDUCES_MOST_EXPOSURE')
    }else if(profitPlan.remainingPositionFraction<1){
      action='TRIM'
      reasons.push('PROFIT_TAKING_OR_RISK_REDUCTION')
    }else{
      reasons.push('HOLD_CURRENT_EXPOSURE')
    }
  }

  for(const reason of profitPlan.reasons){
    if(/deteriorated|distribution|Risk score|weakened|gave back/i.test(reason))cons.push(reason)
    else pros.push(reason)
  }

  return Object.freeze({
    action,
    winning,
    pros:Object.freeze(pros),
    cons:Object.freeze(cons),
    reasonCodes:unique(reasons),
    crossDomainAlphaIds:alphaIds,
    authority:'INTELLIGENCE_ONLY',
    financialAuthority:'NONE',
    walletSigningAuthority:'NONE',
    requiresMoneyCoreReview:true,
    canExecute:false,
  })
}

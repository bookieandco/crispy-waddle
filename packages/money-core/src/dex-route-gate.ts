export type DexRouteProvider='jupiter-swap-v2'|'raydium-direct'|'meteora-direct'

export type DexRouteQuote=Readonly<{
 quoteId:string
 provider:DexRouteProvider
 inputMint:string
 outputMint:string
 inputAmountAtomic:bigint
 quotedOutputAtomic:bigint
 minimumOutputAtomic:bigint
 quotedAt:string
 expiresAt?:string
 priceImpactBps?:number
 feeBps:number
 liquidityMinor?:bigint
 evidenceIds:readonly string[]
 authority:'ROUTE_QUOTE_EVIDENCE_ONLY'
 canExecute:false
}>

export type DexRouteGatePolicy=Readonly<{
 maxQuoteAgeMs:number
 maxSlippageBps:number
 maxPriceImpactBps:number
 maxFeeBps:number
 minLiquidityMinor:bigint
 maxConsecutiveRealizedLosses:number
 allowedProviders:readonly DexRouteProvider[]
 requirePriceImpactEvidence:boolean
 requireLiquidityEvidence:boolean
 authority:'MONEY_DEX_GATE_POLICY'
}>

export type DexRouteGateDecision=Readonly<{
 quoteId:string
 provider:DexRouteProvider
 disposition:'PASS'|'BLOCK'
 reasonCodes:readonly string[]
 observedSlippageBps:number
 observedPriceImpactBps?:number
 quoteAgeMs:number
 evidenceIds:readonly string[]
 authority:'MONEY_DEX_GATE_DECISION'
 canExecute:false
}>

function validIso(value:string):boolean{return Boolean(value.trim())&&!Number.isNaN(Date.parse(value))}
function nonNegativeInt(value:number):boolean{return Number.isInteger(value)&&value>=0}
function unique(values:readonly string[]):readonly string[]{return Object.freeze([...new Set(values)])}

export function computeDexQuoteSlippageBps(quotedOutputAtomic:bigint,minimumOutputAtomic:bigint):number{
 if(quotedOutputAtomic<=0n||minimumOutputAtomic<=0n||minimumOutputAtomic>quotedOutputAtomic)throw new Error('MONEY_DEX_GATE_OUTPUT_RANGE_INVALID')
 return Number(((quotedOutputAtomic-minimumOutputAtomic)*10000n)/quotedOutputAtomic)
}

export function validateDexRouteGatePolicy(policy:DexRouteGatePolicy):void{
 if(policy.authority!=='MONEY_DEX_GATE_POLICY')throw new Error('MONEY_DEX_GATE_POLICY_AUTHORITY_INVALID')
 if(!Number.isInteger(policy.maxQuoteAgeMs)||policy.maxQuoteAgeMs<=0)throw new Error('MONEY_DEX_GATE_QUOTE_AGE_POLICY_INVALID')
 for(const [value,code] of [
  [policy.maxSlippageBps,'MONEY_DEX_GATE_SLIPPAGE_POLICY_INVALID'],
  [policy.maxPriceImpactBps,'MONEY_DEX_GATE_PRICE_IMPACT_POLICY_INVALID'],
  [policy.maxFeeBps,'MONEY_DEX_GATE_FEE_POLICY_INVALID'],
  [policy.maxConsecutiveRealizedLosses,'MONEY_DEX_GATE_LOSS_POLICY_INVALID'],
 ] as const)if(!nonNegativeInt(value))throw new Error(code)
 if(policy.minLiquidityMinor<0n)throw new Error('MONEY_DEX_GATE_LIQUIDITY_POLICY_INVALID')
 if(!policy.allowedProviders.length)throw new Error('MONEY_DEX_GATE_PROVIDER_ALLOWLIST_REQUIRED')
}

export function evaluateDexRouteQuote(input:{
 quote:DexRouteQuote
 policy:DexRouteGatePolicy
 now:string
 consecutiveRealizedLosses:number
 lossHaltActive?:boolean
}):DexRouteGateDecision{
 const {quote:q,policy:p}=input
 validateDexRouteGatePolicy(p)
 if(!validIso(input.now))throw new Error('MONEY_DEX_GATE_NOW_INVALID')
 if(!q.quoteId.trim()||!q.inputMint.trim()||!q.outputMint.trim())throw new Error('MONEY_DEX_GATE_QUOTE_BINDING_REQUIRED')
 if(q.inputMint===q.outputMint)throw new Error('MONEY_DEX_GATE_IDENTICAL_MINTS')
 if(q.authority!=='ROUTE_QUOTE_EVIDENCE_ONLY'||q.canExecute!==false)throw new Error('MONEY_DEX_GATE_QUOTE_AUTHORITY_INVALID')
 if(!validIso(q.quotedAt)||q.expiresAt&&!validIso(q.expiresAt))throw new Error('MONEY_DEX_GATE_QUOTE_TIME_INVALID')
 if(q.inputAmountAtomic<=0n||q.quotedOutputAtomic<=0n||q.minimumOutputAtomic<=0n||q.minimumOutputAtomic>q.quotedOutputAtomic)throw new Error('MONEY_DEX_GATE_AMOUNT_INVALID')
 if(!nonNegativeInt(q.feeBps)||q.priceImpactBps!==undefined&&!nonNegativeInt(q.priceImpactBps))throw new Error('MONEY_DEX_GATE_BPS_INVALID')
 if(q.liquidityMinor!==undefined&&q.liquidityMinor<0n)throw new Error('MONEY_DEX_GATE_LIQUIDITY_INVALID')
 if(!q.evidenceIds.length)throw new Error('MONEY_DEX_GATE_QUOTE_EVIDENCE_REQUIRED')
 if(!nonNegativeInt(input.consecutiveRealizedLosses))throw new Error('MONEY_DEX_GATE_LOSS_OBSERVATION_INVALID')

 const nowMs=Date.parse(input.now),quoteMs=Date.parse(q.quotedAt),age=Math.max(0,nowMs-quoteMs)
 const slippage=computeDexQuoteSlippageBps(q.quotedOutputAtomic,q.minimumOutputAtomic)
 const reasons:string[]=[]
 if(!p.allowedProviders.includes(q.provider))reasons.push('MONEY_DEX_GATE_PROVIDER_NOT_ALLOWED')
 if(nowMs<quoteMs)reasons.push('MONEY_DEX_GATE_FUTURE_QUOTE')
 if(age>p.maxQuoteAgeMs)reasons.push('MONEY_DEX_GATE_STALE_QUOTE')
 if(q.expiresAt&&nowMs>=Date.parse(q.expiresAt))reasons.push('MONEY_DEX_GATE_QUOTE_EXPIRED')
 if(slippage>p.maxSlippageBps)reasons.push('MONEY_DEX_GATE_SLIPPAGE_CEILING')
 if(p.requirePriceImpactEvidence&&q.priceImpactBps===undefined)reasons.push('MONEY_DEX_GATE_PRICE_IMPACT_EVIDENCE_REQUIRED')
 if(q.priceImpactBps!==undefined&&q.priceImpactBps>p.maxPriceImpactBps)reasons.push('MONEY_DEX_GATE_PRICE_IMPACT_CEILING')
 if(q.feeBps>p.maxFeeBps)reasons.push('MONEY_DEX_GATE_FEE_CEILING')
 if(p.requireLiquidityEvidence&&q.liquidityMinor===undefined)reasons.push('MONEY_DEX_GATE_LIQUIDITY_EVIDENCE_REQUIRED')
 if(q.liquidityMinor!==undefined&&q.liquidityMinor<p.minLiquidityMinor)reasons.push('MONEY_DEX_GATE_MINIMUM_LIQUIDITY')
 if(input.lossHaltActive||input.consecutiveRealizedLosses>=p.maxConsecutiveRealizedLosses)reasons.push('MONEY_DEX_GATE_CONSECUTIVE_LOSS_HALT')
 const uniqueReasons=unique(reasons)
 return Object.freeze({
  quoteId:q.quoteId,provider:q.provider,
  disposition:uniqueReasons.length?'BLOCK':'PASS',
  reasonCodes:uniqueReasons,
  observedSlippageBps:slippage,
  observedPriceImpactBps:q.priceImpactBps,
  quoteAgeMs:age,
  evidenceIds:unique([...q.evidenceIds,'money-dex-gate:'+q.quoteId]),
  authority:'MONEY_DEX_GATE_DECISION' as const,
  canExecute:false as const,
 })
}

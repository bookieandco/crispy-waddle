export type SupportedClusterChain='SOLANA'|'BASE'|'EVM'

export type CrossChainSwapObservation=Readonly<{
  evidenceId:string
  chain:SupportedClusterChain
  transactionId:string
  walletAddress:string
  tokenIn:string
  tokenOut:string
  amountInRaw:string
  amountOutRaw:string
  tokenInDecimals:number
  tokenOutDecimals:number
  observedAt:string
  availableAt:string
  source:string
}>

export type NormalizedClusterSwap=Readonly<{
  evidenceId:string
  chain:SupportedClusterChain
  transactionId:string
  walletId:string
  tokenInId:string
  tokenOutId:string
  amountInRaw:string
  amountOutRaw:string
  amountInDecimal:string
  amountOutDecimal:string
  observedAt:string
  availableAt:string
  source:string
  authority:'EVIDENCE_ONLY'
}>

const iso=(v:string,c:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(c)}
const decimalAmount=(raw:string,decimals:number):string=>{
  if(!/^[0-9]+$/.test(raw)||!Number.isInteger(decimals)||decimals<0||decimals>30)throw new Error('shark_cluster_amount_invalid')
  if(decimals===0)return raw
  const padded=raw.padStart(decimals+1,'0')
  const whole=padded.slice(0,-decimals)
  const fraction=padded.slice(-decimals).replace(/0+$/,'')
  return fraction?`${whole}.${fraction}`:whole
}
const evm=(v:string)=>/^0x[0-9a-fA-F]{40}$/.test(v)
const sol=(v:string)=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)
const address=(chain:SupportedClusterChain,v:string):string=>{
  if(chain==='SOLANA'){if(!sol(v))throw new Error('shark_cluster_solana_address_invalid');return v}
  if(!evm(v))throw new Error('shark_cluster_evm_address_invalid')
  return v.toLowerCase()
}

export function normalizeCrossChainSwapObservation(input:CrossChainSwapObservation):NormalizedClusterSwap{
  if(!input.evidenceId.trim()||!input.transactionId.trim()||!input.source.trim())throw new Error('shark_cluster_observation_identity_required')
  iso(input.observedAt,'shark_cluster_observed_at_invalid');iso(input.availableAt,'shark_cluster_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('shark_cluster_availability_invalid')
  const wallet=address(input.chain,input.walletAddress)
  const tokenIn=address(input.chain,input.tokenIn)
  const tokenOut=address(input.chain,input.tokenOut)
  return Object.freeze({
    evidenceId:input.evidenceId,chain:input.chain,transactionId:input.transactionId,
    walletId:`${input.chain.toLowerCase()}:${wallet}`,
    tokenInId:`${input.chain.toLowerCase()}:${tokenIn}`,
    tokenOutId:`${input.chain.toLowerCase()}:${tokenOut}`,
    amountInRaw:input.amountInRaw,amountOutRaw:input.amountOutRaw,
    amountInDecimal:decimalAmount(input.amountInRaw,input.tokenInDecimals),
    amountOutDecimal:decimalAmount(input.amountOutRaw,input.tokenOutDecimals),
    observedAt:input.observedAt,availableAt:input.availableAt,source:input.source,authority:'EVIDENCE_ONLY',
  })
}

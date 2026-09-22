export type WalletClusterChainFamily='SOLANA'|'EVM'

export type WalletClusterSwapObservation=Readonly<{
  observationId:string
  chainId:string
  chainFamily:WalletClusterChainFamily
  walletAddress:string
  tokenAddress:string
  side:'BUY'|'SELL'
  amountUsd?:number
  transactionId:string
  observedAt:string
  availableAt:string
  source:string
  sourceGroup:string
  evidenceIds:readonly string[]
}>

export type NormalizedWalletClusterSwap=Readonly<{
  observationId:string
  chainId:string
  chainFamily:WalletClusterChainFamily
  walletId:string
  tokenId:string
  side:'BUY'|'SELL'
  amountUsd?:number
  transactionId:string
  observedAt:string
  availableAt:string
  source:string
  sourceGroup:string
  evidenceIds:readonly string[]
  authority:'RESEARCH_ONLY'
}>

const BASE58=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const EVM=/^0x[0-9a-fA-F]{40}$/
const assertIso=(value:string,code:string)=>{if(!value||Number.isNaN(Date.parse(value)))throw new Error(code)}

export function normalizeWalletClusterAddress(input:{chainFamily:WalletClusterChainFamily;address:string}):string{
  const address=input.address.trim()
  if(input.chainFamily==='EVM'){
    if(!EVM.test(address))throw new Error('shark_cluster_evm_address_invalid')
    return address.toLowerCase()
  }
  if(!BASE58.test(address))throw new Error('shark_cluster_solana_address_invalid')
  return address
}

export function normalizeWalletClusterSwap(input:WalletClusterSwapObservation):NormalizedWalletClusterSwap{
  if(!input.observationId.trim()||!input.chainId.trim()||!input.transactionId.trim()||!input.source.trim()||!input.sourceGroup.trim()||!input.evidenceIds.length){
    throw new Error('shark_cluster_swap_identity_incomplete')
  }
  assertIso(input.observedAt,'shark_cluster_swap_observed_at_invalid')
  assertIso(input.availableAt,'shark_cluster_swap_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('shark_cluster_swap_availability_invalid')
  if(input.amountUsd!==undefined&&(!Number.isFinite(input.amountUsd)||input.amountUsd<0))throw new Error('shark_cluster_swap_amount_invalid')
  const wallet=normalizeWalletClusterAddress({chainFamily:input.chainFamily,address:input.walletAddress})
  const token=normalizeWalletClusterAddress({chainFamily:input.chainFamily,address:input.tokenAddress})
  return Object.freeze({
    observationId:input.observationId,
    chainId:input.chainId,
    chainFamily:input.chainFamily,
    walletId:`${input.chainId}:${wallet}`,
    tokenId:`${input.chainId}:${token}`,
    side:input.side,
    amountUsd:input.amountUsd,
    transactionId:input.transactionId,
    observedAt:input.observedAt,
    availableAt:input.availableAt,
    source:input.source,
    sourceGroup:input.sourceGroup,
    evidenceIds:Object.freeze([...new Set(input.evidenceIds)].sort()),
    authority:'RESEARCH_ONLY',
  })
}

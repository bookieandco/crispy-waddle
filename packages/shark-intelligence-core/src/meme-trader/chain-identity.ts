export type ChainIdentityFamily='SOLANA'|'EVM'|'UNKNOWN'

const EVM_CHAIN_NAMES=new Set([
  'ethereum','ethereum-mainnet','eth','eth-mainnet',
  'base','base-mainnet',
  'optimism','optimism-mainnet',
  'arbitrum','arbitrum-one',
  'polygon','polygon-mainnet',
  'robinhood','robinhood-mainnet','robinhood-chain','robinhood-chain-mainnet','robinhood-testnet','robinhood-chain-testnet',
])
const EVM_NUMERIC_CHAIN_IDS=new Set(['1','10','137','8453','42161','4663','46630'])

export function chainIdentityFamily(chainId:string):ChainIdentityFamily{
  const value=chainId.trim().toLowerCase()
  if(!value) return 'UNKNOWN'
  if(value.includes('solana')) return 'SOLANA'
  if(value.startsWith('eip155:')||EVM_CHAIN_NAMES.has(value)||EVM_NUMERIC_CHAIN_IDS.has(value)) return 'EVM'
  return 'UNKNOWN'
}

export function normalizeChainAddress(chainId:string,address:string):string{
  const value=address.trim()
  if(!value)throw new Error('chain_identity_address_required')
  const family=chainIdentityFamily(chainId)
  if(family==='EVM'){
    if(!/^0x[0-9a-fA-F]{40}$/.test(value))throw new Error('chain_identity_evm_address_invalid')
    return value.toLowerCase()
  }
  // Solana/base58 identities are case-sensitive. Unknown chains remain exact
  // rather than guessing a normalization rule that can merge unrelated actors.
  return value
}

export function canonicalWalletNodeId(chainId:string,walletAddress:string):string{
  return `wallet:${normalizeChainAddress(chainId,walletAddress)}`
}

export function canonicalTokenNodeId(chainId:string,tokenAddress:string):string{
  return `token:${chainId.trim()}:${normalizeChainAddress(chainId,tokenAddress)}`
}

export function sameChainAddress(chainId:string,a:string,b:string):boolean{
  return normalizeChainAddress(chainId,a)===normalizeChainAddress(chainId,b)
}

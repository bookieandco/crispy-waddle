import { chainIdentityFamily, normalizeChainAddress } from './chain-identity'

export type EvmTokenControlObservation=Readonly<{
  evidenceId:string
  chainId:string
  tokenAddress:string
  observedAt:string
  availableAt:string
  ownerAddress?:string
  totalSupplyRaw?:string
  decimals?:number
  mintFunctionPresent:'YES'|'NO'|'UNKNOWN'
  mintAuthorityModel:'OWNER_ONLY'|'ROLE_BASED'|'NONE'|'UNKNOWN'
  source:string
}>

export type EvmTokenControlRisk=Readonly<{
  chainId:string
  tokenAddress:string
  ownerAddress?:string
  ownerRenounced:'YES'|'NO'|'UNKNOWN'
  ownerControlledMint:'YES'|'NO'|'UNKNOWN'
  riskFlags:readonly string[]
  evidenceIds:readonly string[]
  observedAt:string
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

const zero='0x0000000000000000000000000000000000000000'
const iso=(v:string,c:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(c)}

export function assessEvmTokenControl(input:EvmTokenControlObservation):EvmTokenControlRisk{
  if(chainIdentityFamily(input.chainId)!=='EVM')throw new Error('shark_evm_token_control_chain_invalid')
  if(!input.evidenceId.trim()||!input.source.trim())throw new Error('shark_evm_token_control_evidence_required')
  iso(input.observedAt,'shark_evm_token_control_observed_at_invalid');iso(input.availableAt,'shark_evm_token_control_available_at_invalid')
  if(Date.parse(input.availableAt)<Date.parse(input.observedAt))throw new Error('shark_evm_token_control_availability_invalid')
  const tokenAddress=normalizeChainAddress(input.chainId,input.tokenAddress)
  const ownerAddress=input.ownerAddress?normalizeChainAddress(input.chainId,input.ownerAddress):undefined
  if(input.totalSupplyRaw!==undefined&&!/^[0-9]+$/.test(input.totalSupplyRaw))throw new Error('shark_evm_token_control_supply_invalid')
  if(input.decimals!==undefined&&(!Number.isInteger(input.decimals)||input.decimals<0||input.decimals>30))throw new Error('shark_evm_token_control_decimals_invalid')
  const ownerRenounced=ownerAddress===undefined?'UNKNOWN':ownerAddress===zero?'YES':'NO'
  const ownerControlledMint=input.mintFunctionPresent==='NO'||input.mintAuthorityModel==='NONE'?'NO':
    input.mintFunctionPresent==='YES'&&input.mintAuthorityModel==='OWNER_ONLY'&&ownerRenounced==='NO'?'YES':'UNKNOWN'
  const riskFlags:string[]=[]
  if(ownerControlledMint==='YES')riskFlags.push('OWNER_CONTROLLED_MINT')
  if(input.mintFunctionPresent==='YES'&&input.mintAuthorityModel==='UNKNOWN')riskFlags.push('MINT_AUTHORITY_UNRESOLVED')
  if(ownerRenounced==='NO')riskFlags.push('OWNER_PRIVILEGES_PRESENT')
  if(input.totalSupplyRaw===undefined)riskFlags.push('SUPPLY_UNRESOLVED')
  return Object.freeze({
    chainId:input.chainId,tokenAddress,ownerAddress,ownerRenounced,ownerControlledMint,
    riskFlags:Object.freeze(riskFlags),evidenceIds:Object.freeze([input.evidenceId]),observedAt:input.observedAt,
    authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
  })
}

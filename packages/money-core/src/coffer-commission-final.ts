import { createHash } from 'node:crypto'
import type { ConnectedWallet } from './wallet-connector-contracts.js'
import type { SignerLease,SignerLeasePolicy } from './signer-lease-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export const COFFER_COMMISSION_VERSION='COFFER-COMMISSION-v1' as const
export type CofferEvidenceClass='REAL_LIVE'|'SYNTHETIC_TEST'

export type CofferCommissionPolicy=Readonly<{
 minFeeReserveLamports:bigint
 minCanaryFundingLamports:bigint
 maxObservationAgeMs:number
}>

export type CofferSignerProbeReceipt=Readonly<{
 signerEndpoint:string
 signerCredentialRef:string
 reachable:boolean
 signerAddress:string
 network:'SOLANA'
 containsPrivateKey:false
 containsRawToken:false
 observedAt:string
 evidenceIds:readonly string[]
 authority:'SIGNER_PROBE_ONLY'
 canSign:false
}>

export type CofferWalletBalanceReceipt=Readonly<{
 walletAddress:string
 balanceLamports:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'CHAIN_BALANCE_EVIDENCE_ONLY'
 canMoveFunds:false
}>

export type CofferCommissionEvidence=Readonly<{
 evidenceClass:CofferEvidenceClass
 signer:CofferSignerProbeReceipt
 balance:CofferWalletBalanceReceipt
 evidenceIds:readonly string[]
}>

export type CofferCommissionFinalReport=Readonly<{
 reportId:string
 version:typeof COFFER_COMMISSION_VERSION
 status:'SOFTWARE_READY_EXTERNAL_COMMISSION_REQUIRED'|'COFFER_COMMISSIONED'
 passed:boolean
 softwareReady:true
 operationalEvidence:boolean
 walletConnectionId:string
 walletAddress:string
 observedBalanceLamports:bigint
 requiredBalanceLamports:bigint
 fundingShortfallLamports:bigint
 blockerCodes:readonly string[]
 evidenceIds:readonly string[]
 unrestrictedLiveAuthorized:false
 authority:'CERTIFICATION_ONLY'
 canMoveFunds:false
}>

function hash(value:unknown):string{
 return createHash('sha256').update(JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
}
function validIso(value:string):boolean{return Boolean(value.trim())&&!Number.isNaN(Date.parse(value))}
function unique(values:readonly string[]):readonly string[]{return Object.freeze([...new Set(values)].sort())}

export function certifyCofferCommissionFinal(input:{
 wallet:ConnectedWallet
 signerPolicy:SignerLeasePolicy
 signerLease:SignerLease
 policy:CofferCommissionPolicy
 evidence:CofferCommissionEvidence
 now:string
}):CofferCommissionFinalReport{
 const {wallet,signerPolicy,signerLease,policy,evidence}=input
 const blockers:string[]=[]
 const nowMs=Date.parse(input.now)
 if(Number.isNaN(nowMs))throw new Error('COFFER_COMMISSION_NOW_INVALID')
 if(policy.minFeeReserveLamports<0n||policy.minCanaryFundingLamports<=0n||!Number.isInteger(policy.maxObservationAgeMs)||policy.maxObservationAgeMs<=0)throw new Error('COFFER_COMMISSION_POLICY_INVALID')
 if(wallet.mode!=='COFFER_EXECUTION_WALLET'||wallet.network!=='SOLANA'||wallet.canSign!==false||wallet.authority!=='CONNECTION_ONLY')blockers.push('COFFER_ISOLATED_SOLANA_WALLET_REQUIRED')
 if(!wallet.address.trim()||!wallet.connectionId.trim()||!wallet.evidenceIds.length)blockers.push('COFFER_WALLET_EVIDENCE_REQUIRED')
 if(signerPolicy.walletConnectionId!==wallet.connectionId||signerLease.walletConnectionId!==wallet.connectionId)blockers.push('COFFER_SIGNER_WALLET_BINDING_MISMATCH')
 if(signerLease.state!=='ACTIVE'||signerLease.containsPrivateKey!==false||signerLease.containsRawToken!==false||!signerLease.tokenFingerprint.trim())blockers.push('COFFER_ACTIVE_SECRET_FREE_SIGNER_LEASE_REQUIRED')
 if(!evidence.signer.signerEndpoint.startsWith('https://'))blockers.push('COFFER_SIGNER_HTTPS_REQUIRED')
 if(!evidence.signer.signerCredentialRef.trim())blockers.push('COFFER_SIGNER_CREDENTIAL_REFERENCE_REQUIRED')
 if(!evidence.signer.reachable)blockers.push('COFFER_REMOTE_SIGNER_NOT_REACHABLE')
 if(evidence.signer.signerAddress!==wallet.address||evidence.signer.network!=='SOLANA')blockers.push('COFFER_REMOTE_SIGNER_IDENTITY_MISMATCH')
 if(evidence.signer.containsPrivateKey!==false||evidence.signer.containsRawToken!==false||evidence.signer.canSign!==false)blockers.push('COFFER_SIGNER_SECRET_EXPOSURE_FORBIDDEN')
 if(evidence.balance.walletAddress!==wallet.address)blockers.push('COFFER_BALANCE_WALLET_MISMATCH')
 if(evidence.balance.balanceLamports<0n)blockers.push('COFFER_BALANCE_INVALID')
 for(const [observedAt,code] of [[evidence.signer.observedAt,'COFFER_SIGNER_OBSERVATION_INVALID'],[evidence.balance.observedAt,'COFFER_BALANCE_OBSERVATION_INVALID']] as const){
  if(!validIso(observedAt)){blockers.push(code);continue}
  const age=nowMs-Date.parse(observedAt)
  if(age<0||age>policy.maxObservationAgeMs)blockers.push(code.replace('_INVALID','_STALE'))
 }
 if(!evidence.signer.evidenceIds.length||!evidence.balance.evidenceIds.length||!evidence.evidenceIds.length)blockers.push('COFFER_COMMISSION_EVIDENCE_REQUIRED')
 if(evidence.evidenceClass!=='REAL_LIVE')blockers.push('COFFER_REAL_LIVE_EVIDENCE_REQUIRED')
 const required=policy.minFeeReserveLamports+policy.minCanaryFundingLamports
 const shortfall=evidence.balance.balanceLamports>=required?0n:required-evidence.balance.balanceLamports
 if(shortfall>0n)blockers.push('COFFER_EXECUTION_WALLET_FUNDING_REQUIRED')
 const blockerCodes=unique(blockers)
 const evidenceIds=unique([...wallet.evidenceIds,...evidence.signer.evidenceIds,...evidence.balance.evidenceIds,...evidence.evidenceIds])
 const passed=blockerCodes.length===0
 return Object.freeze({
  reportId:'coffer-commission:'+hash({
   version:COFFER_COMMISSION_VERSION,walletConnectionId:wallet.connectionId,signerLeaseId:signerLease.leaseId,
   signerEndpoint:evidence.signer.signerEndpoint,balanceLamports:evidence.balance.balanceLamports.toString(),
   required:required.toString(),evidenceClass:evidence.evidenceClass,blockerCodes,evidenceIds,
  }),
  version:COFFER_COMMISSION_VERSION,
  status:passed?'COFFER_COMMISSIONED' as const:'SOFTWARE_READY_EXTERNAL_COMMISSION_REQUIRED' as const,
  passed,
  softwareReady:true as const,
  operationalEvidence:passed&&evidence.evidenceClass==='REAL_LIVE',
  walletConnectionId:wallet.connectionId,
  walletAddress:wallet.address,
  observedBalanceLamports:evidence.balance.balanceLamports,
  requiredBalanceLamports:required,
  fundingShortfallLamports:shortfall,
  blockerCodes,
  evidenceIds,
  unrestrictedLiveAuthorized:false as const,
  authority:'CERTIFICATION_ONLY' as const,
  canMoveFunds:false as const,
 })
}

export type RemoteCofferSignerHealthProbeOptions=Readonly<{
 baseUrl:string
 signerCredentialRef:string
 resolveAuthorizationHeader?:()=>Promise<string|undefined>|string|undefined
 fetchFn?:FetchLike
 healthPath?:string
}>

function row(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('COFFER_SIGNER_PROBE_RESPONSE_INVALID')
 return value as Record<string,unknown>
}

export class RemoteCofferSignerHealthProbe{
 private readonly baseUrl:string
 private readonly fetchFn:FetchLike
 private readonly healthPath:string
 constructor(private readonly options:RemoteCofferSignerHealthProbeOptions){
  this.baseUrl=options.baseUrl.replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('COFFER_SIGNER_HTTPS_REQUIRED')
  if(!options.signerCredentialRef.trim())throw new Error('COFFER_SIGNER_CREDENTIAL_REFERENCE_REQUIRED')
  this.fetchFn=options.fetchFn??fetch
  this.healthPath=options.healthPath??'/v1/health'
  if(!this.healthPath.startsWith('/')||this.healthPath.includes('..'))throw new Error('COFFER_SIGNER_HEALTH_PATH_INVALID')
 }
 async probe(now:string):Promise<CofferSignerProbeReceipt>{
  if(!validIso(now))throw new Error('COFFER_SIGNER_PROBE_TIME_INVALID')
  const authorization=await this.options.resolveAuthorizationHeader?.()
  const response=await this.fetchFn(this.baseUrl+this.healthPath,{method:'GET',headers:{accept:'application/json',...(authorization?{authorization}:{})}})
  if(!response.ok)throw new Error('COFFER_SIGNER_PROBE_HTTP_'+response.status)
  const value=row(await response.json())
  if(value.ok!==true)throw new Error('COFFER_SIGNER_PROBE_NOT_READY')
  const signerAddress=typeof value.signerAddress==='string'?value.signerAddress:''
  const evidenceId=typeof value.evidenceId==='string'?value.evidenceId:''
  if(!signerAddress.trim()||!evidenceId.trim())throw new Error('COFFER_SIGNER_PROBE_IDENTITY_REQUIRED')
  if(value.network!=='SOLANA')throw new Error('COFFER_SIGNER_PROBE_NETWORK_INVALID')
  if(value.containsPrivateKey!==false||value.containsRawToken!==false)throw new Error('COFFER_SIGNER_SECRET_EXPOSURE_FORBIDDEN')
  return Object.freeze({
   signerEndpoint:this.baseUrl,
   signerCredentialRef:this.options.signerCredentialRef,
   reachable:true,
   signerAddress,
   network:'SOLANA' as const,
   containsPrivateKey:false as const,
   containsRawToken:false as const,
   observedAt:now,
   evidenceIds:Object.freeze([evidenceId]),
   authority:'SIGNER_PROBE_ONLY' as const,
   canSign:false as const,
  })
 }
}

export type SolanaCofferBalanceProbeOptions=Readonly<{
 resolveRpcEndpoint:()=>Promise<string>|string
 fetchFn?:FetchLike
}>

export class SolanaCofferBalanceProbe{
 private readonly fetchFn:FetchLike
 constructor(private readonly options:SolanaCofferBalanceProbeOptions){this.fetchFn=options.fetchFn??fetch}
 async probe(walletAddress:string,now:string):Promise<CofferWalletBalanceReceipt>{
  if(!walletAddress.trim())throw new Error('COFFER_BALANCE_WALLET_REQUIRED')
  if(!validIso(now))throw new Error('COFFER_BALANCE_TIME_INVALID')
  const endpoint=await this.options.resolveRpcEndpoint()
  if(!endpoint.startsWith('https://'))throw new Error('COFFER_BALANCE_RPC_HTTPS_REQUIRED')
  const response=await this.fetchFn(endpoint,{
   method:'POST',headers:{'content-type':'application/json',accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getBalance',params:[walletAddress,{commitment:'confirmed'}]}),
  })
  if(!response.ok)throw new Error('COFFER_BALANCE_RPC_HTTP_'+response.status)
  const payload=row(await response.json())
  if(payload.error)throw new Error('COFFER_BALANCE_RPC_ERROR')
  const result=row(payload.result)
  const value=result.value
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new Error('COFFER_BALANCE_RPC_RESPONSE_INVALID')
  return Object.freeze({
   walletAddress,
   balanceLamports:BigInt(value),
   observedAt:now,
   evidenceIds:Object.freeze(['solana:getBalance:'+walletAddress+':'+String(row(result.context)?.slot??'unknown')]),
   authority:'CHAIN_BALANCE_EVIDENCE_ONLY' as const,
   canMoveFunds:false as const,
  })
 }
}

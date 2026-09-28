import { createHash } from 'node:crypto'
import type { CofferSignerAdapter, DexSignedTransaction } from './solana-dex-runtime-contracts.js'

type FetchLike=(input:string|URL,init?:RequestInit)=>Promise<Response>

export type RemoteCofferSignerOptions=Readonly<{
 baseUrl:string
 resolveAuthorizationHeader?:()=>Promise<string|undefined>|string|undefined
 fetchFn?:FetchLike
}>

function row(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('DEX_SIGNER_RESPONSE_INVALID')
 return value as Record<string,unknown>
}
function str(value:unknown,code:string):string{
 if(typeof value!=='string'||!value.trim())throw new Error(code)
 return value
}

export class RemoteCofferSignerAdapter implements CofferSignerAdapter{
 readonly provider='remote-coffer-signer'
 private readonly baseUrl:string
 private readonly resolveAuthorizationHeader?:RemoteCofferSignerOptions['resolveAuthorizationHeader']
 private readonly fetchFn:FetchLike
 constructor(options:RemoteCofferSignerOptions){
  this.baseUrl=options.baseUrl.replace(/\/$/,'')
  if(!this.baseUrl.startsWith('https://'))throw new Error('DEX_SIGNER_HTTPS_REQUIRED')
  this.resolveAuthorizationHeader=options.resolveAuthorizationHeader
  this.fetchFn=options.fetchFn??fetch
 }
 async signVersionedTransaction(input:{
  walletConnectionId:string
  signerLeaseId:string
  unsignedTransactionBase64:string
  idempotencyKey:string
  expectedSignerAddress:string
  now:string
 }):Promise<DexSignedTransaction>{
  const authorization=await this.resolveAuthorizationHeader?.()
  const response=await this.fetchFn(this.baseUrl+'/v1/sign-solana-transaction',{
   method:'POST',
   headers:{'content-type':'application/json','accept':'application/json',...(authorization?{'authorization':authorization}:{})},
   body:JSON.stringify({
    walletConnectionId:input.walletConnectionId,
    signerLeaseId:input.signerLeaseId,
    transactionBase64:input.unsignedTransactionBase64,
    idempotencyKey:input.idempotencyKey,
   }),
  })
  if(!response.ok)throw new Error('DEX_SIGNER_HTTP_'+response.status)
  const value=row(await response.json())
  const signerAddress=str(value.signerAddress,'DEX_SIGNER_ADDRESS_REQUIRED')
  if(signerAddress!==input.expectedSignerAddress)throw new Error('DEX_SIGNER_ADDRESS_MISMATCH')
  if(value.containsPrivateKey!==false||value.containsRawToken!==false)throw new Error('DEX_SIGNER_SECRET_EXPOSURE_FORBIDDEN')
  const signedTransactionBase64=str(value.signedTransactionBase64,'DEX_SIGNED_TRANSACTION_REQUIRED')
  const primarySignature=str(value.primarySignature,'DEX_PRIMARY_SIGNATURE_REQUIRED')
  const evidenceId=str(value.evidenceId,'DEX_SIGNER_EVIDENCE_REQUIRED')
  return Object.freeze({
   signerProvider:this.provider,
   walletConnectionId:input.walletConnectionId,
   signerLeaseId:input.signerLeaseId,
   signerAddress,
   primarySignature,
   signedTransactionBase64,
   signedTransactionHash:createHash('sha256').update(signedTransactionBase64).digest('hex'),
   evidenceIds:Object.freeze([evidenceId]),
   authority:'SIGNER_OUTPUT_ONLY' as const,
   containsPrivateKey:false as const,
   containsRawToken:false as const,
  })
 }
}

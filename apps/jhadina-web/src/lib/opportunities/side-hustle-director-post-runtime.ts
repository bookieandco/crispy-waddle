import type {ComputeSubmissionReceipt} from '@jhadina/compute-core'
import {currentVercelOidcToken} from '@/lib/vercel-oidc-runtime'
import type {
  DirectorPostComputeDispatchInput,
  DirectorPostComputeDispatcher,
} from './side-hustle-director-post-executor'

type TrustedComputeDomain='homebase'|'remote-homebase'

type DirectorPostComputeGatewayHealth=Readonly<{
  productionReady?:boolean
  authority?:string
  trustDomain?:string
}>

type DirectorPostComputeGatewayConfig=Readonly<{
  baseUrl:string
  token:string
  trustDomain:TrustedComputeDomain
}>

function clean(value:string):string{return value.replace(/\/+$/,'')}

function admittedGatewayUrl(value:unknown):string|undefined{
  if(typeof value!=='string'||!value.trim())return undefined
  try{
    const parsed=new URL(value.trim())
    if(parsed.protocol!=='https:'||parsed.username||parsed.password)return undefined
    if(parsed.hostname.endsWith('.proxy.runpod.net'))return undefined
    parsed.search=''
    parsed.hash=''
    return clean(parsed.toString())
  }catch{return undefined}
}

function configuredTrustDomain():TrustedComputeDomain|undefined{
  const value=(process.env.JHADINA_DIRECTOR_POST_COMPUTE_TRUST_DOMAIN??'').trim().toLowerCase()
  return value==='homebase'||value==='remote-homebase'?value:undefined
}

function requiredReceipt(body:unknown):ComputeSubmissionReceipt{
  const value=body&&typeof body==='object'&&'receipt' in body
    ?(body as {receipt?:unknown}).receipt
    :body
  if(!value||typeof value!=='object')throw new Error('DIRECTOR_POST_COMPUTE_RECEIPT_INVALID')
  const receipt=value as Partial<ComputeSubmissionReceipt>
  for(const [field,item] of [
    ['submissionId',receipt.submissionId],
    ['actionRequestId',receipt.actionRequestId],
    ['userId',receipt.userId],
    ['workloadId',receipt.workloadId],
    ['workSessionId',receipt.workSessionId],
    ['taskId',receipt.taskId],
    ['idempotencyKey',receipt.idempotencyKey],
    ['namespace',receipt.namespace],
    ['queueName',receipt.queueName],
    ['resourceName',receipt.resourceName],
    ['plannedNodeId',receipt.plannedNodeId],
    ['primaryStorageBackendId',receipt.primaryStorageBackendId],
    ['submittedAt',receipt.submittedAt],
    ['manifestFingerprint',receipt.manifestFingerprint],
  ] as const){
    if(typeof item!=='string'||!item.trim()){
      throw new Error('DIRECTOR_POST_COMPUTE_RECEIPT_FIELD_REQUIRED:'+field)
    }
  }
  if(receipt.provider!=='kubernetes'){
    throw new Error('DIRECTOR_POST_COMPUTE_LIVE_PROVIDER_INVALID')
  }
  return receipt as ComputeSubmissionReceipt
}

class TrustedDirectorPostComputeGateway implements DirectorPostComputeDispatcher{
  readonly id='director-post-canonical-compute-gateway'
  readonly authority='CANONICAL_COMPUTE_SUBMISSION' as const

  constructor(private readonly config:DirectorPostComputeGatewayConfig){}

  private headers():Record<string,string>{
    return {
      authorization:'Bearer '+this.config.token,
      'content-type':'application/json',
    }
  }

  async isReady():Promise<Readonly<{ready:boolean;reasons:readonly string[]}>>{
    try{
      const response=await fetch(this.config.baseUrl+'/health',{
        headers:this.headers(),
        cache:'no-store',
      })
      if(!response.ok){
        return Object.freeze({
          ready:false,
          reasons:Object.freeze(['DIRECTOR_POST_COMPUTE_HEALTH_FAILED:'+response.status]),
        })
      }
      const body=await response.json() as DirectorPostComputeGatewayHealth
      const reasons:string[]=[]
      if(body.productionReady!==true)reasons.push('DIRECTOR_POST_COMPUTE_NOT_PRODUCTION_READY')
      if(body.authority!=='CANONICAL_COMPUTE_SUBMISSION'){
        reasons.push('DIRECTOR_POST_COMPUTE_AUTHORITY_INVALID')
      }
      if(body.trustDomain!==this.config.trustDomain){
        reasons.push('DIRECTOR_POST_COMPUTE_TRUST_DOMAIN_MISMATCH')
      }
      return Object.freeze({ready:reasons.length===0,reasons:Object.freeze(reasons)})
    }catch(error){
      return Object.freeze({
        ready:false,
        reasons:Object.freeze([
          error instanceof Error?error.message:'DIRECTOR_POST_COMPUTE_HEALTH_UNAVAILABLE',
        ]),
      })
    }
  }

  async submit(input:DirectorPostComputeDispatchInput):Promise<ComputeSubmissionReceipt>{
    if(input.descriptor.computeBinding.constraints?.sensitiveData!==true){
      throw new Error('DIRECTOR_POST_COMPUTE_SENSITIVE_BINDING_REQUIRED')
    }
    if(input.descriptor.computeBinding.constraints?.allowCloudBurst===true){
      throw new Error('DIRECTOR_POST_COMPUTE_PUBLIC_CLOUD_BURST_FORBIDDEN')
    }
    const response=await fetch(this.config.baseUrl+'/v1/director/post-submissions',{
      method:'POST',
      headers:this.headers(),
      body:JSON.stringify({
        projectId:input.projectId,
        ownerUserId:input.ownerUserId,
        task:input.task,
        descriptor:input.descriptor,
      }),
      cache:'no-store',
    })
    if(!response.ok){
      throw new Error('DIRECTOR_POST_COMPUTE_SUBMIT_FAILED:'+response.status)
    }
    return requiredReceipt(await response.json())
  }
}

export async function resolveDirectorPostComputeDispatcher():Promise<DirectorPostComputeDispatcher|undefined>{
  const baseUrl=admittedGatewayUrl(process.env.JHADINA_DIRECTOR_POST_COMPUTE_URL)
  const trustDomain=configuredTrustDomain()
  if(!baseUrl||!trustDomain)return undefined
  const token=(
    process.env.JHADINA_DIRECTOR_POST_COMPUTE_TOKEN?.trim()||
    await currentVercelOidcToken()
  )
  if(!token)return undefined
  return new TrustedDirectorPostComputeGateway({baseUrl,token,trustDomain})
}

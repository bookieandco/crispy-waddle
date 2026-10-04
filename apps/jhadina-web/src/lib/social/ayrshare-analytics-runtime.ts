import {
  AyrshareProvider,
  type SocialObservation,
  type SocialOutboxJob,
  type SocialProvider,
} from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createSocialProviderForUser } from "./hootsuite-runtime"
import { buildSocialLearningProjection } from "./learning"
import { createSocialRepository, type SocialRepository } from "./repository"

type SocialProviderFactory=(userId:string,provider:string)=>SocialProvider|Promise<SocialProvider>

export interface AyrshareAnalyticsRuntimeOverrides{
  identityVerifier?:JhadinaIdentityVerifier
  repository?:SocialRepository
  providerFactory?:SocialProviderFactory
}

export type AyrshareAnalyticsIngestionResult={
  observation:SocialObservation
  learning:ReturnType<typeof buildSocialLearningProjection>
  authority:"OBSERVATION_ONLY"
  externalActionAuthorized:false
  publishingAuthorized:false
}

export async function ingestAyrsharePostAnalytics(
  outboxId:string,
  overrides:AyrshareAnalyticsRuntimeOverrides={},
):Promise<AyrshareAnalyticsIngestionResult>{
  const deps=await runtime(overrides)
  const identity=await deps.identityVerifier.verify({})
  const id=requireText(outboxId,"outboxId")
  const jobs=await deps.repository.listOutbox(identity.userId)
  const job=jobs.find(candidate=>candidate.id===id)
  if(!job)throw new Error("SOCIAL_OUTBOX_NOT_FOUND")
  assertAnalyticsEligible(job)

  const provider=await deps.providerFactory(identity.userId,"ayrshare")
  if(!(provider instanceof AyrshareProvider)){
    throw new Error("AYRSHARE_ANALYTICS_PROVIDER_REQUIRED")
  }

  const analytics=await provider.getPostAnalytics({
    providerProfileId:job.target.providerProfileId,
    platform:job.target.platform,
    providerPostId:job.providerPostId!,
  })

  const observation=await deps.repository.recordObservation({
    userId:identity.userId,
    proposalId:job.proposalId,
    outboxId:job.id,
    observation:{
      kind:"performance",
      source:"provider:ayrshare",
      provider:"ayrshare",
      platform:job.target.platform,
      accountId:job.target.accountId,
      providerProfileId:job.target.providerProfileId,
      contentId:analytics.contentId??job.providerPostId!,
      observedAt:analytics.observedAt,
      sourceUrl:analytics.sourceUrl,
      evidence:[
        `provider:ayrshare`,
        `providerPostId:${job.providerPostId}`,
        `analyticsMetricKeys:${analytics.rawMetricKeys.join(",")}`,
      ],
      metrics:{...analytics.metrics},
      attributes:{
        provenance:"provider_native",
        rawMetricKeyCount:analytics.rawMetricKeys.length,
      },
    },
  })

  return{
    observation,
    learning:buildSocialLearningProjection(observation),
    authority:"OBSERVATION_ONLY",
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

export async function ingestAyrshareDeliveredAnalytics(
  input:{proposalId?:string;limit?:number}={},
  overrides:AyrshareAnalyticsRuntimeOverrides={},
):Promise<{
  attempted:number
  ingested:AyrshareAnalyticsIngestionResult[]
  failures:Array<{outboxId:string;error:string}>
  authority:"OBSERVATION_ONLY"
  externalActionAuthorized:false
  publishingAuthorized:false
}>{
  const deps=await runtime(overrides)
  const identity=await deps.identityVerifier.verify({})
  const jobs=(await deps.repository.listOutbox(identity.userId,input.proposalId))
    .filter(job=>job.target.provider==="ayrshare"&&job.status==="delivered"&&!!job.providerPostId)
    .slice(0,normalizeLimit(input.limit))
  const ingested:AyrshareAnalyticsIngestionResult[]=[]
  const failures:Array<{outboxId:string;error:string}>=[]
  for(const job of jobs){
    try{
      ingested.push(await ingestAyrsharePostAnalytics(job.id,{
        identityVerifier:deps.identityVerifier,
        repository:deps.repository,
        providerFactory:deps.providerFactory,
      }))
    }catch(error){
      failures.push({
        outboxId:job.id,
        error:error instanceof Error?error.message:String(error),
      })
    }
  }
  return{
    attempted:jobs.length,
    ingested,
    failures,
    authority:"OBSERVATION_ONLY",
    externalActionAuthorized:false,
    publishingAuthorized:false,
  }
}

async function runtime(overrides:AyrshareAnalyticsRuntimeOverrides){
  return{
    identityVerifier:overrides.identityVerifier??await createRequestIdentityVerifier(),
    repository:overrides.repository??createSocialRepository(),
    providerFactory:overrides.providerFactory??createSocialProviderForUser,
  }
}

function assertAnalyticsEligible(job:SocialOutboxJob):void{
  if(job.target.provider!=="ayrshare")throw new Error("AYRSHARE_OUTBOX_REQUIRED")
  if(job.status!=="delivered")throw new Error("AYRSHARE_ANALYTICS_REQUIRES_DELIVERED_OUTBOX")
  if(!job.providerPostId?.trim())throw new Error("AYRSHARE_PROVIDER_POST_ID_REQUIRED")
}

function normalizeLimit(value:number|undefined):number{
  if(value===undefined)return 25
  if(!Number.isInteger(value)||value<1||value>100)throw new Error("AYRSHARE_ANALYTICS_LIMIT_INVALID")
  return value
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}

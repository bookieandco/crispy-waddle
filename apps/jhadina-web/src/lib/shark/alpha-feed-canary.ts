import {createHash} from 'node:crypto'
import {evaluateAlphaFeedCommission,type AlphaFeedCanary,type AlphaFeedCommissionGate,type AlphaFeedPolicy} from '@jhadina/shark-intelligence-core/meme-trader'
import {readPublicBlueskySearch,type SocialAlphaPermission} from './social-alpha-sources'

/** Bounded public AppView canary on a separately authorized server/owner host.
 * This only proves a provider responded to one optional read. Never a continuous
 * collector, license guarantee, trade signal or real-world owner-device proof.
 */
export async function probeApprovedBlueskyAlphaFeed(input:Readonly<{
 policy:AlphaFeedPolicy
 permission:SocialAlphaPermission
 query:string
 now:()=>string
 fetcher?:typeof fetch
}>):Promise<Readonly<{canary:AlphaFeedCanary;readiness:AlphaFeedCommissionGate;postsAdmitted:number}>>{
 if(input.policy.source!=='BLUESKY'||input.permission.source!=='bluesky'||
    !input.permission.termsApproved||!input.permission.ownerEnabled)
   throw new Error('alpha_bluesky_canary_permission_invalid')
 const before=input.now()
 const preflight=evaluateAlphaFeedCommission({policy:input.policy,asOf:before})
 if(preflight.status!=='CANARY_REQUIRED')
   throw new Error('alpha_bluesky_canary_preflight_blocked')
 const batch=await readPublicBlueskySearch({
   query:input.query,permission:input.permission,now:input.now,
   fetcher:input.fetcher,limit:Math.min(10,input.policy.maxCallsPerMinute),
 })
 const responseDigest=createHash('sha256')
   .update(JSON.stringify({
     source:batch.source,
     collectedAt:batch.collectedAt,
     availableAt:batch.availableAt,
     observations:batch.signals.map(s=>s.observationId).sort(),
     received:batch.received,ignored:batch.ignored,
   })).digest('hex')
 const canary:AlphaFeedCanary=Object.freeze({
   source:'BLUESKY',requestedAt:batch.collectedAt,receivedAt:batch.availableAt,
   result:'BOUNDED_VALID_RESPONSE',evidenceId:'bluesky-canary:'+responseDigest.slice(0,16),
   responseDigest,sourceProof:'PROVIDER_UNATTESTED',
 })
 const readiness=evaluateAlphaFeedCommission({
   policy:input.policy,canary,asOf:input.now(),
 })
 return Object.freeze({
   canary,readiness,postsAdmitted:batch.signals.length,
 })
}

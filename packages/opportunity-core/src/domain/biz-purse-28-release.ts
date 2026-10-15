import {createHash} from 'node:crypto'
export const BIZ_PURSE_RELEASE_MILESTONES=Object.freeze([
 'BIZ-PURSE.19','BIZ-PURSE.20','BIZ-PURSE.21','BIZ-PURSE.22','BIZ-PURSE.23',
 'BIZ-PURSE.24','BIZ-PURSE.25','BIZ-PURSE.26','BIZ-PURSE.27'
] as const)
export type BizPurseReleaseEvidence=Readonly<{
 milestone:string;headSha:string;testRunId:string;outcome:'PASS'|'FAIL'|'INCOMPLETE';
 scope:'CODE_ONLY'|'EXTERNAL_UNVERIFIED';evidenceRef:string
}>
/** BIZ-PURSE.28: integrity report. Never a trusted release signing service. */
export function evaluateBusinessFactoryRelease(input:Readonly<{
 headSha:string;at:string;evidence:readonly BizPurseReleaseEvidence[];
 ownerStopRequested:boolean;databaseRepairOpen:boolean;
 paymentProviderCommissioned:boolean;ownerCustodyCommissioned:boolean;
 independentLiveHostCertified:boolean;twoLiveBusinessesVerified:boolean
}>){
 if(!/^[a-f0-9]{40}$/.test(input.headSha)||!Number.isFinite(Date.parse(input.at))||
    !Array.isArray(input.evidence))throw Error('BIZ_PURSE_28_RELEASE_INPUT_INVALID')
 const reasons:string[]=[],ids=new Set<string>(),milestones=new Map<string,BizPurseReleaseEvidence>()
 for(const e of input.evidence){
  if(!e||!BIZ_PURSE_RELEASE_MILESTONES.includes(e.milestone as typeof BIZ_PURSE_RELEASE_MILESTONES[number])||
   !e.testRunId||!e.evidenceRef||!['CODE_ONLY','EXTERNAL_UNVERIFIED'].includes(e.scope)||
   !['PASS','FAIL','INCOMPLETE'].includes(e.outcome)||e.headSha!==input.headSha||
   ids.has(e.testRunId))throw Error('BIZ_PURSE_28_INVALID_OR_DUPLICATE_EVIDENCE')
  if(milestones.has(e.milestone))throw Error('BIZ_PURSE_28_DUPLICATE_MILESTONE')
  milestones.set(e.milestone,e);ids.add(e.testRunId)
 }
 for(const k of BIZ_PURSE_RELEASE_MILESTONES){
  if(!milestones.has(k)||milestones.get(k)?.outcome!=='PASS')reasons.push('MILESTONE_TEST_INCOMPLETE:'+k)
 }
 if(input.ownerStopRequested)reasons.push('OWNER_STOP_ACTIVE')
 if(input.databaseRepairOpen)reasons.push('SUPABASE_RECOVERY_NOT_COMMISSIONED')
 if(!input.paymentProviderCommissioned)reasons.push('CUSTOMER_PAYMENT_RAIL_UNCOMMISSIONED')
 if(!input.ownerCustodyCommissioned)reasons.push('OWNER_PROFIT_CUSTODY_UNCOMMISSIONED')
 if(!input.independentLiveHostCertified)reasons.push('UNATTENDED_HOST_NOT_CERTIFIED')
 if(!input.twoLiveBusinessesVerified)reasons.push('TWO_REAL_BUSINESSES_NOT_VERIFIED')
 // Self-asserted input can never independently certify the assertions above.
 reasons.push('INDEPENDENT_PRODUCTION_ATTESTATION_REQUIRED')
 return Object.freeze({status:reasons.length>1?'BLOCKED' as const:'CODE_HANDOFF_REVIEW_ONLY' as const,
  evidenceCount:milestones.size,reasons:Object.freeze(reasons),
  digest:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  authority:'RELEASE_EVIDENCE_INVENTORY_ONLY' as const,
  sourceCodeEvidenceOnly:true as const,productionCertified:false as const,
  canMergeAsProduction:false as const,canDeploy:false as const,canSpend:false as const,
  canMoveMoney:false as const,canTrade:false as const})
}

import {createHash} from 'node:crypto'

/** BIZ-PURSE.19. Governs internal workflow proposals, not live agents. */
export type BusinessDirectorStep='RESEARCH'|'REVIEW_OFFER'|'SCOPE_ORDER'|'REVIEW_DELIVERY'|'REVIEW_OUTCOME'
export type BusinessDirectorReceipt=Readonly<{
 id:string; ownerUserId:string; businessId:string; sequence:number;
 step:BusinessDirectorStep; verdict:'PASS'|'WAIT'|'BLOCK';
 evidenceId:string; at:string; source:'SIMULATED'|'INDEPENDENTLY_REVIEWED'
}>
export type BusinessDirectorReview=Readonly<{
 ownerUserId:string;businessId:string;completedSteps:readonly BusinessDirectorStep[];
 nextStep:BusinessDirectorStep|null;status:'BLOCKED'|'WAITING_REVIEW'|'INTERNAL_REHEARSAL_COMPLETE';
 blockers:readonly string[];digest:string;authority:'DIRECTOR_REVIEW_ONLY';
 canContactCustomers:false;canSpend:false;canFulfill:false;canPublish:false;canMoveMoney:false
}>
const steps:readonly BusinessDirectorStep[]=['RESEARCH','REVIEW_OFFER','SCOPE_ORDER','REVIEW_DELIVERY','REVIEW_OUTCOME']
const sane=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&s.trim()===s
export function reviewBusinessDirector(input:Readonly<{
 ownerUserId:string;businessId:string;asOf:string;receipts:readonly BusinessDirectorReceipt[];
 stopRequested:boolean;authorizedResearchFamilies:readonly string[];businessFamily:string
}>):BusinessDirectorReview{
 if(!sane(input.ownerUserId)||!sane(input.businessId)||!sane(input.businessFamily)||
 !Array.isArray(input.receipts)||!Number.isFinite(Date.parse(input.asOf)))throw Error('BIZ_PURSE_19_SCOPE_INVALID')
 const blockers:string[]=[],seen=new Map<string,string>(),completed:BusinessDirectorStep[]=[]
 let prevTime=-Infinity,seq=1,waiting=false
 if(input.stopRequested)blockers.push('OWNER_STOP_ACTIVE')
 if(!input.authorizedResearchFamilies.includes(input.businessFamily))blockers.push('BUSINESS_FAMILY_NOT_APPROVED')
 for(const r of input.receipts){
  if(!r||!sane(r.id)||!sane(r.evidenceId)||!sane(r.at)||
   !Number.isFinite(Date.parse(r.at))||Date.parse(r.at)>Date.parse(input.asOf)||
   r.ownerUserId!==input.ownerUserId||r.businessId!==input.businessId||
   !steps.includes(r.step)||!['PASS','WAIT','BLOCK'].includes(r.verdict)||
   !['SIMULATED','INDEPENDENTLY_REVIEWED'].includes(r.source))throw Error('BIZ_PURSE_19_RECEIPT_INVALID')
  const raw=JSON.stringify(r),prior=seen.get(r.id)
  if(prior!==undefined){if(prior!==raw)throw Error('BIZ_PURSE_19_REPLAY_CONFLICT');continue}
  if(r.sequence!==seq++||Date.parse(r.at)<prevTime)throw Error('BIZ_PURSE_19_GAP_OR_REORDER')
  prevTime=Date.parse(r.at);seen.set(r.id,raw)
  if(waiting||blockers.includes('REVIEW_BLOCKED'))throw Error('BIZ_PURSE_19_EVENT_AFTER_HALT')
  const expected=steps[completed.length]
  if(r.step!==expected)throw Error('BIZ_PURSE_19_STAGE_SKIPPED_OR_REPLAYED')
  if(r.verdict==='PASS')completed.push(r.step)
  else if(r.verdict==='WAIT'){waiting=true}
  else blockers.push('REVIEW_BLOCKED')
 }
 if(seen.size===0)blockers.push('RESEARCH_RECEIPT_MISSING')
 if([...input.receipts].some(r=>r.source==='SIMULATED'))blockers.push('SYNTHETIC_RESULTS_NOT_REAL_BUSINESS_EVIDENCE')
 const nextStep=waiting?steps[completed.length]:blockers.includes('REVIEW_BLOCKED')?null:(steps[completed.length]??null)
 return Object.freeze({
  ownerUserId:input.ownerUserId,businessId:input.businessId,
  completedSteps:Object.freeze(completed),nextStep,
  status:blockers.some(x=>x!=='SYNTHETIC_RESULTS_NOT_REAL_BUSINESS_EVIDENCE')?'BLOCKED':
   nextStep===null?'INTERNAL_REHEARSAL_COMPLETE':'WAITING_REVIEW',
  blockers:Object.freeze([...new Set(blockers)]),
  digest:createHash('sha256').update(JSON.stringify([...seen.values()])).digest('hex'),
  authority:'DIRECTOR_REVIEW_ONLY' as const,
  canContactCustomers:false as const,canSpend:false as const,canFulfill:false as const,
  canPublish:false as const,canMoveMoney:false as const,
 })
}

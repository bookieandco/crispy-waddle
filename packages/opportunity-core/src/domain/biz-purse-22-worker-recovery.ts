import {createHash} from 'node:crypto'
/** BIZ-PURSE.22: read-only durable worker lease/restart review. */
export type WorkerCheckpoint=Readonly<{id:string;sequence:number;jobId:string;ownerUserId:string;
 leaseToken:string;workerId:string;attempt:number;state:'QUEUED'|'CLAIMED'|'WAITING'|'DONE'|'BLOCKED';
 at:string;evidenceId:string}>
export function reviewWorkerRecovery(input:Readonly<{ownerUserId:string;jobId:string;asOf:string;
 pinnedSha:string;observedSha:string;leaseToken:string;leaseExpiresAt:string;
 ownerStop:boolean;checkpoints:readonly WorkerCheckpoint[];backupRestored:boolean}>){
 const reasons:string[]=[],seen=new Map<string,string>()
 if(!input.ownerUserId||!input.jobId||!Number.isFinite(Date.parse(input.asOf)))throw Error('BIZ_PURSE_22_INPUT_INVALID')
 if(!/^[a-f0-9]{40}$/.test(input.pinnedSha)||input.pinnedSha!==input.observedSha)reasons.push('SHA_NOT_PINNED')
 if(!input.leaseToken||Date.parse(input.leaseExpiresAt)<=Date.parse(input.asOf)||
  !Number.isFinite(Date.parse(input.leaseExpiresAt)))reasons.push('LEASE_EXPIRED')
 if(input.ownerStop)reasons.push('OWNER_STOP_ACTIVE')
 if(!input.backupRestored)reasons.push('INDEPENDENT_RESTORE_MISSING')
 let next=1,last:'QUEUED'|'CLAIMED'|'WAITING'|'DONE'|'BLOCKED'|null=null
 let lastTime=-Infinity
 for(const e of input.checkpoints){
  if(!e||e.ownerUserId!==input.ownerUserId||e.jobId!==input.jobId||
   e.leaseToken!==input.leaseToken||!e.workerId||!e.evidenceId||!e.id||
   !Number.isSafeInteger(e.sequence)||!Number.isSafeInteger(e.attempt)||e.attempt<1||
   !['QUEUED','CLAIMED','WAITING','DONE','BLOCKED'].includes(e.state)||
   !Number.isFinite(Date.parse(e.at))||Date.parse(e.at)>Date.parse(input.asOf))
   throw Error('BIZ_PURSE_22_CHECKPOINT_INVALID')
  const digest=JSON.stringify(e),before=seen.get(e.id)
  if(before!==undefined){if(before!==digest)throw Error('BIZ_PURSE_22_CONFLICTING_RECEIPT');continue}
  if(e.sequence!==next++||Date.parse(e.at)<lastTime)throw Error('BIZ_PURSE_22_SEQUENCE_OR_CLOCK_REGRESSION')
  if(last==='DONE'||last==='BLOCKED')throw Error('BIZ_PURSE_22_POST_TERMINAL_ACTIVITY')
  lastTime=Date.parse(e.at);last=e.state;seen.set(e.id,digest)
 }
 if(!seen.size||last!=='DONE')reasons.push('WORKER_REPLAY_INCOMPLETE')
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'WORKER_REHEARSAL_REVIEW_READY' as const,
  reasons:Object.freeze(reasons),checkpointCount:seen.size,ownerUserId:input.ownerUserId,jobId:input.jobId,
  digest:createHash('sha256').update(JSON.stringify([...seen.values()])).digest('hex'),
  authority:'HOST_REHEARSAL_ONLY' as const,canRunCloudWorker:false as const,
  canSpend:false as const,canCharge:false as const,canTrade:false as const})
}

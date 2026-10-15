import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewWorkerRecovery,type WorkerCheckpoint} from './biz-purse-22-worker-recovery.js'
const time='2026-10-14T22:00:00Z',token='lease:abc'
const checkpoints:WorkerCheckpoint[]=(['QUEUED','CLAIMED','WAITING','DONE'] as const).map((state,i)=>({
 id:'receipt:'+i,sequence:i+1,jobId:'job:1',ownerUserId:'owner:1',leaseToken:token,workerId:'worker:1',
 attempt:1,state,at:time,evidenceId:'evidence:'+i
}))
const run=(c:readonly WorkerCheckpoint[]=checkpoints,o:Record<string,unknown>={})=>reviewWorkerRecovery({
 ownerUserId:'owner:1',jobId:'job:1',asOf:time,leaseToken:token,
 pinnedSha:'a'.repeat(40),observedSha:'a'.repeat(40),
 leaseExpiresAt:'2026-10-14T23:00:00Z',ownerStop:false,
 checkpoints:c,backupRestored:true,...o})
test('complete synthetic worker receipts are review-only',()=>{
 const r=run();assert.equal(r.status,'WORKER_REHEARSAL_REVIEW_READY')
 assert.equal(r.canRunCloudWorker,false);assert.equal(r.canCharge,false)
})
test('stale lease, stop or missing independent restore block',()=>{
 assert.equal(run(checkpoints,{ownerStop:true}).status,'BLOCKED')
 assert(run(checkpoints,{backupRestored:false}).reasons.includes('INDEPENDENT_RESTORE_MISSING'))
 assert(run(checkpoints,{leaseExpiresAt:time}).reasons.includes('LEASE_EXPIRED'))
})
test('lost event and conflicting event id are rejected',()=>{
 assert.throws(()=>run([checkpoints[0],checkpoints[2]]),/SEQUENCE_OR_CLOCK_REGRESSION/)
 assert.throws(()=>run([checkpoints[0],{...checkpoints[0],state:'DONE'}]),/CONFLICTING_RECEIPT/)
})

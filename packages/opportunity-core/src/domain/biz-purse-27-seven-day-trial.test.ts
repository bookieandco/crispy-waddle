import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewSevenDayHostTrial,type UnattendedDayReceipt} from './biz-purse-27-seven-day-trial.js'
const days:UnattendedDayReceipt[]=Array.from({length:7},(_,i)=>({
 dateUtc:'2026-10-'+String(i+14).padStart(2,'0'),ownerUserId:'owner:1',hostId:'host:1',
 gitSha:'a'.repeat(40),tickReceiptId:'tick:'+i,restartTestReceiptId:'restart:'+i,
 immutableJournalDigest:'b'.repeat(64),realPhoneReadback:true,backupsRestored:true,errorsUnresolved:0}))
const run=(d:readonly UnattendedDayReceipt[]=days,o:Record<string,unknown>={})=>reviewSevenDayHostTrial({
 ownerUserId:'owner:1',hostId:'host:1',headSha:'a'.repeat(40),days:d,
 emergencyStopTested:true,noUnapprovedChargesObserved:true,...o})
test('self-reported seven-day trial can never certify unattended production',()=>{
 const r=run();assert.equal(r.status,'UNATTESTED_TRIAL_REVIEW_ONLY')
 assert.equal(r.unattendedProductionCertified,false);assert.equal(r.canDeploy,false)
})
test('gaps, repeats, unsolved errors and missing emergency stop block',()=>{
 assert.equal(run(days.slice(0,6)).status,'BLOCKED')
 assert(run([...days.slice(0,6),days[0]]).reasons.includes('DAY_OR_RECEIPT_REUSED'))
 assert(run(days.map((x,i)=>i===0?{...x,errorsUnresolved:1}:x)).reasons.includes('RUNTIME_RECOVERY_EVIDENCE_INCOMPLETE'))
 assert.equal(run(days,{emergencyStopTested:false}).status,'BLOCKED')
})

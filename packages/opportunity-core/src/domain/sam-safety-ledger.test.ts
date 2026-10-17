import assert from 'node:assert/strict'
import {evaluateSamSafetyLedgerProbe, type SamSafetyLedgerProbe} from './sam-safety-ledger.js'

const probe:SamSafetyLedgerProbe={
  source:'jhadina_audit_event',scope:'sam',observedAt:'2026-10-17T02:00:00.000Z',
  total:0,counts:{started:0,approval_required:0,completed:0,denied:0,failed:0},
  readOnly:true,atomicSnapshot:false,
}
const empty=evaluateSamSafetyLedgerProbe(probe)
assert.equal(empty.status,'blocked')
assert.equal(empty.sourceAvailable,true)
assert.equal(empty.unauthorizedExternalActions,null)
assert.equal(empty.silentFallbacks,null)
assert.equal(empty.safetyEvidenceComplete,false)
assert.ok(empty.reasons.some(v=>v.includes('absence is not proof')))

const completed=evaluateSamSafetyLedgerProbe({...probe,total:2,counts:{...probe.counts,started:1,completed:1}})
assert.equal(completed.sourceAvailable,true)
assert.equal(completed.observedCompletedActions,1)
assert.equal(completed.safetyEvidenceComplete,false)
assert.ok(completed.reasons.some(v=>v.includes('approval-to-provider')))

const failed=evaluateSamSafetyLedgerProbe({...probe,total:1,counts:{...probe.counts,failed:1}})
assert.equal(failed.observedFailedActions,1)
assert.ok(failed.reasons.some(v=>v.includes('investigation')))

for(const fake of [
  undefined, {}, {...probe,scope:'growth'},
  {...probe,readOnly:false}, {...probe,atomicSnapshot:true},
  {...probe,total:1}, {...probe,total:-1}, {...probe,counts:{...probe.counts,completed:NaN}},
  {...probe,counts:{...probe.counts,completed:-1}}, {...probe,observedAt:'invalid'},
]){
  const result=evaluateSamSafetyLedgerProbe(fake)
  assert.equal(result.status,'blocked')
  assert.equal(result.sourceAvailable,false)
  assert.equal(result.unauthorizedExternalActions,null)
  assert.equal(result.silentFallbacks,null)
}
console.log('sam safety ledger preflight tests passed')

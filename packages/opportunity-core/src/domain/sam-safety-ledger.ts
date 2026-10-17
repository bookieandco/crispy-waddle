/**
 * SAM-SAFETY-LEDGER.05 — a bounded observation, NOT a release of execution
 * authority. Action Core events are per-domain/per-actor, and the SAM gateway
 * can only inspect the "sam" domain. Other domains, direct transport/provider
 * receipts, and fallback telemetry are not captured by this snapshot.
 */
export type SamActionAuditStatus='started'|'approval_required'|'completed'|'denied'|'failed'
export type SamActionAuditCounts=Record<SamActionAuditStatus,number>
export type SamSafetyLedgerProbe={
  source:'jhadina_audit_event'
  scope:'sam'
  observedAt:string
  total:number
  counts:SamActionAuditCounts
  readOnly:true
  atomicSnapshot:false
}
export type SamSafetyPreflight={
  status:'blocked'
  sourceAvailable:boolean
  observedCompletedActions:number|null
  observedDeniedActions:number|null
  observedFailedActions:number|null
  unauthorizedExternalActions:null
  silentFallbacks:null
  safetyEvidenceComplete:false
  reasons:string[]
}

const statuses:readonly SamActionAuditStatus[]=['started','approval_required','completed','denied','failed']
const isCount=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
export function evaluateSamSafetyLedgerProbe(probe:unknown):SamSafetyPreflight{
  const reasons:string[]=[
    'Action Core SAM-domain history is not exhaustive across every actor/domain and cannot prove all external sends.',
    'No independently reconciled provider transport, bid, contract, or payment receipts.',
    'No complete fallback/side-channel execution telemetry or read-fence witness.',
  ]
  const unavailable:SamSafetyPreflight={
    status:'blocked',sourceAvailable:false,observedCompletedActions:null,
    observedDeniedActions:null,observedFailedActions:null,
    unauthorizedExternalActions:null,silentFallbacks:null,safetyEvidenceComplete:false,reasons,
  }
  if(!probe||typeof probe!=='object'||Array.isArray(probe)){
    return {...unavailable,reasons:['SAM Action Core safety source is unavailable.',...reasons]}
  }
  const p=probe as Partial<SamSafetyLedgerProbe>
  if(p.source!=='jhadina_audit_event'||p.scope!=='sam'||p.readOnly!==true||p.atomicSnapshot!==false||
    typeof p.observedAt!=='string'||!Number.isFinite(Date.parse(p.observedAt))||
    !isCount(p.total)||!p.counts||statuses.some(status=>!isCount(p.counts?.[status]))){
    return {...unavailable,reasons:['SAM Action Core safety observation has an invalid source, scope, or count.',...reasons]}
  }
  const sum=statuses.reduce((n,s)=>n+(p.counts?.[s]??0),0)
  if(sum!==p.total)return {...unavailable,reasons:['SAM Action Core audit counts are not internally consistent.',...reasons]}
  if(p.total===0)reasons.unshift('No SAM-domain Action Core events observed; absence is not proof of no external actions.')
  if(p.counts.completed>0)reasons.unshift('Completed SAM-domain actions require exact approval-to-provider receipt reconciliation.')
  if(p.counts.failed>0)reasons.unshift('Failed SAM-domain actions require investigation for side effects and missing completion receipts.')
  return {
    status:'blocked',sourceAvailable:true,
    observedCompletedActions:p.counts.completed,
    observedDeniedActions:p.counts.denied,
    observedFailedActions:p.counts.failed,
    unauthorizedExternalActions:null,silentFallbacks:null,safetyEvidenceComplete:false,
    reasons,
  }
}

/** Proof inventory and dependency gate only. This module NEVER authorizes spending, transfers or trading. */
export const MILESTONES=Object.freeze([
 {id:'BIZ-PURSE.01',proofs:['SCHEMA_REPLAY','BACKUP_RESTORE','OWNER_RLS_TEST','AUTHENTICATED_READBACK']},
 {id:'BIZ-PURSE.02',proofs:['CHARTER_NEGATIVE_TESTS','OWNER_CHARTER_RECEIPT']},
 {id:'BIZ-PURSE.03',proofs:['SCOUT_SOURCE_RECEIPT','TIMESTAMPED_SIGNAL_OBSERVATIONS']},
 {id:'BIZ-PURSE.04',proofs:['CUSTOMER_WORK_ORDER','CLIENT_ACCEPTANCE_CRITERIA']},
 {id:'BIZ-PURSE.05',proofs:['PROVIDER_SETTLED_PAYMENT','REFUND_REPLAY_TEST','WEBHOOK_RECONCILIATION']},
 {id:'BIZ-PURSE.06',proofs:['DELIVERY_ACCEPTANCE','FAILURE_AND_RETRY_TEST']},
 {id:'BIZ-PURSE.07',proofs:['OWNER_CUSTODY_RECEIPT','FUNDING_RAIL_COMMISSION','LEDGER_READBACK']},
 {id:'BIZ-PURSE.08',proofs:['SETTLED_PROFIT_BRIDGE','PROTECTED_OWNER_ACCRUAL','DOUBLE_COUNT_NEGATIVE_TEST']},
 {id:'BIZ-PURSE.09',proofs:['BUDGET_EXHAUSTION_DRILL','SINGLE_USE_SPEND_PERMIT_TEST']},
 {id:'BIZ-PURSE.10',proofs:['TWO_BUSINESS_SCOPE_TEST','BUSINESS_OUTCOME_ISOLATION']},
 {id:'BIZ-PURSE.11',proofs:['FORWARD_PAPER_GRADE','VENUE_RESTART_RECONCILIATION']},
 {id:'BIZ-PURSE.12',proofs:['MULTIDAY_HOST_RECEIPTS','RESTART_FENCE_TEST','INDEPENDENT_BACKUP_RESTORE','PHONE_STATE_READBACK']},
]);
export function assessBizPurseMilestones(receipts, evaluatedAt) {
 if(!Array.isArray(receipts)||!Number.isFinite(Date.parse(evaluatedAt)))throw new Error('BIZ_PURSE_EVIDENCE_INCOMPLETE');
 const seen=new Set(); const admissible=new Map();
 for(const r of receipts){
   if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||seen.has(r.id))throw new Error('BIZ_PURSE_DUPLICATE_OR_INVALID_RECEIPT');
   seen.add(r.id);
   if(typeof r.milestone!=='string'||typeof r.kind!=='string'||typeof r.observedAt!=='string'||!Number.isFinite(Date.parse(r.observedAt)))throw new Error('BIZ_PURSE_RECEIPT_MALFORMED');
   if(Date.parse(r.observedAt)>Date.parse(evaluatedAt))throw new Error('BIZ_PURSE_FUTURE_EVIDENCE');
   if(r.status!=='PASS'||r.origin!=='VERIFIED_EXTERNAL_OR_RUNTIME'||r.synthetic===true)continue;
   if(!admissible.has(r.milestone))admissible.set(r.milestone,new Set());
   admissible.get(r.milestone).add(r.kind);
 }
 let upstream=true;
 const milestones=MILESTONES.map(m=>{
   const actual=admissible.get(m.id)||new Set();
   const missing=m.proofs.filter(k=>!actual.has(k));
   const eligible=upstream&&missing.length===0;
   const state=eligible?'EVIDENCE_RECORDED_EXTERNAL_CERTIFICATION_REQUIRED':'BLOCKED';
   upstream=eligible;
   return Object.freeze({milestone:m.id,state,missing:Object.freeze(missing),upstreamAdmitted:upstream});
 });
 return Object.freeze({evaluatedAt,milestones:Object.freeze(milestones),allEvidencePresent:upstream,
   productionCertified:false,liveTradingAuthorized:false,moneyMovementAuthorized:false,hostingCommissioned:false,
   authority:'READINESS_DIAGNOSTIC_ONLY'});
}

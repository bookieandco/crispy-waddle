import {createHash} from 'node:crypto'
import {certifyProfitSweepReconciliation} from './accountant-controls.js'
import type {OwnerPaydayProposal,PurseProfitWaterfall} from './purse-profit-waterfall.js'

const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
export type PursePaperPaydayReceipt=Readonly<{
 receiptId:string
 paydayId:string
 charterId:string
 userId:string
 cofferId:string
 ownerDestinationId:string
 currency:string
 amountMinor:bigint
 journalSha256:string
 simulatedProviderFeeMinor:bigint
 evidenceIds:readonly string[]
 status:'PAPER_TIED_OUT'|'PAPER_RECONCILIATION_FAILED'
 reasonCodes:readonly string[]
 authority:'PAPER_PAYDAY_RECONCILIATION_ONLY'
 financialAuthority:'NONE'
 canExecute:false
 canMoveMoney:false
 provesRealSettlement:false
}>
/** Distinct from any provider settlement proof. Both balances are hypothetical. */
export function reconcilePursePaperPayday(input:{
 waterfall:PurseProfitWaterfall
 proposal:OwnerPaydayProposal
 sourceBeforeMinor:bigint
 sourceAfterMinor:bigint
 destinationBeforeMinor:bigint
 destinationAfterMinor:bigint
 hypotheticalFeeMinor:bigint
 testEvidenceIds:readonly string[]
}):PursePaperPaydayReceipt{
 const {waterfall:w,proposal:p}=input
 if(w.status!=='PAPER_READY'||w.canExecute!==false||p.authority!=='OWNER_PAYDAY_PROPOSAL_ONLY'||
   p.status!=='PAPER_PROPOSED'||p.executionMode!=='NON_EXECUTING'||p.canExecute!==false||p.canMoveMoney!==false||
   p.journal.canPost!==false||p.journal.authority!=='JOURNAL_CANDIDATE_ONLY')throw new Error('PURSE_PAPER_PAYDAY_AUTHORITY_INVALID')
 if(!w.userId||w.waterfallId!==p.waterfallId||w.charterId!==p.charterId||w.cofferId!==p.cofferId||
   w.ownerDestinationId!==p.ownerDestinationId||w.reportingCurrency!==p.currency||
   w.proposedOwnerPaydayMinor!==p.amountMinor||p.journal.amountMinor!==p.amountMinor||
   p.journal.cofferId!==p.cofferId||p.journal.currency!==p.currency)throw new Error('PURSE_PAPER_PAYDAY_BINDING_MISMATCH')
 if(!input.testEvidenceIds.length||input.testEvidenceIds.some(e=>!e.trim()))throw new Error('PURSE_PAPER_PAYDAY_TEST_EVIDENCE_REQUIRED')
 for(const n of [input.sourceBeforeMinor,input.sourceAfterMinor,input.destinationBeforeMinor,input.destinationAfterMinor,input.hypotheticalFeeMinor]){
  if(n<0n)throw new Error('PURSE_PAPER_PAYDAY_NEGATIVE_BALANCE_OR_FEE')
 }
 const control=certifyProfitSweepReconciliation({
  journal:p.journal,sourceSettledCashBeforeMinor:input.sourceBeforeMinor,sourceSettledCashAfterMinor:input.sourceAfterMinor,
  destinationSettledCashBeforeMinor:input.destinationBeforeMinor,destinationSettledCashAfterMinor:input.destinationAfterMinor,
  providerFeeMinor:input.hypotheticalFeeMinor,evidenceIds:input.testEvidenceIds,
 })
 const journalSha256=hash(p.journal)
 return Object.freeze({
  receiptId:'purse-payday-paper:'+hash({id:p.paydayId,journalSha256,evidence:input.testEvidenceIds,before:[input.sourceBeforeMinor,input.destinationBeforeMinor],after:[input.sourceAfterMinor,input.destinationAfterMinor],fee:input.hypotheticalFeeMinor}),
  paydayId:p.paydayId,charterId:p.charterId,userId:w.userId,cofferId:p.cofferId,ownerDestinationId:p.ownerDestinationId,
  currency:p.currency,amountMinor:p.amountMinor,journalSha256,simulatedProviderFeeMinor:input.hypotheticalFeeMinor,
  evidenceIds:Object.freeze([...new Set(input.testEvidenceIds)].sort()),
  status:control.passed?'PAPER_TIED_OUT':'PAPER_RECONCILIATION_FAILED',reasonCodes:control.reasonCodes,
  authority:'PAPER_PAYDAY_RECONCILIATION_ONLY',financialAuthority:'NONE',canExecute:false,canMoveMoney:false,provesRealSettlement:false,
 })
}

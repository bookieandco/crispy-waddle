import type {BusinessProfitLedgerReview} from './biz-purse-profit-ledger.js'
/** BIZ-PURSE.25 — payout candidate review, never a transfer permit. */
export function reviewPurseOwnerProtection(input:Readonly<{
 ownerUserId:string;businessId:string;ledger:BusinessProfitLedgerReview;
 payoutDestinationOwnerId:string;payoutDestinationVerified:boolean;
 custodyOwnerId:string;reconciliationReceiptId:string|null;
 ownerStopRequested:boolean;taxAndObligationReviewCompleted:boolean
}>){
 const reasons:string[]=[]
 if(input.ownerUserId!==input.ledger.ownerUserId||input.businessId!==input.ledger.businessId||
  !input.ownerUserId||!input.businessId)reasons.push('OWNER_BUSINESS_ACCOUNT_MISMATCH')
 if(input.custodyOwnerId!==input.ownerUserId||input.payoutDestinationOwnerId!==input.ownerUserId||
   !input.payoutDestinationVerified)reasons.push('OWNER_CUSTODY_OR_DESTINATION_UNVERIFIED')
 if(!input.reconciliationReceiptId)reasons.push('INDEPENDENT_CUSTODY_RECEIPT_MISSING')
 if(input.ownerStopRequested)reasons.push('OWNER_STOP_ACTIVE')
 if(!input.taxAndObligationReviewCompleted)reasons.push('TAX_RESERVE_REVIEW_REQUIRED')
 if(input.ledger.quarantinedCount||input.ledger.grossAccountingDeficitMinor>0n||
   !input.ledger.provisionalWaterfall||input.ledger.provisionalWaterfall.status!=='ALLOCATABLE')
  reasons.push('ACCOUNTING_UNALLOCATABLE_OR_UNCERTAIN')
 if(input.ledger.providerSettlementCertified!==false||input.ledger.canMoveMoney!==false)
  reasons.push('LEDGER_AUTHORITY_INVALID')
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'OWNER_CUSTODY_REVIEW_ONLY' as const,
  reasons:Object.freeze(reasons),ownerEntitlementCandidateMinor:input.ledger.provisionalWaterfall?.ownerEntitlementMinor??0n,
  reinvestmentCandidateMinor:input.ledger.provisionalWaterfall?.reinvestmentLimitMinor??0n,
  authority:'NONPAYABLE_OWNER_ACCOUNTING_PROPOSAL' as const,
  canPayOwner:false as const,canReinvest:false as const,canMoveMoney:false as const})
}

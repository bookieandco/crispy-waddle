import type {BusinessProfitProposal} from './biz-purse-profit-waterfall.js'
/** BIZ-PURSE.07/.09/.11 — pure financial admission, never a funding or trading executor. */
export type FinancialGate=Readonly<{
 status:'BLOCKED'|'REVIEW_READY'
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:'FINANCIAL_PROPOSAL_ONLY'
 canMoveMoney:false
 canTrade:false
 canSpend:false
}>
const finish=(reasons:string[],evidenceIds:readonly string[]):FinancialGate=>Object.freeze({
 status:reasons.length?'BLOCKED':'REVIEW_READY',reasonCodes:Object.freeze([...new Set(reasons)]),
 evidenceIds:Object.freeze([...new Set(evidenceIds)]),authority:'FINANCIAL_PROPOSAL_ONLY' as const,
 canMoveMoney:false as const,canTrade:false as const,canSpend:false as const})
export function assessOwnerSeedFunding(input:Readonly<{
 ownerId:string
 accountOwnerId:string
 currency:string
 requestedCurrency:string
 amountMinor:bigint
 independentlySettledMinor:bigint
 commissioningState:'UNCOMMISSIONED'|'TEST_ONLY'|'CERTIFIED'
 custodyReadbackVerified:boolean
 ledgerReadbackVerified:boolean
 ownerApprovalVerified:boolean
 providerReceiptIds:readonly string[]
}>):FinancialGate{
 const reasons:string[]=[]
 if(!input.ownerId||input.ownerId!==input.accountOwnerId)reasons.push('CUSTODY_OWNER_MISMATCH')
 if(!input.currency||input.currency!==input.requestedCurrency)reasons.push('CURRENCY_MISMATCH')
 if(input.amountMinor<=0n||input.independentlySettledMinor!==input.amountMinor)reasons.push('SETTLED_FUNDING_AMOUNT_MISMATCH')
 if(input.commissioningState!=='CERTIFIED')reasons.push('FUNDING_PROVIDER_NOT_COMMISSIONED')
 if(!input.custodyReadbackVerified||!input.ledgerReadbackVerified)reasons.push('CUSTODY_LEDGER_RECONCILIATION_MISSING')
 if(!input.ownerApprovalVerified)reasons.push('OWNER_APPROVAL_MISSING')
 if(!input.providerReceiptIds.length||new Set(input.providerReceiptIds).size!==input.providerReceiptIds.length)reasons.push('FUNDING_RECEIPTS_INVALID')
 return finish(reasons,input.providerReceiptIds)
}
export function assessBusinessReinvestment(input:Readonly<{
 businessId:string
 periodId:string
 proposal:BusinessProfitProposal
 requestedSpendMinor:bigint
 existingReservedSpendMinor:bigint
 approvedOperatingSpendCapMinor:bigint
 businessEvidenceIds:readonly string[]
}>):FinancialGate{
 const reasons:string[]=[]
 const p=input.proposal
 if(!input.businessId||!input.periodId||p.businessId!==input.businessId||p.periodId!==input.periodId)reasons.push('BUSINESS_PERIOD_MISMATCH')
 if(p.authority!=='PROPOSAL_ONLY'||p.canMoveMoney!==false||p.canPlaceOrders!==false)reasons.push('PROFIT_PLAN_AUTHORITY_MISMATCH')
 if(p.status!=='ALLOCATABLE'||p.ownerUnfundedMinor!==0n)reasons.push('OWNER_ENTITLEMENT_OR_LIQUIDITY_UNFUNDED')
 if(input.requestedSpendMinor<=0n||input.existingReservedSpendMinor<0n||input.approvedOperatingSpendCapMinor<0n)reasons.push('SPEND_NUMERIC_INVALID')
 if(input.requestedSpendMinor+input.existingReservedSpendMinor>p.reinvestmentLimitMinor)reasons.push('PROFIT_REINVESTMENT_LIMIT')
 if(input.requestedSpendMinor+input.existingReservedSpendMinor>input.approvedOperatingSpendCapMinor)reasons.push('OWNER_OPERATING_CAP_EXCEEDED')
 if(!input.businessEvidenceIds.length||new Set(input.businessEvidenceIds).size!==input.businessEvidenceIds.length||input.businessEvidenceIds.some(x=>!x))reasons.push('SPEND_EVIDENCE_INVALID')
 return finish(reasons,[...p.evidenceIds,...input.businessEvidenceIds])
}
export function assessPaperMarketResearch(input:Readonly<{
 venue:'STOCKS'|'MEMECOINS'|'KALSHI'|'SPORTS'
 mode:'PAPER'|'LIVE'
 proposalCount:number
 frozenPredictionCount:number
 gradedOutcomeCount:number
 unresolvedGaps:number
 independentSettlementReceipts:number
 positionLedgerReconciled:boolean
 marketFeedFresh:boolean
 sourceEvidenceIds:readonly string[]
}>):FinancialGate{
 const reasons:string[]=[]
 if(input.mode!=='PAPER')reasons.push('RESEARCH_PAPER_ONLY')
 const counts=[input.proposalCount,input.frozenPredictionCount,input.gradedOutcomeCount,input.unresolvedGaps,input.independentSettlementReceipts]
 if(counts.some(x=>!Number.isInteger(x)||x<0))reasons.push('PAPER_COUNTS_INVALID')
 if(input.proposalCount<1||input.frozenPredictionCount<input.proposalCount||input.gradedOutcomeCount<input.proposalCount)reasons.push('UNCOMPLETED_FORWARD_OUTCOMES')
 if(input.unresolvedGaps!==0)reasons.push('MARKET_DATA_GAP_UNRESOLVED')
 if(input.independentSettlementReceipts<input.gradedOutcomeCount)reasons.push('SETTLEMENT_EVIDENCE_UNVERIFIED')
 if(!input.positionLedgerReconciled||!input.marketFeedFresh)reasons.push('PAPER_LEDGER_OR_FEED_UNVERIFIED')
 if(!input.sourceEvidenceIds.length||new Set(input.sourceEvidenceIds).size!==input.sourceEvidenceIds.length)reasons.push('MARKET_SOURCE_PROVENANCE_REQUIRED')
 return finish(reasons,input.sourceEvidenceIds)
}

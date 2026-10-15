/** BIZ-PURSE.10/.12 — tenant isolation and unattended-runtime readiness, no live authority. */
export type BusinessUnitScope=Readonly<{
 businessId:string
 ownerUserId:string
 accountId:string
 customerRefs:readonly string[]
 ledgerReceiptIds:readonly string[]
 operatingBudgetMinor:bigint
 reservedSpendMinor:bigint
}>
export type BusinessPortfolioReadiness=Readonly<{
 status:'BLOCKED'|'REVIEW_READY'
 reasons:readonly string[]
 businessesChecked:number
 authority:'PORTFOLIO_REVIEW_ONLY'
 mayLaunchNewBusiness:false
 maySpend:false
 mayTransfer:false
}>
export function assessMultiBusinessIsolation(input:Readonly<{
 ownerUserId:string
 units:readonly BusinessUnitScope[]
 aggregateBudgetCapMinor:bigint
}>):BusinessPortfolioReadiness{
 const reasons:string[]=[]
 if(!input.ownerUserId||input.units.length<2)reasons.push('TWO_BUSINESS_EVIDENCE_REQUIRED')
 if(input.aggregateBudgetCapMinor<0n)reasons.push('PORTFOLIO_BUDGET_INVALID')
 const businessIds=new Set<string>(),accounts=new Set<string>(),customers=new Set<string>(),receipts=new Set<string>()
 let sum=0n
 for(const unit of input.units){
  if(!unit.businessId||businessIds.has(unit.businessId))reasons.push('BUSINESS_ID_INVALID_OR_REUSED')
  businessIds.add(unit.businessId)
  if(unit.ownerUserId!==input.ownerUserId)reasons.push('CROSS_OWNER_BUSINESS')
  if(!unit.accountId||accounts.has(unit.accountId))reasons.push('ACCOUNT_NOT_SEGREGATED')
  accounts.add(unit.accountId)
  if(unit.operatingBudgetMinor<0n||unit.reservedSpendMinor<0n||unit.reservedSpendMinor>unit.operatingBudgetMinor)reasons.push('BUSINESS_BUDGET_INVALID')
  sum+=unit.operatingBudgetMinor
  if(!unit.ledgerReceiptIds.length)reasons.push('BUSINESS_LEDGER_EVIDENCE_REQUIRED')
  for(const x of unit.customerRefs){if(!x||customers.has(x))reasons.push('CROSS_BUSINESS_CUSTOMER_COLLISION');customers.add(x)}
  for(const x of unit.ledgerReceiptIds){if(!x||receipts.has(x))reasons.push('CROSS_BUSINESS_LEDGER_COLLISION');receipts.add(x)}
 }
 if(sum>input.aggregateBudgetCapMinor)reasons.push('PORTFOLIO_AGGREGATE_BUDGET_EXCEEDED')
 return Object.freeze({status:reasons.length?'BLOCKED':'REVIEW_READY',
  reasons:Object.freeze([...new Set(reasons)]),businessesChecked:input.units.length,
  authority:'PORTFOLIO_REVIEW_ONLY' as const,
  mayLaunchNewBusiness:false as const,maySpend:false as const,mayTransfer:false as const})
}
export type UnattendedWorkerReadiness=Readonly<{
 status:'BLOCKED'|'REVIEW_READY'
 reasons:readonly string[]
 authority:'HOST_EVIDENCE_ONLY'
 canRunUnattended:false
 canExecuteTransactions:false
 canRunPaidWork:false
}>
export function assessUnattendedHost(input:Readonly<{
 ownerUserId:string
 ownerAttestedHostId:string
 workerHostId:string
 pinnedGitSha:string
 observedGitSha:string
 observedAt:string
 leaseExpiresAt:string
 exclusiveLeaseVerified:boolean
 restartFencingDrillPassed:boolean
 appendOnlyJournalVerified:boolean
 backupDigest:string
 restoredDigest:string
 isolatedRestoreVerified:boolean
 phoneAuthenticatedReadbackVerified:boolean
 platformCostApproved:boolean
 platformIsFree:boolean
}>):UnattendedWorkerReadiness{
 const reasons:string[]=[]
 if(!input.ownerUserId||!input.ownerAttestedHostId||input.ownerAttestedHostId!==input.workerHostId)reasons.push('OWNER_HOST_IDENTITY_UNVERIFIED')
 if(!/^[a-f0-9]{40}$/.test(input.pinnedGitSha)||input.pinnedGitSha!==input.observedGitSha)reasons.push('HOST_COMMIT_NOT_PINNED')
 const observed=Date.parse(input.observedAt),expires=Date.parse(input.leaseExpiresAt)
 if(!Number.isFinite(observed)||!Number.isFinite(expires)||expires<=observed)reasons.push('HOST_LEASE_INVALID')
 if(!input.exclusiveLeaseVerified||!input.restartFencingDrillPassed)reasons.push('HOST_FENCING_NOT_PROVEN')
 if(!input.appendOnlyJournalVerified)reasons.push('DURABLE_JOURNAL_NOT_PROVEN')
 if(!/^[a-f0-9]{64}$/.test(input.backupDigest)||input.backupDigest!==input.restoredDigest||!input.isolatedRestoreVerified)reasons.push('INDEPENDENT_RESTORE_NOT_PROVEN')
 if(!input.phoneAuthenticatedReadbackVerified)reasons.push('PHONE_READBACK_NOT_VERIFIED')
 if(!input.platformIsFree&&!input.platformCostApproved)reasons.push('HOST_COST_NOT_APPROVED')
 return Object.freeze({status:reasons.length?'BLOCKED':'REVIEW_READY',
  reasons:Object.freeze([...new Set(reasons)]),authority:'HOST_EVIDENCE_ONLY' as const,
  canRunUnattended:false as const,canExecuteTransactions:false as const,canRunPaidWork:false as const})
}

import {createHash} from 'node:crypto'
import {assertJhadinaPurseCharter, type JhadinaPurseCharter} from './jhadina-purse-charter.js'
import {assertCofferPolicy, buildCofferAccountantDecision, type CofferPolicy, type CofferAccountingSnapshot} from './coffer-accountant.js'
import type {PursePortfolioSnapshot} from './purse-portfolio.js'
import type {PurseLiquiditySnapshot} from './purse-liquidity.js'
import {buildProfitSweepJournalCandidate, validateDoubleEntry, type ProfitSweepJournalCandidate} from './accountant-controls.js'

/** Both stages are projections. No provider, transaction or signing API is available here. */
export type PurseProfitWaterfall=Readonly<{
 waterfallId:string
 charterId:string
 cofferId:string
 userId:string
 reportingCurrency:string
 policyId:string
 ownerDestinationId:string
 accountingObservedAt:string
 evaluatedAt:string
 netRealizedProfitMinor:bigint
 proposedByCofferMinor:bigint
 protectedOwnerSweepHoldMinor:bigint
 availableForWithdrawalMinor:bigint
 proposedOwnerPaydayMinor:bigint
 status:'PAPER_READY'|'NO_ELIGIBLE_PROFIT'|'HOLD_NOT_FUNDED'|'BELOW_THRESHOLD'|'STALE_EVIDENCE'
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:'PROFIT_WATERFALL_EVIDENCE_ONLY'
 canExecute:false
}>

export type OwnerPaydayProposal=Readonly<{
 paydayId:string
 waterfallId:string
 charterId:string
 cofferId:string
 ownerDestinationId:string
 amountMinor:bigint
 currency:string
 idempotencyKey:string
 journal:ProfitSweepJournalCandidate
 status:'PAPER_PROPOSED'
 executionMode:'NON_EXECUTING'
 approvalRequired:true
 reconciliationRequired:true
 evidenceIds:readonly string[]
 authority:'OWNER_PAYDAY_PROPOSAL_ONLY'
 canExecute:false
 canMoveMoney:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const min=(...values:bigint[])=>values.reduce((a,b)=>a<b?a:b)
const unique=(ids:readonly string[])=>Object.freeze([...new Set(ids)].sort())
const validTime=(time:string)=>Boolean(time)&&!Number.isNaN(Date.parse(time))

export function buildPurseProfitWaterfall(input:{
 charter:JhadinaPurseCharter
 policy:CofferPolicy
 accounting:CofferAccountingSnapshot
 portfolio:PursePortfolioSnapshot
 liquidity:PurseLiquiditySnapshot
 evaluatedAt:string
 maxEvidenceAgeMs?:number
}):PurseProfitWaterfall{
 const {charter,policy,accounting,portfolio,liquidity,evaluatedAt}=input
 assertJhadinaPurseCharter(charter,evaluatedAt)
 assertCofferPolicy(policy)
 if(!validTime(evaluatedAt))throw new Error('PURSE_WATERFALL_TIME_INVALID')
 if(policy.currency!==charter.reportingCurrency||accounting.currency!==charter.reportingCurrency||portfolio.reportingCurrency!==charter.reportingCurrency||liquidity.reportingCurrency!==charter.reportingCurrency)throw new Error('PURSE_WATERFALL_CURRENCY_MISMATCH')
 if(accounting.cofferId!==charter.cofferId||portfolio.cofferId!==charter.cofferId||portfolio.userId!==charter.userId||liquidity.charterId!==charter.charterId||liquidity.portfolioSnapshotId!==portfolio.snapshotId)throw new Error('PURSE_WATERFALL_BINDING_MISMATCH')
 if(policy.verifiedOwnerDestinationId!==charter.verifiedOwnerPayoutDestinationId)throw new Error('PURSE_WATERFALL_OWNER_DESTINATION_MISMATCH')
 if(portfolio.authority!=='PORTFOLIO_EVIDENCE'||portfolio.canExecute!==false||liquidity.authority!=='LIQUIDITY_EVIDENCE'||liquidity.canExecute!==false)throw new Error('PURSE_WATERFALL_EVIDENCE_AUTHORITY_INVALID')
 if(!accounting.evidenceIds.length||!portfolio.evidenceIds.length||!liquidity.evidenceIds.length)throw new Error('PURSE_WATERFALL_EVIDENCE_MISSING')
 for(const amount of [liquidity.availableForWithdrawalMinor,liquidity.ownerSweepHoldMinor])if(amount<0n)throw new Error('PURSE_WATERFALL_LIQUIDITY_INVALID')
 const maxAge=input.maxEvidenceAgeMs??900000
 if(!Number.isSafeInteger(maxAge)||maxAge<=0)throw new Error('PURSE_WATERFALL_MAX_AGE_INVALID')
 const cutoff=Date.parse(evaluatedAt)
 const times=[accounting.observedAt,portfolio.observedAt,liquidity.observedAt]
 if(times.some(t=>!validTime(t)||Date.parse(t)>cutoff))throw new Error('PURSE_WATERFALL_EVIDENCE_TIME_INVALID')
 const accountant=buildCofferAccountantDecision({policy,snapshot:accounting})
 const stale=times.some(t=>cutoff-Date.parse(t)>maxAge)
 const funded=min(accountant.proposedSweepMinor,liquidity.availableForWithdrawalMinor,liquidity.ownerSweepHoldMinor)
 const amount=stale?0n:funded>=policy.profitSweepThresholdMinor?funded:0n
 const status:PurseProfitWaterfall['status']=stale?'STALE_EVIDENCE':
  accountant.sweepStatus!=='READY_FOR_GOVERNED_EXECUTION'?'NO_ELIGIBLE_PROFIT':
  liquidity.ownerSweepHoldMinor===0n||liquidity.availableForWithdrawalMinor===0n?'HOLD_NOT_FUNDED':
  amount===0n?'BELOW_THRESHOLD':'PAPER_READY'
 const reasons=[...accountant.reasonCodes]
 if(stale)reasons.push('PIT_ACCOUNTING_OR_LIQUIDITY_STALE')
 if(status==='HOLD_NOT_FUNDED')reasons.push('OWNER_SWEEP_LIQUIDITY_HOLD_REQUIRED')
 if(status==='BELOW_THRESHOLD')reasons.push('FUNDED_PAYOUT_BELOW_THRESHOLD')
 const evidenceIds=unique([...charter.evidenceIds,...accounting.evidenceIds,...portfolio.evidenceIds,...liquidity.evidenceIds])
 return Object.freeze({
  waterfallId:'purse-waterfall:'+hash({charterId:charter.charterId,policyId:policy.policyId,accounting:accounting.observedAt,portfolio:portfolio.snapshotId,liquidity:liquidity.liquiditySnapshotId,evaluatedAt,amount}),
  charterId:charter.charterId,cofferId:charter.cofferId,userId:charter.userId,reportingCurrency:charter.reportingCurrency,
  policyId:policy.policyId,ownerDestinationId:charter.verifiedOwnerPayoutDestinationId,accountingObservedAt:accounting.observedAt,evaluatedAt,
  netRealizedProfitMinor:accountant.netRealizedProfitMinor,proposedByCofferMinor:accountant.proposedSweepMinor,
  protectedOwnerSweepHoldMinor:liquidity.ownerSweepHoldMinor,availableForWithdrawalMinor:liquidity.availableForWithdrawalMinor,
  proposedOwnerPaydayMinor:amount,status,reasonCodes:Object.freeze(reasons),evidenceIds,
  authority:'PROFIT_WATERFALL_EVIDENCE_ONLY',canExecute:false,
 })
}

/** Builds a balanced journal candidate; intentionally never instructs or contacts a payment provider. */
export function buildOwnerPaydayProposal(input:{
 charter:JhadinaPurseCharter
 waterfall:PurseProfitWaterfall
 sourceAccount:string
 destinationAccount:string
}):OwnerPaydayProposal{
 const {charter,waterfall}=input
 assertJhadinaPurseCharter(charter,waterfall.evaluatedAt)
 if(waterfall.authority!=='PROFIT_WATERFALL_EVIDENCE_ONLY'||waterfall.canExecute!==false||waterfall.status!=='PAPER_READY'||waterfall.proposedOwnerPaydayMinor<=0n)throw new Error('PURSE_PAYDAY_NOT_READY')
 if(waterfall.charterId!==charter.charterId||waterfall.cofferId!==charter.cofferId||waterfall.userId!==charter.userId||waterfall.reportingCurrency!==charter.reportingCurrency||waterfall.ownerDestinationId!==charter.verifiedOwnerPayoutDestinationId)throw new Error('PURSE_PAYDAY_BINDING_MISMATCH')
 if(input.destinationAccount!==charter.verifiedOwnerPayoutDestinationId||!input.sourceAccount.trim()||input.sourceAccount===input.destinationAccount)throw new Error('PURSE_PAYDAY_DESTINATION_UNVERIFIED')
 const id='purse-payday:'+hash({waterfallId:waterfall.waterfallId,source:input.sourceAccount,destination:input.destinationAccount,amount:waterfall.proposedOwnerPaydayMinor})
 const decision={
  cofferId:waterfall.cofferId,sweepStatus:'READY_FOR_GOVERNED_EXECUTION' as const,proposedSweepMinor:waterfall.proposedOwnerPaydayMinor,
 }
 const journal=buildProfitSweepJournalCandidate({journalId:id+':journal',decision,currency:waterfall.reportingCurrency,sourceAccount:input.sourceAccount,destinationAccount:input.destinationAccount})
 if(!validateDoubleEntry(journal.lines).passed)throw new Error('PURSE_PAYDAY_JOURNAL_UNBALANCED')
 return Object.freeze({
  paydayId:id,waterfallId:waterfall.waterfallId,charterId:charter.charterId,cofferId:charter.cofferId,
  ownerDestinationId:input.destinationAccount,amountMinor:waterfall.proposedOwnerPaydayMinor,currency:waterfall.reportingCurrency,
  idempotencyKey:hash({waterfallId:waterfall.waterfallId,source:input.sourceAccount,destination:input.destinationAccount}),
  journal,status:'PAPER_PROPOSED',executionMode:'NON_EXECUTING',approvalRequired:true,reconciliationRequired:true,
  evidenceIds:waterfall.evidenceIds,authority:'OWNER_PAYDAY_PROPOSAL_ONLY',canExecute:false,canMoveMoney:false,
 })
}

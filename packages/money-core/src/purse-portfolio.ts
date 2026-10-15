import { createHash } from 'node:crypto'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'

export type PurseAccountKind='CASH'|'BROKERAGE'|'CRYPTO_WALLET'|'SPORTSBOOK'|'PREDICTION_MARKET'|'METALS_CUSTODY'|'OTHER'
export type PurseLedgerEntryKind='DEPOSIT'|'WITHDRAWAL'|'TRANSFER'|'TRADE'|'WAGER'|'SETTLEMENT'|'FEE'|'REALIZED_PNL'|'VALUATION'|'RECONCILIATION'

export type PurseAccountSnapshot=Readonly<{
 accountId:string
 provider:string
 kind:PurseAccountKind
 nativeCurrency:string
 nativeBalanceMinor:bigint
 reportingCurrency:string
 reportingValueMinor:bigint
 liquidReportingValueMinor:bigint
 unsettledReportingValueMinor:bigint
 reservedReportingValueMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 valueBasis:'CASH_AND_NONPOSITION_ONLY'
 authority:'ACCOUNT_EVIDENCE'
}>

export type PursePositionSnapshot=Readonly<{
 positionId:string
 accountId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 reportingCurrency:string
 marketValueMinor:bigint
 executableExitValueMinor:bigint
 costBasisMinor:bigint
 unrealizedPnlMinor:bigint
 correlationGroupIds:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'POSITION_EVIDENCE'
}>

export type PurseLedgerEntry=Readonly<{
 entryId:string
 accountId:string
 kind:PurseLedgerEntryKind
 nativeCurrency:string
 nativeAmountMinor:bigint
 reportingCurrency:string
 reportingAmountMinor:bigint
 cashImpactMinor:bigint
 realizedPnlImpactMinor:bigint
 valuationImpactMinor:bigint
 occurredAt:string
 reconciled:boolean
 evidenceIds:readonly string[]
 authority:'LEDGER_EVIDENCE'
}>

export type PursePortfolioSnapshot=Readonly<{
 snapshotId:string
 userId:string
 cofferId:string
 reportingCurrency:string
 totalAccountValueMinor:bigint
 totalPositionValueMinor:bigint
 grossPortfolioValueMinor:bigint
 liquidAccountValueMinor:bigint
 executablePositionValueMinor:bigint
 unsettledMinor:bigint
 reservedMinor:bigint
 realizedPnlMinor:bigint
 unrealizedPnlMinor:bigint
 accounts:readonly PurseAccountSnapshot[]
 positions:readonly PursePositionSnapshot[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'PORTFOLIO_EVIDENCE'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const iso=(v:string,code:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(code)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertPurseAccountSnapshot(a:PurseAccountSnapshot,now:string):void{
 if(!a.accountId||!a.provider||!a.nativeCurrency||!a.reportingCurrency||a.valueBasis!=='CASH_AND_NONPOSITION_ONLY'||a.authority!=='ACCOUNT_EVIDENCE'||!a.evidenceIds.length)throw new Error('PURSE_ACCOUNT_EVIDENCE_INVALID')
 for(const x of [a.nativeBalanceMinor,a.reportingValueMinor,a.liquidReportingValueMinor,a.unsettledReportingValueMinor,a.reservedReportingValueMinor])if(x<0n)throw new Error('PURSE_ACCOUNT_AMOUNT_NEGATIVE')
 if(a.liquidReportingValueMinor>a.reportingValueMinor||a.reservedReportingValueMinor>a.reportingValueMinor)throw new Error('PURSE_ACCOUNT_COMPONENT_EXCEEDS_VALUE')
 iso(a.observedAt,'PURSE_ACCOUNT_TIME_INVALID')
 if(a.observedAt>now)throw new Error('PURSE_ACCOUNT_FUTURE_EVIDENCE')
}

export function assertPursePositionSnapshot(p:PursePositionSnapshot,now:string):void{
 if(!p.positionId||!p.accountId||!p.strategyId||!p.instrumentId||!p.reportingCurrency||p.authority!=='POSITION_EVIDENCE'||!p.evidenceIds.length)throw new Error('PURSE_POSITION_EVIDENCE_INVALID')
 for(const x of [p.marketValueMinor,p.executableExitValueMinor,p.costBasisMinor])if(x<0n)throw new Error('PURSE_POSITION_AMOUNT_NEGATIVE')
 if(p.executableExitValueMinor>p.marketValueMinor)throw new Error('PURSE_POSITION_EXECUTABLE_VALUE_EXCEEDS_MARK')
 iso(p.observedAt,'PURSE_POSITION_TIME_INVALID')
 if(p.observedAt>now)throw new Error('PURSE_POSITION_FUTURE_EVIDENCE')
}

export function assertPurseLedgerEntry(e:PurseLedgerEntry,now:string):void{
 if(!e.entryId||!e.accountId||!e.nativeCurrency||!e.reportingCurrency||e.authority!=='LEDGER_EVIDENCE'||!e.evidenceIds.length)throw new Error('PURSE_LEDGER_EVIDENCE_INVALID')
 iso(e.occurredAt,'PURSE_LEDGER_TIME_INVALID')
 if(e.occurredAt>now)throw new Error('PURSE_LEDGER_FUTURE_EVIDENCE')
 if((e.kind==='VALUATION'||e.kind==='RECONCILIATION')&&(e.cashImpactMinor!==0n||e.realizedPnlImpactMinor!==0n))throw new Error('PURSE_NONCASH_ENTRY_CANNOT_CREATE_CASH_OR_REALIZED_PNL')
 if(e.kind==='TRANSFER'&&e.realizedPnlImpactMinor!==0n)throw new Error('PURSE_TRANSFER_CANNOT_CREATE_REALIZED_PNL')
 if(e.kind==='FEE'&&e.realizedPnlImpactMinor>0n)throw new Error('PURSE_FEE_CANNOT_CREATE_PROFIT')
}

export function buildPursePortfolioSnapshot(input:{
 userId:string
 cofferId:string
 reportingCurrency:string
 accounts:readonly PurseAccountSnapshot[]
 positions:readonly PursePositionSnapshot[]
 ledgerEntries?:readonly PurseLedgerEntry[]
 observedAt:string
}):PursePortfolioSnapshot{
 if(!input.userId||!input.cofferId||!input.reportingCurrency)throw new Error('PURSE_PORTFOLIO_IDENTITY_REQUIRED')
 iso(input.observedAt,'PURSE_PORTFOLIO_TIME_INVALID')
 const accountIds=new Set<string>()
 const positionIds=new Set<string>()
 const ledgerEntryIds=new Set<string>()
 for(const a of input.accounts){
  assertPurseAccountSnapshot(a,input.observedAt)
  if(accountIds.has(a.accountId))throw new Error('PURSE_DUPLICATE_ACCOUNT_ID')
  accountIds.add(a.accountId)
  if(a.reportingCurrency!==input.reportingCurrency)throw new Error('PURSE_ACCOUNT_REPORTING_CURRENCY_MISMATCH')
 }
 for(const p of input.positions){
  assertPursePositionSnapshot(p,input.observedAt)
  if(positionIds.has(p.positionId))throw new Error('PURSE_DUPLICATE_POSITION_ID')
  positionIds.add(p.positionId)
  if(!accountIds.has(p.accountId))throw new Error('PURSE_POSITION_ACCOUNT_MISSING')
  if(p.reportingCurrency!==input.reportingCurrency)throw new Error('PURSE_POSITION_REPORTING_CURRENCY_MISMATCH')
 }
 for(const e of input.ledgerEntries??[]){
  assertPurseLedgerEntry(e,input.observedAt)
  if(ledgerEntryIds.has(e.entryId))throw new Error('PURSE_DUPLICATE_LEDGER_ENTRY_ID')
  ledgerEntryIds.add(e.entryId)
  if(!accountIds.has(e.accountId)||e.reportingCurrency!==input.reportingCurrency)throw new Error('PURSE_LEDGER_BINDING_MISMATCH')
 }
 const totalAccountValue=input.accounts.reduce((n,x)=>n+x.reportingValueMinor,0n)
 const totalPositionValue=input.positions.reduce((n,x)=>n+x.marketValueMinor,0n)
 const evidenceIds=unique([
  ...input.accounts.flatMap(x=>x.evidenceIds),
  ...input.positions.flatMap(x=>x.evidenceIds),
  ...(input.ledgerEntries??[]).flatMap(x=>x.evidenceIds),
 ])
 const realizedFromLedger=(input.ledgerEntries??[]).filter(x=>x.reconciled).reduce((n,x)=>n+x.realizedPnlImpactMinor,0n)
 return Object.freeze({
  snapshotId:'purse-portfolio:'+hash({userId:input.userId,cofferId:input.cofferId,accounts:input.accounts.map(x=>[x.accountId,x.reportingValueMinor,x.liquidReportingValueMinor,x.reservedReportingValueMinor,x.unsettledReportingValueMinor,x.evidenceIds]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),positions:input.positions.map(x=>[x.positionId,x.accountId,x.instrumentId,x.marketValueMinor,x.costBasisMinor,x.evidenceIds]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),ledger:(input.ledgerEntries??[]).map(x=>[x.entryId,x.kind,x.cashImpactMinor,x.realizedPnlImpactMinor,x.reconciled,x.evidenceIds]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),observedAt:input.observedAt}),
  userId:input.userId,cofferId:input.cofferId,reportingCurrency:input.reportingCurrency,totalAccountValueMinor:totalAccountValue,totalPositionValueMinor:totalPositionValue,
  grossPortfolioValueMinor:totalAccountValue+totalPositionValue,liquidAccountValueMinor:input.accounts.reduce((n,x)=>n+x.liquidReportingValueMinor,0n),
  executablePositionValueMinor:input.positions.reduce((n,x)=>n+x.executableExitValueMinor,0n),unsettledMinor:input.accounts.reduce((n,x)=>n+x.unsettledReportingValueMinor,0n),
  reservedMinor:input.accounts.reduce((n,x)=>n+x.reservedReportingValueMinor,0n),realizedPnlMinor:realizedFromLedger,
  unrealizedPnlMinor:input.positions.reduce((n,x)=>n+x.unrealizedPnlMinor,0n),accounts:Object.freeze([...input.accounts]),positions:Object.freeze([...input.positions]),
  observedAt:input.observedAt,evidenceIds,authority:'PORTFOLIO_EVIDENCE',canExecute:false,
 })
}

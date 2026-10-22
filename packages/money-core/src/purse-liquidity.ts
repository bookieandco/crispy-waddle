import { createHash } from 'node:crypto'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertJhadinaPurseCharter } from './jhadina-purse-charter.js'
import type { PursePortfolioSnapshot } from './purse-portfolio.js'

export type PurseLiquidityObligations=Readonly<{
 pendingWithdrawalsMinor:bigint
 pendingFeesMinor:bigint
 pendingTaxReserveMinor:bigint
 ownerSweepHoldMinor:bigint
 chainFeeReserveMinor:bigint
 otherRestrictedMinor:bigint
 evidenceIds:readonly string[]
 authority:'LIQUIDITY_OBLIGATION_EVIDENCE'
}>

export type PurseLiquiditySnapshot=Readonly<{
 liquiditySnapshotId:string
 charterId:string
 portfolioSnapshotId:string
 reportingCurrency:string
 grossLiquidMinor:bigint
 unsettledMinor:bigint
 accountReservedMinor:bigint
 charterProtectedReserveMinor:bigint
 externalObligationsMinor:bigint
 availableToAllocateMinor:bigint
 availableForWithdrawalMinor:bigint
 executableExitValueMinor:bigint
 ownerSweepHoldMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'LIQUIDITY_EVIDENCE'
 canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const max=(a:bigint,b:bigint)=>a>b?a:b
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function assertObligations(o:PurseLiquidityObligations):void{
 for(const x of [o.pendingWithdrawalsMinor,o.pendingFeesMinor,o.pendingTaxReserveMinor,o.ownerSweepHoldMinor,o.chainFeeReserveMinor,o.otherRestrictedMinor])if(x<0n)throw new Error('PURSE_LIQUIDITY_OBLIGATION_NEGATIVE')
 if(o.authority!=='LIQUIDITY_OBLIGATION_EVIDENCE'||!o.evidenceIds.length)throw new Error('PURSE_LIQUIDITY_OBLIGATION_EVIDENCE_INVALID')
}

export function buildPurseLiquiditySnapshot(input:{
 charter:JhadinaPurseCharter
 portfolio:PursePortfolioSnapshot
 obligations:PurseLiquidityObligations
 observedAt:string
}):PurseLiquiditySnapshot{
 assertJhadinaPurseCharter(input.charter,input.observedAt)
 assertObligations(input.obligations)
 const {charter,portfolio,obligations}=input
 if(portfolio.authority!=='PORTFOLIO_EVIDENCE'||portfolio.canExecute!==false)throw new Error('PURSE_LIQUIDITY_PORTFOLIO_INVALID')
 if(portfolio.cofferId!==charter.cofferId||portfolio.userId!==charter.userId||portfolio.reportingCurrency!==charter.reportingCurrency)throw new Error('PURSE_LIQUIDITY_PORTFOLIO_BINDING_MISMATCH')
 if(portfolio.observedAt>input.observedAt)throw new Error('PURSE_LIQUIDITY_FUTURE_PORTFOLIO')
 const protectedReserve=charter.minLiquidReserveMinor+charter.minEmergencyReserveMinor
 const externalObligations=obligations.pendingWithdrawalsMinor+obligations.pendingFeesMinor+obligations.pendingTaxReserveMinor+obligations.ownerSweepHoldMinor+obligations.chainFeeReserveMinor+obligations.otherRestrictedMinor
 const grossLiquid=portfolio.liquidAccountValueMinor
 const allocateDeductions=portfolio.unsettledMinor+portfolio.reservedMinor+protectedReserve+externalObligations
 const withdrawalDeductions=portfolio.unsettledMinor+portfolio.reservedMinor+protectedReserve+obligations.pendingWithdrawalsMinor+obligations.pendingFeesMinor+obligations.pendingTaxReserveMinor+obligations.chainFeeReserveMinor+obligations.otherRestrictedMinor
 return Object.freeze({
  liquiditySnapshotId:'purse-liquidity:'+hash({charterId:charter.charterId,portfolio:portfolio.snapshotId,obligations,observedAt:input.observedAt}),
  charterId:charter.charterId,portfolioSnapshotId:portfolio.snapshotId,reportingCurrency:charter.reportingCurrency,grossLiquidMinor:grossLiquid,
  unsettledMinor:portfolio.unsettledMinor,accountReservedMinor:portfolio.reservedMinor,charterProtectedReserveMinor:protectedReserve,externalObligationsMinor:externalObligations,
  availableToAllocateMinor:max(0n,grossLiquid-allocateDeductions),availableForWithdrawalMinor:max(0n,grossLiquid-withdrawalDeductions),
  executableExitValueMinor:portfolio.executablePositionValueMinor,ownerSweepHoldMinor:obligations.ownerSweepHoldMinor,observedAt:input.observedAt,
  evidenceIds:unique([...portfolio.evidenceIds,...obligations.evidenceIds,...charter.evidenceIds]),authority:'LIQUIDITY_EVIDENCE',canExecute:false,
 })
}

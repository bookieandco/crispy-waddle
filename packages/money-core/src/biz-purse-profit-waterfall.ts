import {createHash} from 'node:crypto'

export type BusinessProfitPolicy = Readonly<{
  policyId:string
  currency:string
  ownerShareBps:number
  retainedReserveBps:number
  reinvestmentBps:number
  protectedCashFloorMinor:bigint
  authority:'OWNER_POLICY'
}>
export type BusinessProfitPeriod = Readonly<{
  businessId:string
  periodId:string
  currency:string
  settledRevenueMinor:bigint
  refundsMinor:bigint
  directCostsMinor:bigint
  providerFeesMinor:bigint
  taxAndObligationProvisionMinor:bigint
  previouslyAllocatedProfitMinor:bigint
  settledCashMinor:bigint
  otherReservedCashMinor:bigint
  observedAt:string
  evidenceIds:readonly string[]
  authority:'SETTLED_ACCOUNTING_EVIDENCE'
}>
export type BusinessProfitProposal=Readonly<{
  planId:string
  businessId:string
  periodId:string
  currency:string
  netUnallocatedProfitMinor:bigint
  reversalDeficitMinor:bigint
  ownerEntitlementMinor:bigint
  ownerProtectedNowMinor:bigint
  ownerUnfundedMinor:bigint
  retainedReserveMinor:bigint
  reinvestmentLimitMinor:bigint
  withheldForLiquidityMinor:bigint
  status:'NO_PROFIT'|'ACCOUNTING_DEFICIT'|'LIQUIDITY_BLOCKED'|'PARTIALLY_FUNDED'|'ALLOCATABLE'
  evidenceIds:readonly string[]
  authority:'PROPOSAL_ONLY'
  canMoveMoney:false
  canPlaceOrders:false
}>
const MAX_BPS=10000
const max=(a:bigint,b:bigint)=>a>b?a:b
const min=(a:bigint,b:bigint)=>a<b?a:b
export function proposeBusinessProfitWaterfall(input:Readonly<{policy:BusinessProfitPolicy,period:BusinessProfitPeriod}>):BusinessProfitProposal {
  const {policy:p,period:s}=input
  if (p.authority!=='OWNER_POLICY'||!p.policyId||!p.currency||p.currency!==s.currency) throw new Error('BIZ_PURSE_POLICY_INVALID')
  const bps=[p.ownerShareBps,p.retainedReserveBps,p.reinvestmentBps]
  if (bps.some(n=>!Number.isInteger(n)||n<0||n>MAX_BPS)||bps.reduce((a,b)=>a+b,0)!==MAX_BPS) throw new Error('BIZ_PURSE_SHARES_INVALID')
  if (p.protectedCashFloorMinor<0n) throw new Error('BIZ_PURSE_CASH_FLOOR_INVALID')
  if (s.authority!=='SETTLED_ACCOUNTING_EVIDENCE'||!s.businessId||!s.periodId||!Number.isFinite(Date.parse(s.observedAt))) throw new Error('BIZ_PURSE_EVIDENCE_INVALID')
  if (!s.evidenceIds.length||new Set(s.evidenceIds).size!==s.evidenceIds.length||s.evidenceIds.some(id=>!id.trim())) throw new Error('BIZ_PURSE_EVIDENCE_IDS_INVALID')
  const values=[s.settledRevenueMinor,s.refundsMinor,s.directCostsMinor,s.providerFeesMinor,s.taxAndObligationProvisionMinor,s.previouslyAllocatedProfitMinor,s.settledCashMinor,s.otherReservedCashMinor]
  if (values.some(n=>n<0n)) throw new Error('BIZ_PURSE_NEGATIVE_ACCOUNTING_INPUT')
  // Every number is in integer minor units. No unsettled or forecast revenue is accepted.
  const gross=s.settledRevenueMinor-s.refundsMinor-s.directCostsMinor-s.providerFeesMinor-s.taxAndObligationProvisionMinor
  const remaining=gross-s.previouslyAllocatedProfitMinor
  const reversalDeficit=max(0n,-remaining)
  const net=max(0n,remaining)
  const cashAvailable=max(0n,s.settledCashMinor-s.otherReservedCashMinor-p.protectedCashFloorMinor)
  // Rounding remainder stays with retained reserve, never with an executable spend path.
  const owner=net*BigInt(p.ownerShareBps)/10000n
  const reinvestTarget=net*BigInt(p.reinvestmentBps)/10000n
  const reserveTarget=net-owner-reinvestTarget
  const ownerNow=min(owner,cashAvailable)
  const reserveNow=min(reserveTarget,max(0n,cashAvailable-ownerNow))
  const reinvestNow=min(reinvestTarget,max(0n,cashAvailable-ownerNow-reserveNow))
  const withheld=net-ownerNow-reserveNow-reinvestNow
  const status:BusinessProfitProposal['status']=reversalDeficit>0n?'ACCOUNTING_DEFICIT':net===0n?'NO_PROFIT':cashAvailable===0n?'LIQUIDITY_BLOCKED':withheld>0n?'PARTIALLY_FUNDED':'ALLOCATABLE'
  const digest=createHash('sha256').update(JSON.stringify({policyId:p.policyId,policyBps:bps,protectedFloor:p.protectedCashFloorMinor.toString(),businessId:s.businessId,periodId:s.periodId,currency:s.currency,evidenceIds:[...s.evidenceIds].sort(),settledRevenue:s.settledRevenueMinor.toString(),refunds:s.refundsMinor.toString(),costs:s.directCostsMinor.toString(),fees:s.providerFeesMinor.toString(),tax:s.taxAndObligationProvisionMinor.toString(),prior:s.previouslyAllocatedProfitMinor.toString(),cash:s.settledCashMinor.toString(),reservedCash:s.otherReservedCashMinor.toString(),deficit:reversalDeficit.toString(),net:net.toString(),ownerNow:ownerNow.toString(),reserveNow:reserveNow.toString(),reinvestNow:reinvestNow.toString()})).digest('hex')
  return Object.freeze({planId:'business-profit:'+digest,businessId:s.businessId,periodId:s.periodId,currency:s.currency,
    netUnallocatedProfitMinor:net,reversalDeficitMinor:reversalDeficit,ownerEntitlementMinor:owner,ownerProtectedNowMinor:ownerNow,
    ownerUnfundedMinor:owner-ownerNow,retainedReserveMinor:reserveNow,
    reinvestmentLimitMinor:reinvestNow,withheldForLiquidityMinor:withheld,status,
    evidenceIds:Object.freeze([...s.evidenceIds]),authority:'PROPOSAL_ONLY' as const,canMoveMoney:false as const,canPlaceOrders:false as const})
}

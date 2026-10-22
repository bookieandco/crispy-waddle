import {describe,it,expect} from 'vitest'
import {PURSE_COMMERCIAL_TABLES,projectPurseSelfFundingStatus} from './purse-self-funding-status'
const checks=PURSE_COMMERCIAL_TABLES.map(name=>({name,state:'QUERYABLE_NOT_CERTIFIED' as const}))
const sample={observedAt:'2026-10-22T05:00:00Z',workspace:{coffer:null,sweepPolicy:null},
 schemaChecks:checks,fundingRailAdmission:'UNKNOWN' as const}
describe('owner Purse self-funding truth',()=>{
 it('never calls a missing ledger zero earnings',()=>{
  const x=projectPurseSelfFundingStatus(sample)
  expect(x.verifiedSettledRevenueMinor).toBeNull()
  expect(x.verifiedOwnerPaydayMinor).toBeNull()
  expect(x.operatingRunwayDays).toBeNull()
  expect(x.canMoveMoney).toBe(false)
 })
 it('queryable tables cannot self-certify production',()=>{
  const x=projectPurseSelfFundingStatus({...sample,workspace:{coffer:{
   cofferId:'c',currency:'USD',state:'ACTIVE' as const,principalCapitalMinor:'500',
   hardStopFloorMinor:'100',survivalFloorMinor:'200',defensiveFloorMinor:'300',maxDeployableBps:2000,
  },sweepPolicy:{thresholdMinor:'10',retainMinor:'20',planningReserveBps:2500,
   enabled:true,verifiedOwnerDestinationId:'owner:approved',standingMandateId:null}}})
  expect(x.status).toBe('NOT_COMMISSIONED')
  expect(x.blockers).toContain('NO_INDEPENDENT_CUSTODY_AND_SETTLED_REVENUE_EVIDENCE')
 })
 it('duplicate or omitted table evidence fails',()=>{
  expect(()=>projectPurseSelfFundingStatus({...sample,schemaChecks:[...checks.slice(1),checks[1]]})).toThrow()
  expect(()=>projectPurseSelfFundingStatus({...sample,schemaChecks:checks.slice(1)})).toThrow()
 })
})

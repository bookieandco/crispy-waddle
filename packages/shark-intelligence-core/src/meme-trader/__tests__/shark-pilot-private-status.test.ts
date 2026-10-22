import {describe,it,expect} from 'vitest'
import {renderSharkPrivatePilotStatus} from '../shark-pilot-private-status'
import type {CommissionAcceptance,CommissionPaperReview} from '../shark-commission-27-32'
const acceptance={status:'NOT_COMMISSIONED',blockers:['host-not-approved'],
 observedMints:0,noDeployment:true,noSpend:true,noSign:true,noLiveTrading:true} as const satisfies CommissionAcceptance
describe('SHARK-PILOT.35–.37 private recovery preview',()=>{
 it('keeps zero-data fixtures blocked and forbids delivery or revenue claims',()=>{
  const result=renderSharkPrivatePilotStatus({acceptance})
  expect(result.status).toBe('OFFLINE_ACCEPTANCE_BLOCKED')
  expect(result.blockers).toContain('recovery-evidence-not-provided')
  expect(result.confirmedDeviceDelivery).toBe(false)
  expect(result.verifiedProfit).toBe(false)
  expect(result.canSpend).toBe(false)
  expect(result.canTrade).toBe(false)
 })
 it('blocks incomplete encrypted restore even with paper observations',()=>{
  const paper={observedLaunches:1,prospectiveLaunches:1,missedMarked2x:0,
   missingOrCensored:1,indicativeShadowReviews:0,priceOnlyFollowups:0,
   verifiedMoneyFills:0,estimatedExecutableReturn:false,noLiveOrders:true
  } as const satisfies CommissionPaperReview
  const result=renderSharkPrivatePilotStatus({acceptance,paper,recovery:{
   localLedgerIntegrityVerified:true,sameHeadRestoreVerified:true,
   encryptedOffHostRestoreVerified:false,
   failureRecoveryReplayedWithoutDuplication:true,
   ownerPhoneReadbackVerified:false,providerTimeoutTestPassed:true,
   evidenceIds:['local-proof']}})
  expect(result.blockers).toContain('encrypted-offhost-restore-not-verified')
  expect(result.blockers).toContain('owner-phone-readback-not-verified')
  expect(result.prospectiveCases).toBe(1)
  expect(result.canDeploy).toBe(false)
 })
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareSniperMainnetCanaryApproval,REQUIRED_SHADOW_TABLES,
 type SniperCommissionEvidence} from './sniper-live-commission-readiness.js'
const base=():SniperCommissionEvidence=>({
 asOf:'2026-10-23T20:00:00Z',
 ownerWalletConnectionId:'phantom:owner',
 isolatedCofferWalletConnectionId:'coffer:separate',
 ownerAuthenticatedIphoneVerified:true,
 privatePreviewUnauthorizedUserDenied:true,
 trustedSignerHostIsolated:true,
 trustedRpcProofsVerified:true,
 signerMessageRevalidationPassed:true,
 atomicSignerPermitReservationPassed:true,
 signerRevocationDrillPassed:true,
 crashRecoveryUnknownSettlementDrillPassed:true,
 signerLiveDisabled:true,
 canaryBudgetOwnerApprovalRecorded:true,
 prospectiveHeliusLaunches:125,independentlyVerifiedLaunches:105,
 originalPairQuotePairs:35,verifiedTwoSidedSellPaths:25,
 sampledConfirmedExitSettlements:7,realSourceLatencyMeasured:true,
 shadowTablesPresent:[...REQUIRED_SHADOW_TABLES],
 riskMetricAgeMs:400,ownerFundingAuthorizationId:'approval:example',
 evidenceIds:['prospective:chain:1'],
})
const proposed={totalMinor:50000000n,orderMinor:5000000n,dailyLossStopMinor:10000000n}
test('full hypothetical evidence yields a review packet but never trade authority',()=>{
 const r=prepareSniperMainnetCanaryApproval({evidence:base(),proposed})
 assert.equal(r.status,'READY_FOR_SEPARATE_OWNER_REVIEW')
 assert.deepEqual(r.blockers,[])
 assert.equal(r.canTrade,false)
 assert.equal(r.canSign,false)
 assert.equal(r.canSubmit,false)
 assert.equal(r.canFund,false)
 assert.equal(r.moneyMovement,'DISABLED')
 assert.equal(r.ownerLiveApprovalRequired,true)
})
test('current source-only environment remains BLOCKED without chain, storage, signer and user funding',()=>{
 const e={...base(),ownerAuthenticatedIphoneVerified:false,
  trustedSignerHostIsolated:false,trustedRpcProofsVerified:false,
  atomicSignerPermitReservationPassed:false,
  prospectiveHeliusLaunches:0,independentlyVerifiedLaunches:0,
  sampledConfirmedExitSettlements:0,
  shadowTablesPresent:[],ownerFundingAuthorizationId:undefined,
  canaryBudgetOwnerApprovalRecorded:false}
 const r=prepareSniperMainnetCanaryApproval({evidence:e})
 assert.equal(r.status,'BLOCKED')
 assert.equal(r.missingShadowTables.length,6)
 assert.ok(r.blockers.includes('PROSPECTIVE_CHAIN_COHORT_UNVERIFIED'))
 assert.ok(r.blockers.includes('CANONICAL_SHADOW_OR_SNIPER_ARCHIVE_MISSING'))
 assert.ok(r.blockers.includes('DISTRIBUTED_ATOMIC_SIGNER_GATE_UNCERTIFIED'))
 assert.ok(r.blockers.includes('EXPLICIT_FUNDING_APPROVAL_NOT_RECEIVED'))
 assert.equal(r.canTrade,false)
})
test('rug, malformed risk data and emergency stop never imply a safe live canary',()=>{
 for(const patch of [
  {signerLiveDisabled:false},
  {signerRevocationDrillPassed:false},
  {crashRecoveryUnknownSettlementDrillPassed:false},
  {verifiedTwoSidedSellPaths:0},
  {originalPairQuotePairs:0},
  {riskMetricAgeMs:100000},
  {ownerWalletConnectionId:'same',isolatedCofferWalletConnectionId:'same'},
  {independentlyVerifiedLaunches:126},
 ]){
  const r=prepareSniperMainnetCanaryApproval({evidence:{...base(),...patch},proposed})
  assert.equal(r.status,'BLOCKED')
  assert.equal(r.canSign,false)
 }
})
test('missing cap proposal, incorrect amounts, and future evidence do not authorize money',()=>{
 for(const p of [
  undefined,
  {totalMinor:0n,orderMinor:5n,dailyLossStopMinor:2n},
  {totalMinor:10n,orderMinor:11n,dailyLossStopMinor:2n},
  {totalMinor:10n,orderMinor:5n,dailyLossStopMinor:11n},
 ]){
  const r=prepareSniperMainnetCanaryApproval({evidence:base(),proposed:p})
  assert.equal(r.status,'BLOCKED')
  assert.equal(r.canTrade,false)
 }
 assert.throws(()=>prepareSniperMainnetCanaryApproval({
  evidence:{...base(),sampledConfirmedExitSettlements:-1},proposed,
 }),/EVIDENCE_INVALID/)
})

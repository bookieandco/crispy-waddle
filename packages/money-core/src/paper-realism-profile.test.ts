import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessPaperRealism,
  createPaperRealismProfile,
} from './paper-realism-profile.js';

test('paper realism defaults to unlevered simulation and never implies live equivalence',()=>{
  const profile=createPaperRealismProfile({
    profileId:'realistic-stock-paper',
    startingEquityMinor:1_000_000n,
    currency:'USD',
  })
  assert.equal(profile.leverageBps,10000)
  assert.equal(profile.marginEnabled,false)
  assert.equal(profile.paperSuccessCanAuthorizeLive,false)
  assert.equal(profile.psychologicalEquivalenceToLive,false)
  assert.equal(profile.warmupExecutionCount,10)
})

test('paper realism fails unlevered over-sizing and missing protective exits',()=>{
  const profile=createPaperRealismProfile({
    profileId:'realistic-stock-paper',
    startingEquityMinor:1_000_000n,
    currency:'USD',
    maximumRiskPerTradeBps:100,
  })
  const assessment=assessPaperRealism({
    profile,
    currentEquityMinor:500_000n,
    requestedNotionalMinor:600_000n,
    plannedMaximumLossMinor:20_000n,
    hasProtectiveExitPlan:false,
  })
  assert.equal(assessment.status,'FAIL')
  assert.ok(assessment.reasonCodes.includes('UNLEVERED_NOTIONAL_EXCEEDS_EQUITY'))
  assert.ok(assessment.reasonCodes.includes('PROTECTIVE_EXIT_REQUIRED'))
  assert.ok(assessment.reasonCodes.includes('RISK_PER_TRADE_EXCEEDED'))
  assert.equal(assessment.canAuthorizeLive,false)
})

test('paper realism rejects hidden leverage when margin is disabled',()=>{
  assert.throws(
    ()=>createPaperRealismProfile({
      profileId:'bad',
      startingEquityMinor:1_000_000n,
      currency:'USD',
      leverageBps:20_000,
      marginEnabled:false,
    }),
    /MONEY_PAPER_REALISM_MARGIN_LEVERAGE_MISMATCH/,
  )
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {
 buildPurseTreasurySnapshot,
 createPurseTreasuryMovementProposal,
 promoteApprovedPurseTreasuryMovement,
 buildPurseReserveAndProfitDecision,
 derivePurseSurvivalState,
} from './purse-treasury-public-api.js'
import {
 buildCofferTreasurySnapshot,
 createCofferTreasuryMovementProposal,
 promoteApprovedCofferTreasuryMovement,
} from './coffer-treasury-contracts.js'
import {buildCofferAccountantDecision,deriveCofferSurvivalState} from './coffer-accountant.js'
import {
 buildShadowPaperAllocationCycle,
 recordShadowPaperAllocationCycle,
 PostgresShadowPaperStore,
 fingerprintShadowPaperAllocationCycle,
 runShadowPaperAllocationTick,
 reviewShadowTradingEvidence,
 compareShadowPaperLearning,
 reviewShadowPaperCertification,
} from './money-shadow-paper-public-api.js'
import {buildAutonomousPursePaperCycle,recordAutonomousPursePaperCycle} from './purse-paper-autonomy.js'
import {PostgresPursePaperStore,fingerprintPursePaperCycle} from './postgres-purse-paper-store.js'
import {runPurseCommissionPaperTick} from './purse-commission-paper-runtime.js'
import {reviewPurseShadowEvidence} from './purse-shadow-evidence-admission.js'
import {comparePursePaperLearning} from './purse-paper-learning-evaluation.js'
import {reviewPursePaperCertification} from './purse-auto-paper-certification.js'

test('NAMING.01 Purse is the exact same treasury engine as legacy Coffer, not a second ledger',()=>{
 assert.equal(buildPurseTreasurySnapshot,buildCofferTreasurySnapshot)
 assert.equal(createPurseTreasuryMovementProposal,createCofferTreasuryMovementProposal)
 assert.equal(promoteApprovedPurseTreasuryMovement,promoteApprovedCofferTreasuryMovement)
 assert.equal(buildPurseReserveAndProfitDecision,buildCofferAccountantDecision)
 assert.equal(derivePurseSurvivalState,deriveCofferSurvivalState)
})
test('NAMING.02 SHADOW paper code is the original tested Money Core simulation, not spendable Purse cash',()=>{
 assert.equal(buildShadowPaperAllocationCycle,buildAutonomousPursePaperCycle)
 assert.equal(recordShadowPaperAllocationCycle,recordAutonomousPursePaperCycle)
 assert.equal(PostgresShadowPaperStore,PostgresPursePaperStore)
 assert.equal(fingerprintShadowPaperAllocationCycle,fingerprintPursePaperCycle)
 assert.equal(runShadowPaperAllocationTick,runPurseCommissionPaperTick)
 assert.equal(reviewShadowTradingEvidence,reviewPurseShadowEvidence)
 assert.equal(compareShadowPaperLearning,comparePursePaperLearning)
 assert.equal(reviewShadowPaperCertification,reviewPursePaperCertification)
})

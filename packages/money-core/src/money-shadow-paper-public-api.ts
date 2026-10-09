/**
 * Money Core / SHARK / SHADOW owns the paper simulation and evidence/learning
 * formerly filed under PURSE-AUTO.09-.13 and PURSE-COMMISSION.01-.05.
 * Legacy purse-paper SQL tables and exports are kept as exact aliases for
 * compatibility and recovery; simulated results do not enter Purse cash.
 */
export {
 buildAutonomousPursePaperCycle as buildShadowPaperAllocationCycle,
 recordAutonomousPursePaperCycle as recordShadowPaperAllocationCycle,
} from './purse-paper-autonomy.js'
export type {
 PursePaperCycle as ShadowPaperAllocationCycle,
 PursePaperLease as ShadowPaperWorkerLease,
 PursePaperCycleStore as ShadowPaperCycleStore,
} from './purse-paper-autonomy.js'
export {
 PostgresPursePaperStore as PostgresShadowPaperStore,
 fingerprintPursePaperCycle as fingerprintShadowPaperAllocationCycle,
} from './postgres-purse-paper-store.js'
export {
 runPurseCommissionPaperTick as runShadowPaperAllocationTick,
 createPurseCommissionUnavailableReceipt as createShadowPaperUnavailableReceipt,
} from './purse-commission-paper-runtime.js'
export {
 reviewPurseShadowEvidence as reviewShadowTradingEvidence,
} from './purse-shadow-evidence-admission.js'
export {
 comparePursePaperLearning as compareShadowPaperLearning,
} from './purse-paper-learning-evaluation.js'
export {
 reviewPursePaperCertification as reviewShadowPaperCertification,
} from './purse-auto-paper-certification.js'
export {
 reconcilePursePaperPayday as reconcileShadowHypotheticalPayday,
} from './purse-paper-payday-reconciliation.js'

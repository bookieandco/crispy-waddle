/**
 * Product naming: Purse is the owner-governed live capital treasury formerly
 * called Coffer in the customer interface.
 *
 * Coffer remains the stable persistence/signing namespace until a separately
 * reviewed schema migration. These are the SAME implementation, not a second
 * treasury, wallet, accountant, authorization service or ledger.
 */
export {
 buildCofferTreasurySnapshot as buildPurseTreasurySnapshot,
 createCofferTreasuryMovementProposal as createPurseTreasuryMovementProposal,
 promoteApprovedCofferTreasuryMovement as promoteApprovedPurseTreasuryMovement,
 classifyCofferConversion as classifyPurseConversion,
 createCofferConversionProposal as createPurseConversionProposal,
 promoteApprovedCofferConversion as promoteApprovedPurseConversion,
} from './coffer-treasury-contracts.js'
export type {
 CofferTreasurySnapshot as PurseTreasurySnapshot,
 CofferTreasuryEndpoint as PurseTreasuryEndpoint,
 CofferAssetBalanceEvidence as PurseAssetBalanceEvidence,
 CofferTreasuryMovementProposal as PurseTreasuryMovementProposal,
 CofferConversionQuote as PurseConversionQuote,
 CofferConversionProposal as PurseConversionProposal,
} from './coffer-treasury-contracts.js'
export {
 buildCofferAccountantDecision as buildPurseReserveAndProfitDecision,
 deriveCofferSurvivalState as derivePurseSurvivalState,
} from './coffer-accountant.js'
export type {
 CofferPolicy as PurseOwnerTreasuryPolicy,
 CofferAccountingSnapshot as PurseTreasuryAccountingSnapshot,
 CofferAccountantDecision as PurseTreasuryAccountantDecision,
} from './coffer-accountant.js'

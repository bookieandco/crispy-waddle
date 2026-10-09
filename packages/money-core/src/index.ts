// Public surface for @jhadina/money-core. package.json's "main"/"types" have pointed at this file since the package was created; it never existed, so nothing outside packages/money-core has ever been able to import this package by its bare specifier. Added as part of Spine Proof #3 (Money/Plaid), the first cross-package consumer.
export type { MoneyCapability, CapabilityRisk } from './capabilities.js';
export { getMoneyCapability, requiresMoneyApproval, isMoneyCapability } from './capabilities.js';
export type { MoneyAccount, MoneyTransaction, MoneyAdapterContext, BankAdapter } from './bank-adapter.js';
export { assertCapability } from './bank-adapter.js';
export type { ResolvedCredential, CredentialResolver } from './credential-resolver.js';
export { EnvironmentCredentialResolver, credentialRefToEnvKey } from './credential-resolver.js';
export type { ProviderHealthStatus, ProviderConfig, ProviderHealth, ProviderHealthChecker } from './provider-health.js';
export { MoneyProviderHealthGate } from './provider-health.js';
export { MoneyProviderRegistry } from './provider-registry.js';
export type { ProviderAdapterBuilder, ProviderAdapterFactoryOptions } from './provider-adapter-factory.js';
export { ProviderAdapterFactory } from './provider-adapter-factory.js';
export type { AccountReadAction, AccountReadHandlerDeps } from './account-read-handler.js';
export { MoneyAccountReadHandler } from './account-read-handler.js';
export type { TransactionReadAction, MoneyAccountOwnership } from './transaction-read-handler.js';
export { MoneyTransactionReadHandler } from './transaction-read-handler.js';
export type { ProductionMoneyTransactionReadOptions } from './production-transaction-read.js';
export { createProductionMoneyTransactionReadExecutor } from './production-transaction-read.js';
export type { GovernedProviderTransactionReadOptions } from './governed-provider-transaction-read.js';
export { createGovernedProviderTransactionReadExecutor } from './governed-provider-transaction-read.js';
export type { GovernedAccountReadDeps, MoneyAccountReadRequest } from './governed-account-read.js';
export { MONEY_CORE_SECURITY_POLICY, createMoneyAccountReadSecurityRequest, createMoneyAccountReadHandler, createMoneySecurityCore } from './governed-account-read.js';
export type { ProductionMoneyAccountReadOptions } from './production-account-read.js';
export { createProductionMoneyAccountReadExecutor } from './production-account-read.js';
export type { GovernedProviderAccountReadOptions } from './governed-provider-account-read.js';
export { createGovernedProviderAccountReadExecutor } from './governed-provider-account-read.js';
export type { HttpClient, ReadOnlyHttpBankAdapterOptions } from './read-only-http-bank-adapter.js';
export { ReadOnlyHttpBankAdapter } from './read-only-http-bank-adapter.js';
export type { PlaidReadOnlyAdapterOptions } from './plaid-read-only-adapter.js';
export { PlaidReadOnlyAdapter } from './plaid-read-only-adapter.js';
export { buildPlaidReadOnlyAdapter, createPlaidReadOnlyAdapterBuilder } from './plaid-provider-builder.js';
export { PLAID_READ_ONLY_CONFIG, PLAID_SANDBOX_BASE_URL, assertPlaidSandboxBaseUrl, createPlaidProviderAdapterFactory } from './plaid-provider-registration.js';
export type { AssetClass, EvidenceQuality, EvidenceRef, FinancialHypothesis, PredictionDistribution, OpportunityCandidate, AllocationDecision, CapitalAllocationRequest, CapitalAllocationDecision, CanonicalFinancialAction } from './financial-intelligence-contracts.js';
export { assertIntelligenceOnly, assertProbability, assertPositiveAmount } from './financial-intelligence-contracts.js';
export type { IssuerStatus, IssuerIdentifierType, IssuerRelationshipType, IssuerInstrumentRelationshipType, FilingStatus, FactStatus, FundamentalStateStatus, ExactFinancialValue, Issuer, IssuerIdentifier, IssuerRelationship, IssuerInstrumentRelationship, Filing, FilingDocument, FinancialFactDimension, FinancialFact, FactRevision, FundamentalState } from './issuer-reality-contracts.js';
export { assertFiling, assertIssuerIdentifier, selectIssuerIdentifiersAt, assertPointInTimeFact, factWasAvailableAt, selectFactsAtCutoff, revisionsForFact, selectActiveFactsAtCutoff, buildFundamentalState, assertIssuerInstrumentRelationship, relationshipWasEffectiveAt, selectIssuerInstrumentRelationshipsAt } from './issuer-reality-contracts.js';
export type { SharkFundamentalInput } from './shark-fundamental-adapter.js';
export { toSharkFundamentalInput } from './shark-fundamental-adapter.js';
export type { AccountingValue, AccountingTreatment, PeriodKind, NormalizationStatus, AccountingConcept, NormalizationRule, NormalizedMetric, TtmMetric } from './fundamental-normalization-contracts.js';
export { assertAccountingValue, assertNormalizedMetric, normalizeReportedFact, buildTtmMetric, assertQuarterlyTtmWindow } from './fundamental-normalization-contracts.js';
export type { InvoiceEvidence, InvoiceValidationState, InvoiceAccountingCandidate } from './invoice-evidence.js';
export { validateInvoiceAmount, validateExtractionConfidence } from './invoice-evidence.js';
export type { PermitState, ExecutionAction, PermitBinding, ExecutionPermit, PermitIssuerInput, PermitVerificationContext, PermitStore } from './execution-permit.js';
export { canonicalizeAction, fingerprintAction, issueExecutionPermit, verifyExecutionPermit, consumeExecutionPermit } from './execution-permit.js';
export type { PostgresPermitStoreOptions } from './postgres-permit-store.js';
export { PostgresPermitStore } from './postgres-permit-store.js';
export type { MoneyExecutionPermit } from './execution-permit-gate.js';
export { toExecutionAction, authorizeAndConsumeMoneyPermit } from './execution-permit-gate.js';
export type { ExecutionAttempt, ExecutionAttemptState, ExecutionAttemptOutcome, ExecutionAttemptStore } from './execution-attempt.js';
export { createExecutionAttempt, executionIdempotencyKey } from './execution-attempt.js';
export type { PostgresExecutionAttemptStoreOptions } from './postgres-execution-attempt-store.js';
export { PostgresExecutionAttemptStore } from './postgres-execution-attempt-store.js';
export type { RecoveryObservation, RecoveryDisposition, RecoveryResult, ExecutionReconciler, ExecutionRecoveryLedger, RecoveryResolutionState } from './execution-recovery.js';
export { classifyRecovery } from './execution-recovery.js';
export type { RecoveryLease, ExecutionRecoveryLeaseStore } from './execution-recovery-lease.js';
export { assertRecoveryLease, assertLeaseSeconds } from './execution-recovery-lease.js';
export type { PostgresExecutionRecoveryLedgerOptions } from './postgres-execution-recovery-ledger.js';
export { PostgresExecutionRecoveryLedger, recoveryEvidenceHash } from './postgres-execution-recovery-ledger.js';
export type { PostgresExecutionRecoveryLeaseStoreOptions } from './postgres-execution-recovery-lease-store.js';
export { PostgresExecutionRecoveryLeaseStore } from './postgres-execution-recovery-lease-store.js';
export type { ExecutionRecoveryServiceOptions } from './execution-recovery-service.js';
export { MoneyExecutionRecoveryService } from './execution-recovery-service.js';
export type { MoneyExecutionReconciliationAdapter } from './execution-reconciliation-adapter.js';
export { ExecutionReconciliationAdapterRegistry, createExecutionReconciler } from './execution-reconciliation-adapter.js';
export type { ProviderExecutionIdentity } from './provider-execution-identity.js';
export { createProviderExecutionIdentity, createProviderExecutionIdentityFromAttempt, assertProviderExecutionIdentity } from './provider-execution-identity.js';
export type { AtomicRecoveryResolver, PostgresAtomicRecoveryResolverOptions } from './postgres-atomic-recovery-resolver.js';
export { PostgresAtomicRecoveryResolver } from './postgres-atomic-recovery-resolver.js';
export type { StripePaymentIntentReconciliationAdapterOptions } from './stripe-payment-intent-reconciliation-adapter.js';
export { StripePaymentIntentReconciliationAdapter } from './stripe-payment-intent-reconciliation-adapter.js';

export type { RecoveryChildLineageInput } from './recovery-child-execution.js';
export { assertRecoveryChildLineage, MAX_RECOVERY_GENERATIONS } from './recovery-child-execution.js';
export type { RecoveryRetryEvidenceStore } from './recovery-retry-evidence.js';
export { assertRetrySafeRecoveryEvidence } from './recovery-retry-evidence.js';
export { PostgresRecoveryRetryEvidenceStore } from './postgres-recovery-retry-evidence-store.js';
export type { RecoveryChildProviderResult, RecoveryChildExecutorDeps, RecoveryChildExecutionInput } from './recovery-child-executor.js';
export { MoneyRecoveryChildExecutor } from './recovery-child-executor.js';

export type { MoneyActionCoreAuthority, MoneyAuthorityBinding } from './action-core-authority-bridge.js';
export { fingerprintActionRequest, createMoneyActionCoreAuthority, assertActionCoreAuthorityMatches, issueActionCoreBoundExecutionPermit, bindActionCoreAuthority } from './action-core-authority-bridge.js';

export { FINANCIAL_MUTATION_PREFIXES, isFinancialMutationCapability } from './financial-mutation-capabilities.js';
export type { FinancialExecutionIntent } from './financial-action-governance.js';
export { createFinancialActionRequestFromAllocation } from './financial-action-governance.js';

export * from './canonical-financial-state.js';
export * from './accounting-lifecycle-contracts.js';
export * from './market-instrument-contracts.js';
export * from './options-contracts.js';
export * from './market-data-source-contracts.js';
export * from './money-finish-inventory.js';
export * from './money-finish-recovery.js';
export * from './money-finish-source-admission.js';
export * from './money-finish-feed-admission.js';
export * from './money-metalpriceapi-reference.js';
export * from './money-finish-event-calendar.js';
export * from './money-finish-option-chain.js';
export * from './money-finish-signal-league.js';
export * from './money-finish-options-risk.js';
export * from './money-finish-fx-challengers.js';
export * from './money-finish-stock-rank-orb.js';
export * from './money-finish-strategy-factory.js';
export * from './money-finish-market-iq-mims.js';
export * from './money-finish-incubation.js';
export * from './money-finish-forward-grades.js';
export * from './money-finish-forward-journal.js';
export * from './money-forward-only-commissioning.js';
export * from './money-finish-final-gate.js';
export * from './trader-readiness-contracts.js';
export * from './trading-vehicle-semantics.js';
export * from './market-force-equilibrium-contracts.js';
export * from './automated-trading-economics-contracts.js';
export * from './prediction-calibration-contracts.js';
export * from './risk-simulation-contracts.js';
export * from './decision-workflow-contracts.js';
export * from './market-provenance-contracts.js';
export * from './macro-economic-contracts-v2.js';

export * from './sports-intelligence-ingress.js';
export * from './shark-intelligence-ingress.js';
export * from './shark-simulation-learning.js';
export * from './shark-shadow-learning.js';
export * from './shark-purse-bridge.js';
export * from './shark-coffer-runtime.js';
export * from './shark-coffer-execution-runtime.js';

export * from './stock-market-reality.js';

export * from './stock-intelligence-fusion.js';
export * from './stock-chart-vision-research.js';

export * from './fx-market-reality.js';

export * from './fx-intelligence-fusion.js';
export * from './institutional-flow-contracts.js';
export * from './finnhub-forex-market-data.js';
export * from './fx-chart-vision-research.js';

export * from './metals-market-reality.js';

export * from './metals-intelligence-fusion.js';

export * from './prediction-market-reality.js';

export * from './prediction-market-intelligence.js';

export * from './opportunity-outcome-truth-bridge.js';

export * from './exact-money.js';
export * from './financial-state-engine.js';
export * from './financial-lifecycle-engine.js';
export * from './instrument-prediction-engine.js';
export * from './risk-analysis-engine.js';
export * from './behavioral-risk-contracts.js';
export * from './decision-provenance-engine.js';
export * from './fundamental-valuation-engine.js';
export * from './macro-economic-engine.js';

export * from './information-integrity-engine.js';
export * from './information-analysis-engine.js';

export * from './cross-asset-fusion-contracts.js';
export * from './cross-asset-fusion-engine.js';
export * from './cross-asset-fusion-adapters.js';
export * from './cross-asset-decision-learning.js';

export * from './portfolio-construction-contracts.js';
export * from './portfolio-construction-engine.js';

export * from './execution-planning-contracts.js';
export * from './execution-planning-engine.js';

export * from './execution-receipt-contracts.js';
export * from './execution-receipt-engine.js';

export * from './paper-execution-contracts.js';
export * from './paper-execution-engine.js';
export * from './paper-strategy-result.js';
export * from './paper-ledger.js';
export * from './postgres-paper-ledger-store.js';

export * from './sandbox-broker-contracts.js';
export * from './sandbox-broker-engine.js';

export * from './shadow-market-contracts.js';
export * from './shadow-market-engine.js';

export * from './live-preflight-contracts.js';
export * from './live-preflight-engine.js';

export * from './broker-account-entitlement.js';
export * from './postgres-broker-account-entitlement-store.js';

export * from './live-trade-approval-bridge.js';

export * from './manual-live-broker-contracts.js';
export * from './manual-live-broker-executor.js';

export * from './live-canary-contracts.js';
export * from './live-canary-store.js';
export * from './postgres-live-canary-state-store.js';
export * from './live-execution-governance.js';

export * from './production-broker-http-adapter.js';
export * from './live-reconciliation-worker.js';
export * from './production-portfolio-reconciliation.js';
export * from './live-operations-console.js';
export * from './money-055-certification.js';

export * from './alpaca-trading-adapter.js';
export * from './durable-provider-event-processor.js';
export * from './postgres-durable-provider-event-store.js';
export * from './tax-accounting-engine.js';
export * from './money-060-live-canary.js';

export * from './autonomous-trading-contracts.js';
export * from './autonomous-trading-engine.js';
export * from './autonomous-strategy-learning.js';
export * from './postgres-autonomous-trading-mandate-store.js';

export * from './sports-paper-betting.js';
export * from './money-production-commissioning.js';
export * from './money-prod-software-certification.js';
export * from './postgres-money-production-commissioning-store.js';

export * from './cross-domain-alpha-router.js';
export * from './position-management.js';

export * from './sports-parlay-intelligence.js';

export * from './prediction-cross-venue-intelligence.js';

export * from './sports-handicap-evidence.js';

export * from './sports-prop-intelligence.js';

export * from './sports-prediction-reality.js';

export * from './sports-prediction-features.js';

export * from './sports-prediction-simulation.js';

export * from './sports-prediction-producer.js';

export * from './sports-prediction-model-arena.js';

export * from './sports-prediction-forward-shadow.js';

export * from './sports-pred-final-certification.js';

export * from './sports-market-semantics.js';

export * from './sports-prediction-revision-lineage.js';

export * from './sports-prediction-process-review.js';

export * from './sports-specialist-context.js';

export * from './sports-bet-shadow-runtime.js';
export * from './sports-bet-live-canary.js';
export * from './sports-bet-final-certification.js';

export * from './coffer-accountant.js';
export * from './accountant-controls.js';
export * from './funding-rail-contracts.js';
export * from './wallet-connector-contracts.js';
export * from './market-connector-contracts.js';

export * from './profit-sweep-orchestrator.js';

export * from './strategy-budget-contracts.js';
export * from './signer-lease-contracts.js';
export * from './provider-sync-contracts.js';
export * from './broker-surface-contracts.js';

export * from './money-commissioning-contracts.js';
export * from './money-feed-contracts.js';

export * from './execution-feed-projection.js';

export * from './sports-feed-projection.js';

export * from './money-movement-approval-contracts.js';
export * from './funding-execution-contracts.js';
export * from './funding-action-core-handler.js';
export * from './funding-provider-commissioning.js';
export * from './postgres-funding-rail-commissioning-store.js';
export * from './dex-four-stage-certification.js';

export * from './solana-dex-runtime-contracts.js';
export * from './jupiter-ultra-dex-adapter.js';
export * from './remote-coffer-signer-adapter.js';
export * from './solana-rpc-http-observer.js';
export * from './dex-controlled-canary-runtime.js';
export * from './dex-signed-simulation-runtime.js';
export * from './dex-commission-final.js';

export * from './postgres-dex-runtime-store.js';

export * from './dex-runtime-readiness.js';

export * from './trade-runtime-events.js';


export * from './sports-historical-warehouse.js';
export * from './sports-simulation-module.js';
export * from './sports-live-reality-bus.js';
export * from './sports-director-watch-ingress.js';
export * from './sports-auto-paper-league.js';
export * from './sports-learning-memory.js';
export * from './sports-shark-learning-bridge.js';
export * from './sports-continuous-shadow-league.js';
export * from './postgres-sports-auto-store.js';
export * from './sports-auto-1-7-certification.js';

export * from './sports-simulation-slider-engine.js';
export * from './sports-simulation-state.js';
export * from './sports-correlated-monte-carlo.js';
export * from './sports-live-resimulation.js';
export * from './sports-simulation-calibration.js';
export * from './sports-sim-bet-alpha.js';
export * from './sports-vision-evidence.js';
export * from './sport-sim-2f-certification.js';
export * from './sports-simulation-report.js';
export * from './sports-game-reference-context.js';
export * from './sports-basketball-mechanics.js';
export * from './sports-history.js';

export * from './sports-auto-runtime.js';
export * from './postgres-sports-auto-runtime-store.js';

export * from './alpaca-stock-market-data.js';
export * from './stock-paper-baseline-strategy.js';
export * from './stock-watchlist.js';
export * from './postgres-stock-watchlist-store.js';
export * from './paper-learning-loop.js';
export * from './paper-learning-store.js';
export * from './postgres-paper-learning-store.js';
export * from './paper-realism-profile.js';
export * from './paper-autopilot-settings.js';
export * from './postgres-paper-autopilot-settings-store.js';

export * from './dex-route-gate.js';
export * from './dex-route-router.js';
export * from './dex-transaction-preparation.js';
export * from './coffer-shadow-final.js';
export * from './postgres-coffer-shadow-store.js';

export * from './coffer-treasury-contracts.js';

export * from './jhadina-purse-charter.js';
export * from './purse-opportunity-bus.js';
export * from './purse-capital-allocator.js';
export * from './purse-decision-engine.js';
export * from './purse-portfolio.js';
export * from './purse-liquidity.js';
export * from './purse-rebalancer.js';
export * from './purse-autonomous-bridge.js';

export * from './purse-learning-personality.js';

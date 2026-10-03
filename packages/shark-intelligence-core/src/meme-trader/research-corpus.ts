/**
 * Canonical research corpus folded from the 2026-09-25/26 SHARK / Money Core
 * transcript audit. These records are hypotheses, experiments, defensive
 * controls, or Money research domains. They carry no trading authority.
 *
 * Existing runtime truth remains:
 *   evidence -> SHARK assessment / DecisionProposal -> governed Money research
 *   ingress -> Money risk / simulation / authority.
 */

export type SharkResearchCategory =
  | 'ALPHA_HYPOTHESIS'
  | 'DISCOVERY'
  | 'FORENSICS'
  | 'ACTOR_INTELLIGENCE'
  | 'NARRATIVE'
  | 'CATALYST'
  | 'ATTENTION'
  | 'REGIME'
  | 'EXECUTION_RESEARCH'
  | 'BEHAVIORAL_GUARD'
  | 'SECURITY'
  | 'PROVENANCE'
  | 'EXPERIMENT_INFRA'
  | 'MONEY_RESEARCH'

export type SharkResearchMaturity =
  | 'SOURCE_HYPOTHESIS'
  | 'SHARED_LAYER'
  | 'DEFENSIVE_VETO'
  | 'PAPER_ONLY'
  | 'SHADOW_REQUIRED'
  | 'MONEY_REVIEW_REQUIRED'

export type SharkResearchModule = Readonly<{
  id: string
  category: SharkResearchCategory
  maturity: SharkResearchMaturity
  summary: string
  dependsOn: readonly string[]
  constraints: readonly string[]
  authority: Readonly<{
    financialExecution: 'NONE'
    capitalAccess: 'NONE'
    protectedFunds: 'NONE'
    walletSigning: 'NONE'
  }>
}>

const NONE = Object.freeze({
  financialExecution: 'NONE' as const,
  capitalAccess: 'NONE' as const,
  protectedFunds: 'NONE' as const,
  walletSigning: 'NONE' as const,
})

const module = (
  id: string,
  category: SharkResearchCategory,
  maturity: SharkResearchMaturity,
  summary: string,
  dependsOn: readonly string[] = [],
  constraints: readonly string[] = [],
): SharkResearchModule => Object.freeze({
  id,
  category,
  maturity,
  summary,
  dependsOn: Object.freeze([...dependsOn]),
  constraints: Object.freeze([...constraints]),
  authority: NONE,
})

export const SHARK_CHAT_RESEARCH_MODULES: readonly SharkResearchModule[] = Object.freeze([
  module('AXIOM_COMMUNITY_DIP_SCALP_V1', 'ALPHA_HYPOTHESIS', 'PAPER_ONLY', 'Community-quality plus early-launch retracement hypothesis; source sizing and retracement rules remain experiments.'),
  module('NARRATIVE_ACTOR_FLOW_V1', 'ACTOR_INTELLIGENCE', 'PAPER_ONLY', 'Narrative archetype plus actor reputation, independence, accumulation and distribution analysis.'),
  module('META_FAMILY_TREE_CATALYST_V1', 'NARRATIVE', 'PAPER_ONLY', 'Narrative family-tree, catalyst object, attention-stage and thesis-probe research.'),
  module('MULTICHAIN_META_ROTATION_V1', 'REGIME', 'PAPER_ONLY', 'Multichain meta lifecycle, actor flow and chain-specific rotation research.'),
  module('VIRALITY_CONVICTION_REENTRY_V1', 'ATTENTION', 'PAPER_ONLY', 'Virality persistence, thesis lifecycle, bad-entry versus bad-thesis separation, and evidence-gated re-entry.'),
  module('ECOSYSTEM_FLOW_FLYWHEEL_V1', 'NARRATIVE', 'PAPER_ONLY', 'Capital-flow dependency graph from chain and launchpad through paired assets, fees, incentives and ecosystem betas.'),
  module('MEME_MANIPULATION_PLAYBOOK_V1', 'FORENSICS', 'DEFENSIVE_VETO', 'Defensive-only manipulation lifecycle covering synthetic volume, bundles, clone/vamp behavior and operator fingerprints.', [], ['No offensive market manipulation, deceptive bundling, fake volume, rugging, mixer use or liquidity theft.']),
  module('DISCOVERY_FILTER_PAPERTRADE_V1', 'DISCOVERY', 'PAPER_ONLY', 'Versioned discovery filters with source provenance, chain/session awareness and promotion ladder.'),
  module('SOCIAL_FEED_SIGNAL_LAYER', 'ACTOR_INTELLIGENCE', 'SHARED_LAYER', 'Separates actor transactions from statements, clusters independent callers, and preserves event-time latency.'),
  module('PUMPFUN_SOCIAL_FLOW_SIGNAL_V1', 'ATTENTION', 'PAPER_ONLY', 'Tests Pump-native trending velocity, followed-trader flow, callout context and holder quality against an on-chain-only baseline; public-wallet crowding and promotion conflicts are explicit penalties.'),
  module('CROSS_MARKET_EARLY_MOMENTUM_CONFIRMATION_V1', 'ALPHA_HYPOTHESIS', 'PAPER_ONLY', 'Tests the imported early-gainer plus higher-timeframe trend plus lower-timeframe volatility/momentum confirmation hypothesis without treating indicator alignment as proof of edge.'),
  module('CATALYST_LIFECYCLE_ENGINE_V1', 'CATALYST', 'SHARED_LAYER', 'Explicit why-enter, catalyst probability, priced-in state, invalidation, pre/post-event handling and thesis mutation.'),
  module('BEHAVIORAL_EXECUTION_GUARD_V1', 'BEHAVIORAL_GUARD', 'MONEY_REVIEW_REQUIRED', 'Post-loss tilt, borrowed conviction, overtrading, process/outcome separation and survival-budget checks.', [], ['May deny or downgrade execution context but never grant financial authority.']),
  module('SHARK_AUTOMATION_EXECUTION_V1', 'EXECUTION_RESEARCH', 'SHADOW_REQUIRED', 'Event-to-candidate automation receipts, independently validated actor-following, add-to-position controls and latency measurement.', [], ['Research/shadow only until Money independently admits execution.']),
  module('LOW_LATENCY_EXECUTION_BENCH_V1', 'EXECUTION_RESEARCH', 'SHADOW_REQUIRED', 'Measures discovery through confirmation latency and separates fast deterministic path from deep analysis path.'),
  module('VENDOR_TRUST_GATE', 'SECURITY', 'SHARED_LAYER', 'Verifies custody, audit, bounty, incident, uptime, RPC, model and performance claims instead of trusting marketing copy.'),
  module('CREATOR_REPUTATION_MODEL_V1', 'ACTOR_INTELLIGENCE', 'PAPER_ONLY', 'Operator-entity launch history, recent quality decay and reputation-regime shift model.'),
  module('MINT_EVENT_EXECUTION_V1', 'DISCOVERY', 'PAPER_ONLY', 'Mint-event discovery and precomputed creator/operator intelligence before pair-discovery surfaces.'),
  module('SNIPER_DENSITY_MODEL', 'FORENSICS', 'PAPER_ONLY', 'Same-slot buyer, bot-cluster, priority-fee, price-impact and creator-interaction density model.'),
  module('CHART_ONCHAIN_FUSION_V1', 'FORENSICS', 'PAPER_ONLY', 'Attributes price moves to independent entities, bundles, copy clusters, actors, catalysts and organic demand.'),
  module('REGIME_ADAPTIVE_RETRACE_V1', 'REGIME', 'PAPER_ONLY', 'Learns retracement behavior by regime instead of hard-coding 40/50/60/70/78.6/85-90 percent rules.'),
  module('HOLDER_GRAPH_FORENSICS_V1', 'FORENSICS', 'SHARED_LAYER', 'Resolves holder topology, probable common control, funding concentration and economically independent supply.'),
  module('ACTOR_EXIT_CASCADE_V1', 'ACTOR_INTELLIGENCE', 'PAPER_ONLY', 'Models leader, copy-wallet and correlated-actor exit cascades and follower liquidation risk.'),
  module('NO_TRADE_DISCIPLINE_V1', 'BEHAVIORAL_GUARD', 'SHARED_LAYER', 'Makes NO_TRADE a valid outcome when candidate quality is poor instead of forcing activity.'),
  module('DEAD_TOKEN_REANIMATION_DETECTOR', 'FORENSICS', 'PAPER_ONLY', 'Distinguishes organic community takeover from coordinated post-collapse reaccumulation and farming.'),
  module('ATTENTION_PRICE_DIVERGENCE', 'ATTENTION', 'PAPER_ONLY', 'Tests whether price and volume are coherent with unique viewers, independent holders and real demand.'),
  module('SOURCE_DEDUP_PROVENANCE_V1', 'PROVENANCE', 'SHARED_LAYER', 'Prevents repeated, derivative or affiliate copies of one source from inflating evidence weight.'),
  module('SOURCE_VERSION_DRIFT_V1', 'PROVENANCE', 'SHARED_LAYER', 'Tracks claim-level script/version drift without overwriting prior claims.'),
  module('CLAIM_MUTATION_DETECTOR', 'PROVENANCE', 'SHARED_LAYER', 'Flags changed latency, performance, security, model and other material claims across source versions.'),
  module('TRADING_SECURITY_GUARD', 'SECURITY', 'SHARED_LAYER', 'Domain/link, wallet permission, signature simulation, session, extension and application-integrity checks.'),
  module('DESKTOP_CLIENT_TRUST_GATE_V1', 'SECURITY', 'SHARED_LAYER', 'Package signature, publisher, hash, update-channel, secret-access and destination checks for downloaded trading clients.'),
  module('RPC_ROUTE_BENCHMARKER', 'EXECUTION_RESEARCH', 'SHADOW_REQUIRED', 'Chooses RPC routes by measured latency, staleness, errors and landing reliability rather than fixed geography.'),
  module('STAGE_AWARE_DISCOVERY_FILTER_V4', 'DISCOVERY', 'PAPER_ONLY', 'Uses lifecycle-relative evidence expectations for new, final-stretch/soon and migrated tokens.'),
  module('HOLDER_UNIFORMITY_DETECTOR', 'FORENSICS', 'PAPER_ONLY', 'Quantifies suspiciously uniform holder sizes alongside timing, funding and wallet-age similarity.'),
  module('FUNDER_DIVERSITY_CHECK', 'FORENSICS', 'PAPER_ONLY', 'Measures funding-source entropy and common-control clues without treating exchange funding as proof of independence.'),
  module('GLOBAL_FEES_RUG_SIGNAL_EXP_1', 'FORENSICS', 'PAPER_ONLY', 'Tests absolute and normalized fee activity against rugs, bundles, migration and executable outcomes.'),
  module('RWA_MEME_VALUE_ACCRUAL_V1', 'NARRATIVE', 'PAPER_ONLY', 'Verifies claimed real-world or external-asset value accrual, custody, reserve, redemption and counterparty mechanics.'),
  module('MEME_REGIME_ROTATION_V1', 'REGIME', 'PAPER_ONLY', 'Tracks rotation among novelty memes, OG memes and utility/RWA-linked meme assets.'),
  module('OPPORTUNITY_COST_ENGINE', 'MONEY_RESEARCH', 'MONEY_REVIEW_REQUIRED', 'Compares current-position expected value and time-to-thesis against alternative uses of the same governed risk budget.'),
  module('PROMOTION_CONFLICT_GRAPH', 'PROVENANCE', 'SHARED_LAYER', 'Tracks ownership, sponsorship, disclosure, publication and trading conflicts around promoted assets.'),
  module('MACRO_EASY_MODE_REGIME_V1', 'REGIME', 'SHARED_LAYER', 'Classifies broad speculative regimes so strategy results are attributed to environment rather than skill alone.'),
  module('CHAIN_ROTATION_ENGINE_V1', 'REGIME', 'PAPER_ONLY', 'Measures chain-level capital rotation, activity, wallet growth, liquidity and opportunity quality.'),
  module('CAPITAL_BUCKET_GOVERNOR_V1', 'MONEY_RESEARCH', 'MONEY_REVIEW_REQUIRED', 'Separates core, speculative and experimental risk budgets; speculative losses cannot self-refill from protected/core capital.'),
  module('LOTTERY_DEPENDENCE_SCORE', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Detects strategies or callers whose apparent edge depends on one or a few extreme tail winners.'),
  module('CORRELATED_LP_CARRY_V1', 'MONEY_RESEARCH', 'PAPER_ONLY', 'Researches correlated-pair liquidity provision using net return versus holding after fees, IL/LVR and execution costs.'),
  module('LP_RANGE_GOVERNOR_V1', 'MONEY_RESEARCH', 'PAPER_ONLY', 'Tests adaptive concentrated-liquidity range width and rebalance delay by volatility, correlation and fee density.'),
  module('FEE_YIELD_TRUTH_ENGINE', 'MONEY_RESEARCH', 'SHARED_LAYER', 'Separates current displayed APR from realized APR/APY and models yield crowding/decay.'),
  module('TOKENIZED_ASSET_PROVENANCE_V1', 'MONEY_RESEARCH', 'SHARED_LAYER', 'Verifies wrapper issuer, custody, redemption, tracking error, oracle, restrictions and basis risk for tokenized assets.'),
  module('MEME_LP_BASKET_EXP_1', 'MONEY_RESEARCH', 'PAPER_ONLY', 'Compares concentrated meme LP exposure with equal-weight, quality-weighted and forensic-screened baskets.'),
  module('SOLANA_WORKSPACE_ORCHESTRATOR_V1', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Unifies candidate discovery, review, strategy state, routing context, positions and post-trade records without creating authority.'),
  module('SMART_ROUTE_ENGINE_V1', 'EXECUTION_RESEARCH', 'SHADOW_REQUIRED', 'Compares venue quote, liquidity, slippage, fees, MEV, latency and landing probability for research/shadow execution quality.'),
  module('SHARK_EVENT_LOG_V1', 'PROVENANCE', 'SHARED_LAYER', 'Append-only chronological decision/evidence trace for forensic replay and explainability.'),
  module('EVENT_CORRELATION_VIEW_V1', 'FORENSICS', 'SHARED_LAYER', 'Correlates mint/deploy events, first buyers, funders, first sells, LP actions and copy clusters on one timeline.'),
  module('CALLER_ENSEMBLE_AUTOBOT_V1', 'ACTOR_INTELLIGENCE', 'PAPER_ONLY', 'Combines caller, wallet and social signals only after identity, deduplication and independence clustering.'),
  module('CALL_IMPACT_DECAY_V1', 'ACTOR_INTELLIGENCE', 'PAPER_ONLY', 'Learns reflexive price impact and normalization after each caller so entry policy is source-specific.'),
  module('SOURCE_POLICY_LEARNER_V1', 'EXPERIMENT_INFRA', 'PAPER_ONLY', 'Separates source alpha from entry/exit policy alpha and learns policy by source cluster.'),
  module('CALLER_PERFORMANCE_LEDGER_V2', 'ACTOR_INTELLIGENCE', 'SHARED_LAYER', 'Ranks callers by executable, risk-adjusted outcomes instead of all-time-high multiples.'),
  module('CALLER_TIMELINE_OVERLAY', 'ACTOR_INTELLIGENCE', 'SHARED_LAYER', 'Classifies originator, early confirmation, mid-move, late follower and post-move promoter behavior.'),
  module('CALLER_RANK_EXP_1', 'EXPERIMENT_INFRA', 'PAPER_ONLY', 'Compares peak-multiple, executable-return, risk-adjusted, discovery-quality and rug-adjusted caller rankings.'),
  module('ATTENTION_CAPITAL_ENGINE_V1', 'ATTENTION', 'PAPER_ONLY', 'Models real-world/social attention into crypto interpretation, capital flow, price reflexivity and eventual rotation.'),
  module('EXTERNAL_VIRALITY_SENSOR_V1', 'ATTENTION', 'PAPER_ONLY', 'Distinguishes crypto-created attention from crypto capturing an already-growing external cultural trend.'),
  module('ATTENTION_HALF_LIFE_V1', 'ATTENTION', 'PAPER_ONLY', 'Estimates accelerating, persistent, plateauing, decaying and reawakening attention states.'),
  module('ROTATION_LIQUIDITY_ENGINE_V1', 'ATTENTION', 'PAPER_ONLY', 'Separates net-new capital from internal rotation and identifies rotation-induced dislocations.'),
  module('CAPITAL_DESTINATION_GRAPH', 'ATTENTION', 'PAPER_ONLY', 'Maps where capital left and where it moved by linking wallet exits to subsequent entries.'),
  module('MONEY_STRATEGY_FACTORY_V1', 'MONEY_RESEARCH', 'MONEY_REVIEW_REQUIRED', 'Research -> build -> backtest -> optimize -> falsify -> incubate -> risk review -> shadow/limited eligibility pipeline.', [], ['Proposer, validator, risk authority and executor must remain separate.']),
  module('STRATEGY_INCUBATION_GATE_V1', 'EXPERIMENT_INFRA', 'SHADOW_REQUIRED', 'Prevents a strong backtest from becoming live authority without robustness, forward and shadow validation.'),
  module('BACKTEST_ADVERSARIAL_SUITE', 'EXPERIMENT_INFRA', 'PAPER_ONLY', 'Out-of-sample, walk-forward, parameter-neighborhood, randomized-start, cost, latency and regime robustness tests.'),
  module('STRATEGY_REGIME_MATRIX', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Stores expectancy by instrument, timeframe, liquidity and regime instead of claiming a strategy works universally.'),
  module('EDGE_DECAY_DETECTOR_V1', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Monitors live/shadow divergence, drawdown, slippage and regime fit for downgrade, pause, revalidation or retirement.'),
  module('BROKER_CREDENTIAL_VAULT', 'SECURITY', 'MONEY_REVIEW_REQUIRED', 'Requires trade-only keys, no withdrawal scope, local encryption, allowlists, rotation, audit and emergency revocation.'),
  module('RUG_DEFENSE_GATE_V1', 'FORENSICS', 'DEFENSIVE_VETO', 'Fail-closed pre-entry rug gate requiring sellability, liquidity-control, authority-control, holder-independence and operator-identity coverage.'),
  module('RUG_RUNTIME_SENTINEL_V1', 'FORENSICS', 'SHARED_LAYER', 'Continuously watches liquidity removal, collapse patterns and operator-linked distribution after a position exists.'),
  module('RUG_MODEL_ENSEMBLE_V1', 'FORENSICS', 'PAPER_ONLY', 'Combines calibrated rug-model signals asymmetrically: models may escalate risk but can never clear deterministic blockers.'),
  module('RUG_DATASET_REPLAY_V1', 'EXPERIMENT_INFRA', 'PAPER_ONLY', 'Uses external rug datasets as replay/red-team corpora with explicit chain/time/domain-shift labels rather than treating them as Solana truth.'),
  module('SELF_PROTECT_CIRCUIT_BREAKER_V1', 'SECURITY', 'MONEY_REVIEW_REQUIRED', 'System-level fail-closed controls: paper default, trade-only/no-withdraw credentials, bounded loss, stale-data/provider degradation and emergency quarantine.'),
  module('SHARK_EVIDENCE_PROV_1', 'PROVENANCE', 'SHARED_LAYER', 'Claim/source-family ledger with duplicate, derivative, contradiction and independent-corroboration semantics.'),
  module('EXPERIMENT_REGISTRY_V1', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Immutable strategy-spec identity spanning signal, filters, entry, exit, regime, forensics and cost-model versions.'),
  module('COUNTERFACTUAL_ENTRY_ENGINE', 'EXPERIMENT_INFRA', 'PAPER_ONLY', 'Compares nearby entry and exit alternatives to separate signal quality from timing and management quality.'),
  module('DEAD_TOKEN_CORPUS', 'EXPERIMENT_INFRA', 'SHARED_LAYER', 'Forces failed, rugged, abandoned and illiquid launches into replay data to prevent survivorship bias.'),
  module('SHADOW_LEDGER_V1', 'EXPERIMENT_INFRA', 'SHADOW_REQUIRED', 'Separates idealized paper P&L from estimated executable fills, costs, latency and route degradation.'),
  module('SHARK_STRATEGY_FACTORY_1', 'EXPERIMENT_INFRA', 'MONEY_REVIEW_REQUIRED', 'Composes universe, signal, veto, entry, management and exit modules under PIT replay and Money-owned authority.'),
])

export type SourceRelationship =
  | 'EXACT_DUPLICATE'
  | 'NEAR_DUPLICATE'
  | 'TRANSCRIPT_VARIANT'
  | 'AFFILIATE_DERIVATIVE'
  | 'COMMON_ORIGIN'
  | 'INDEPENDENT_CORROBORATION'
  | 'INDEPENDENT_CONTRADICTION'

export type ResearchEvidenceState =
  | 'UNVERIFIED_SOURCE_CLAIM'
  | 'MULTIPLE_INDEPENDENT_SOURCES'
  | 'PRIMARY_DATA_SUPPORTED'
  | 'REPRODUCED_IN_PAPER'
  | 'REPRODUCED_IN_SHADOW'
  | 'STATISTICALLY_VALIDATED'
  | 'LIMITED_PRODUCTION_ELIGIBLE'

export type ResearchSourceObservation = Readonly<{
  observationId: string
  sourceFamilyId: string
  sourceVersionId: string
  independentGroup: string
  relationship: SourceRelationship
  claimIds: readonly string[]
  promotionalPressure: readonly string[]
  authority: 'EVIDENCE_ONLY'
  canAuthorizeTrade: false
}>

export type ResearchClaim = Readonly<{
  claimId: string
  canonicalClaim: string
  state: ResearchEvidenceState
  sourceFamilyIds: readonly string[]
  independentGroups: readonly string[]
  contradictsClaimIds: readonly string[]
  experimentIds: readonly string[]
  productionAuthority: false
}>

export function countIndependentEvidence(
  observations: readonly ResearchSourceObservation[],
): number {
  return new Set(observations.map((item) => item.independentGroup)).size
}

export function countRawSources(
  observations: readonly ResearchSourceObservation[],
): number {
  return new Set(observations.map((item) => item.observationId)).size
}

export function summarizeSourceIndependence(
  observations: readonly ResearchSourceObservation[],
): Readonly<{ rawSourceCount: number; independentEvidenceCount: number }> {
  return Object.freeze({
    rawSourceCount: countRawSources(observations),
    independentEvidenceCount: countIndependentEvidence(observations),
  })
}

const evidenceRank: Readonly<Record<ResearchEvidenceState, number>> = Object.freeze({
  UNVERIFIED_SOURCE_CLAIM: 0,
  MULTIPLE_INDEPENDENT_SOURCES: 1,
  PRIMARY_DATA_SUPPORTED: 2,
  REPRODUCED_IN_PAPER: 3,
  REPRODUCED_IN_SHADOW: 4,
  STATISTICALLY_VALIDATED: 5,
  LIMITED_PRODUCTION_ELIGIBLE: 6,
})

/**
 * Evidence state may only move forward explicitly. Repetition of the same source
 * family is not itself a promotion mechanism; callers must supply a stronger
 * independently governed validation result.
 */
export function canAdvanceResearchEvidence(
  from: ResearchEvidenceState,
  to: ResearchEvidenceState,
): boolean {
  return evidenceRank[to] > evidenceRank[from]
}

export type MakeItMakeSenseStage = 'HYPOTHESIS' | 'TRADE' | 'PERFORMANCE'

export const MAKE_IT_MAKE_SENSE_STAGES: readonly Readonly<{
  stage: MakeItMakeSenseStage
  question: string
}>[] = Object.freeze([
  Object.freeze({ stage: 'HYPOTHESIS', question: 'Does the proposed edge have a coherent causal reason to exist beyond source repetition or chart hindsight?' }),
  Object.freeze({ stage: 'TRADE', question: 'Does the current candidate actually fit the strategy once provenance, independence, manipulation, chronology and alternatives are checked?' }),
  Object.freeze({ stage: 'PERFORMANCE', question: 'Does apparent success survive costs, regime attribution, outliers, survivorship bias and plausible alternative explanations?' }),
])

export const SHARK_CHAT_CORPUS_AUTHORITY = Object.freeze({
  role: 'RESEARCH_ONLY' as const,
  financialExecution: 'NONE' as const,
  capitalAccess: 'NONE' as const,
  protectedFunds: 'NONE' as const,
  walletSigning: 'NONE' as const,
})

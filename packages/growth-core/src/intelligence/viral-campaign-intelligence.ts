import type { GrowthId } from '../domain/types.js';
import type { SocialCommercialCampaignEnvelope } from './social-commercial-campaign.js';
import type { SocialRadarCluster } from './social-radar.js';

export type ViralCampaignMechanic =
  | 'curiosity_reveal'
  | 'participation_challenge'
  | 'moment_response'
  | 'emotional_story'
  | 'humor_surprise'
  | 'utility_proof'
  | 'identity_community'
  | 'conversation_debate'
  | 'ambient_surprise';

export type ViralShareMotive =
  | 'curiosity'
  | 'emotion'
  | 'humor'
  | 'utility'
  | 'identity'
  | 'participation'
  | 'surprise'
  | 'status'
  | 'conversation';

export interface ViralCampaignSignals {
  novelty: number;
  emotionalResonance: number;
  utility: number;
  identityResonance: number;
  participationEase: number;
  timeliness: number;
  proofStrength: number;
  discussionPotential: number;
}

export interface ViralSeedCohort {
  id: string;
  clusterId: string;
  label: string;
  audienceFit: number;
  bridgePotential: number;
  trust: number;
  activationReadiness: number;
  estimatedReach?: number;
  evidenceRefs: readonly string[];
}

export interface ViralSeedSelection {
  cohortId: string;
  clusterId: string;
  score: number;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
}

export interface ViralSeedPlan {
  selected: readonly ViralSeedSelection[];
  candidateCount: number;
  distinctClusterCount: number;
  strategy: 'DIVERSE_BRIDGES_OVER_SINGLE_CLUSTER';
  outreachAuthority: 'NONE';
  publicationAuthority: 'NONE';
  externalActionAuthorized: false;
}

export interface ViralMomentWindow {
  sourceRef: string;
  detectedAt: string;
  expiresAt: string;
  brandFit: number;
  assetReadiness: number;
  rightsReady: boolean;
  evidenceRefs: readonly string[];
}

export interface ViralCampaignObservation {
  id: string;
  variantId: string;
  views: number;
  shares: number;
  saves?: number;
  comments?: number;
  qualifiedOutcomes: number;
  baselineShareRate: number;
  independentClusterIds: readonly string[];
  earnedMediaMentions?: number;
  observedAt: string;
  evidenceRefs: readonly string[];
}

export interface ViralCampaignEvidenceEvaluation {
  observationCount: number;
  replicatedVariantCount: number;
  independentClusterCount: number;
  qualifiedOutcomeCount: number;
  earnedMediaMentions: number;
  status: 'insufficient' | 'candidate' | 'validated';
  eligibleForAttack: boolean;
  evidenceRefs: readonly string[];
  law: 'ONE_SPIKE_IS_NOT_VIRAL_STRATEGY_PROOF';
  authority: 'VIRAL_EVIDENCE_ANALYTICS_ONLY';
}

export interface ViralCampaignHypothesis {
  id: GrowthId;
  subjectId: GrowthId;
  brandId: GrowthId;
  commercialCampaignRef: GrowthId;
  mechanic: ViralCampaignMechanic;
  shareMotives: readonly ViralShareMotive[];
  pursuitScore: number;
  phase: 'SEARCH' | 'ATTACK';
  testDecision: 'TEST' | 'HOLD';
  momentState: 'not_applicable' | 'active' | 'expired';
  seedPlan: ViralSeedPlan;
  evidenceEvaluation: ViralCampaignEvidenceEvaluation;
  reasons: readonly string[];
  evidenceRefs: readonly string[];
  driverModel: Readonly<{
    controllable: readonly [
      'creative_mechanic',
      'share_motive',
      'participation_friction',
      'timing_readiness',
      'seed_diversity',
      'proof_and_business_destination',
    ];
    uncontrolled: readonly [
      'feed_allocation',
      'competing_events',
      'network_stochasticity',
      'audience_response',
    ];
    law: 'STRATEGY_LOADS_THE_DICE_BUT_DOES_NOT_CONTROL_THE_ROLL';
  }>;
  policy: Readonly<{
    viralityIsProbabilityNotPromise: true;
    pursuitScoreIsNotViralProbability: true;
    stochasticExposureAndTimingRemainUncontrolled: true;
    guaranteedViralityClaimAllowed: false;
    organicSharingMustRemainUserChoice: true;
    concealedBrandDeceptionAllowed: false;
    affiliateAndSponsoredDisclosureMustSurviveRepurposing: true;
    spamSeedingAllowed: false;
    fakeEngagementAllowed: false;
    seedCohortsMustBeAggregateNotCovertIdentityTargets: true;
    earnedMediaRequiresObservedEvidence: true;
    qualifiedBusinessOutcomeRequiredForAttack: true;
  }>;
  authority: 'VIRAL_CAMPAIGN_PLANNING_ONLY';
  publicationAuthority: 'NONE';
  outreachAuthority: 'NONE';
  paidMediaAuthority: 'NONE';
  externalActionAuthorized: false;
}

export function createViralMomentWindowFromRadar(input: {
  cluster: SocialRadarCluster;
  detectedAt: string;
  expiresAt: string;
  brandFit: number;
  assetReadiness: number;
  rightsReady: boolean;
  evidenceRefs: readonly string[];
}): ViralMomentWindow {
  requireDate(input.detectedAt, 'moment.detectedAt');
  requireDate(input.expiresAt, 'moment.expiresAt');
  if (Date.parse(input.expiresAt) <= Date.parse(input.detectedAt)) {
    throw new Error('SOCIAL_VIRAL_MOMENT_WINDOW_INVALID');
  }
  assertScore(input.brandFit, 'moment.brandFit');
  assertScore(input.assetReadiness, 'moment.assetReadiness');
  if (!input.cluster.evidenceRefs.length || !input.evidenceRefs.length) {
    throw new Error('SOCIAL_VIRAL_MOMENT_EVIDENCE_REQUIRED');
  }

  return Object.freeze({
    sourceRef: `social-radar:${safe(input.cluster.canonicalStoryKey)}`,
    detectedAt: input.detectedAt,
    expiresAt: input.expiresAt,
    brandFit: input.brandFit,
    assetReadiness: input.assetReadiness,
    rightsReady: input.rightsReady,
    evidenceRefs: Object.freeze(unique([
      ...input.cluster.evidenceRefs,
      ...input.evidenceRefs,
      ...input.cluster.observationIds.map((id) => `radar-observation:${id}`),
    ])),
  });
}

export function evaluateViralCampaignEvidence(
  observations: readonly ViralCampaignObservation[],
): ViralCampaignEvidenceEvaluation {
  observations.forEach(validateObservation);

  const outperforming = observations.filter((observation) => {
    if (observation.views <= 0) return false;
    return observation.shares / observation.views > observation.baselineShareRate;
  });
  const replicatedVariantCount = new Set(
    outperforming.map((observation) => observation.variantId),
  ).size;
  const independentClusterCount = new Set(
    outperforming.flatMap((observation) => observation.independentClusterIds),
  ).size;
  const qualifiedOutcomeCount = outperforming.reduce(
    (sum, observation) => sum + observation.qualifiedOutcomes,
    0,
  );
  const earnedMediaMentions = outperforming.reduce(
    (sum, observation) => sum + (observation.earnedMediaMentions ?? 0),
    0,
  );

  const eligibleForAttack =
    replicatedVariantCount >= 2
    && independentClusterCount >= 2
    && qualifiedOutcomeCount > 0;

  const status: ViralCampaignEvidenceEvaluation['status'] =
    eligibleForAttack
      ? 'validated'
      : outperforming.length > 0
        ? 'candidate'
        : 'insufficient';

  return Object.freeze({
    observationCount: observations.length,
    replicatedVariantCount,
    independentClusterCount,
    qualifiedOutcomeCount,
    earnedMediaMentions,
    status,
    eligibleForAttack,
    evidenceRefs: Object.freeze(unique(
      outperforming.flatMap((observation) => observation.evidenceRefs),
    )),
    law: 'ONE_SPIKE_IS_NOT_VIRAL_STRATEGY_PROOF' as const,
    authority: 'VIRAL_EVIDENCE_ANALYTICS_ONLY' as const,
  });
}

export function selectViralSeedCohorts(input: {
  cohorts: readonly ViralSeedCohort[];
  maxCohorts?: number;
}): ViralSeedPlan {
  const maxCohorts = input.maxCohorts ?? 4;
  if (!Number.isInteger(maxCohorts) || maxCohorts < 1 || maxCohorts > 20) {
    throw new Error('SOCIAL_VIRAL_SEED_MAX_INVALID');
  }

  input.cohorts.forEach(validateSeedCohort);

  const ranked = input.cohorts
    .map((cohort) => ({
      cohort,
      score: round(
        cohort.audienceFit * 0.35
        + cohort.bridgePotential * 0.30
        + cohort.trust * 0.20
        + cohort.activationReadiness * 0.15,
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const selected: ViralSeedSelection[] = [];
  const selectedClusters = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= maxCohorts) break;
    if (selectedClusters.has(candidate.cohort.clusterId)) continue;

    selectedClusters.add(candidate.cohort.clusterId);
    selected.push(Object.freeze({
      cohortId: candidate.cohort.id,
      clusterId: candidate.cohort.clusterId,
      score: candidate.score,
      reasons: Object.freeze([
        `audienceFit=${candidate.cohort.audienceFit}`,
        `bridgePotential=${candidate.cohort.bridgePotential}`,
        `trust=${candidate.cohort.trust}`,
        `activationReadiness=${candidate.cohort.activationReadiness}`,
      ]),
      evidenceRefs: Object.freeze(unique(candidate.cohort.evidenceRefs)),
    }));
  }

  return Object.freeze({
    selected: Object.freeze(selected),
    candidateCount: input.cohorts.length,
    distinctClusterCount: selectedClusters.size,
    strategy: 'DIVERSE_BRIDGES_OVER_SINGLE_CLUSTER' as const,
    outreachAuthority: 'NONE' as const,
    publicationAuthority: 'NONE' as const,
    externalActionAuthorized: false as const,
  });
}

export function compileViralCampaignHypothesis(input: {
  id: GrowthId;
  campaign: SocialCommercialCampaignEnvelope;
  mechanic: ViralCampaignMechanic;
  shareMotives: readonly ViralShareMotive[];
  signals: ViralCampaignSignals;
  seedCohorts: readonly ViralSeedCohort[];
  observations?: readonly ViralCampaignObservation[];
  moment?: ViralMomentWindow;
  maxSeedCohorts?: number;
  evaluatedAt?: string;
  evidenceRefs: readonly string[];
}): ViralCampaignHypothesis {
  requireText(input.id, 'id');
  if (!input.campaign.routes.length) {
    throw new Error('SOCIAL_VIRAL_COMMERCIAL_ROUTE_REQUIRED');
  }
  if (!input.shareMotives.length) {
    throw new Error('SOCIAL_VIRAL_SHARE_MOTIVE_REQUIRED');
  }
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_VIRAL_EVIDENCE_REQUIRED');
  }
  validateSignals(input.signals);

  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  requireDate(evaluatedAt, 'evaluatedAt');
  const momentState = resolveMomentState(
    input.mechanic,
    input.moment,
    evaluatedAt,
  );
  const seedPlan = selectViralSeedCohorts({
    cohorts: input.seedCohorts,
    maxCohorts: input.maxSeedCohorts,
  });
  const evidenceEvaluation = evaluateViralCampaignEvidence(
    input.observations ?? [],
  );

  const pursuitScore = round(
    input.signals.novelty * 0.15
    + input.signals.emotionalResonance * 0.13
    + input.signals.utility * 0.12
    + input.signals.identityResonance * 0.12
    + input.signals.participationEase * 0.12
    + input.signals.timeliness * 0.12
    + input.signals.proofStrength * 0.12
    + input.signals.discussionPotential * 0.12,
  );

  const phase: ViralCampaignHypothesis['phase'] =
    input.campaign.planMode === 'ATTACK'
    && evidenceEvaluation.eligibleForAttack
      ? 'ATTACK'
      : 'SEARCH';

  const testDecision: ViralCampaignHypothesis['testDecision'] =
    momentState === 'expired' || seedPlan.selected.length === 0
      ? 'HOLD'
      : 'TEST';

  const reasons = [
    `pursuitScore=${pursuitScore}`,
    `commercialRoutes=${input.campaign.routes.length}`,
    `replicatedVariants=${evidenceEvaluation.replicatedVariantCount}`,
    `independentClusters=${evidenceEvaluation.independentClusterCount}`,
    `qualifiedOutcomes=${evidenceEvaluation.qualifiedOutcomeCount}`,
    `seedClusters=${seedPlan.distinctClusterCount}`,
    `momentState=${momentState}`,
  ];

  return Object.freeze({
    id: input.id,
    subjectId: input.campaign.subjectId,
    brandId: input.campaign.brandId,
    commercialCampaignRef: input.campaign.id,
    mechanic: input.mechanic,
    shareMotives: Object.freeze(unique(input.shareMotives) as ViralShareMotive[]),
    pursuitScore,
    phase,
    testDecision,
    momentState,
    seedPlan,
    evidenceEvaluation,
    reasons: Object.freeze(reasons),
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.campaign.evidenceRefs,
      ...seedPlan.selected.flatMap((selection) => selection.evidenceRefs),
      ...evidenceEvaluation.evidenceRefs,
      ...(input.moment?.evidenceRefs ?? []),
    ])),
    driverModel: Object.freeze({
      controllable: Object.freeze([
        'creative_mechanic',
        'share_motive',
        'participation_friction',
        'timing_readiness',
        'seed_diversity',
        'proof_and_business_destination',
      ] as const),
      uncontrolled: Object.freeze([
        'feed_allocation',
        'competing_events',
        'network_stochasticity',
        'audience_response',
      ] as const),
      law: 'STRATEGY_LOADS_THE_DICE_BUT_DOES_NOT_CONTROL_THE_ROLL' as const,
    }),
    policy: Object.freeze({
      viralityIsProbabilityNotPromise: true as const,
      pursuitScoreIsNotViralProbability: true as const,
      stochasticExposureAndTimingRemainUncontrolled: true as const,
      guaranteedViralityClaimAllowed: false as const,
      organicSharingMustRemainUserChoice: true as const,
      concealedBrandDeceptionAllowed: false as const,
      affiliateAndSponsoredDisclosureMustSurviveRepurposing: true as const,
      spamSeedingAllowed: false as const,
      fakeEngagementAllowed: false as const,
      seedCohortsMustBeAggregateNotCovertIdentityTargets: true as const,
      earnedMediaRequiresObservedEvidence: true as const,
      qualifiedBusinessOutcomeRequiredForAttack: true as const,
    }),
    authority: 'VIRAL_CAMPAIGN_PLANNING_ONLY' as const,
    publicationAuthority: 'NONE' as const,
    outreachAuthority: 'NONE' as const,
    paidMediaAuthority: 'NONE' as const,
    externalActionAuthorized: false as const,
  });
}

function resolveMomentState(
  mechanic: ViralCampaignMechanic,
  moment: ViralMomentWindow | undefined,
  evaluatedAt: string,
): ViralCampaignHypothesis['momentState'] {
  if (mechanic !== 'moment_response') return 'not_applicable';
  if (!moment) throw new Error('SOCIAL_VIRAL_MOMENT_WINDOW_REQUIRED');

  requireText(moment.sourceRef, 'moment.sourceRef');
  requireDate(moment.detectedAt, 'moment.detectedAt');
  requireDate(moment.expiresAt, 'moment.expiresAt');
  if (!moment.evidenceRefs.length) {
    throw new Error('SOCIAL_VIRAL_MOMENT_EVIDENCE_REQUIRED');
  }
  assertScore(moment.brandFit, 'moment.brandFit');
  assertScore(moment.assetReadiness, 'moment.assetReadiness');
  if (Date.parse(moment.expiresAt) <= Date.parse(moment.detectedAt)) {
    throw new Error('SOCIAL_VIRAL_MOMENT_WINDOW_INVALID');
  }

  return Date.parse(evaluatedAt) < Date.parse(moment.expiresAt)
    && moment.rightsReady
      ? 'active'
      : 'expired';
}

function validateSignals(signals: ViralCampaignSignals): void {
  for (const [name, value] of Object.entries(signals)) {
    assertScore(value, `signals.${name}`);
  }
}

function validateSeedCohort(cohort: ViralSeedCohort): void {
  requireText(cohort.id, 'seed.id');
  requireText(cohort.clusterId, 'seed.clusterId');
  requireText(cohort.label, 'seed.label');
  if (!cohort.evidenceRefs.length) {
    throw new Error('SOCIAL_VIRAL_SEED_EVIDENCE_REQUIRED');
  }
  assertScore(cohort.audienceFit, 'seed.audienceFit');
  assertScore(cohort.bridgePotential, 'seed.bridgePotential');
  assertScore(cohort.trust, 'seed.trust');
  assertScore(cohort.activationReadiness, 'seed.activationReadiness');
  if (
    cohort.estimatedReach !== undefined
    && (!Number.isFinite(cohort.estimatedReach) || cohort.estimatedReach < 0)
  ) {
    throw new Error('SOCIAL_VIRAL_SEED_REACH_INVALID');
  }
}

function validateObservation(observation: ViralCampaignObservation): void {
  requireText(observation.id, 'observation.id');
  requireText(observation.variantId, 'observation.variantId');
  requireDate(observation.observedAt, 'observation.observedAt');
  if (!observation.evidenceRefs.length) {
    throw new Error('SOCIAL_VIRAL_OBSERVATION_EVIDENCE_REQUIRED');
  }
  for (const [name, value] of Object.entries({
    views: observation.views,
    shares: observation.shares,
    saves: observation.saves ?? 0,
    comments: observation.comments ?? 0,
    qualifiedOutcomes: observation.qualifiedOutcomes,
    earnedMediaMentions: observation.earnedMediaMentions ?? 0,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`SOCIAL_VIRAL_OBSERVATION_INVALID:${name}`);
    }
  }
  if (
    !Number.isFinite(observation.baselineShareRate)
    || observation.baselineShareRate < 0
    || observation.baselineShareRate > 1
  ) {
    throw new Error('SOCIAL_VIRAL_BASELINE_SHARE_RATE_INVALID');
  }
}

function assertScore(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`SOCIAL_VIRAL_SCORE_INVALID:${field}`);
  }
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`SOCIAL_VIRAL_FIELD_REQUIRED:${field}`);
  }
}

function requireDate(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`SOCIAL_VIRAL_DATE_INVALID:${field}`);
  }
}

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean) as T[])];
}

function safe(value: string): string {
  return String(value).replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 180);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

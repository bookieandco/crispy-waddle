export type DirectorProductionFixtureKind =
  | 'commercial-30s'
  | 'branded-short-8-13m'
  | 'episode-22-30m'
  | 'feature-55-70m';

export type DirectorProductionQualityMetric =
  | 'story-causality'
  | 'character-identity'
  | 'voice-identity'
  | 'wardrobe-continuity'
  | 'product-fidelity'
  | 'spatial-continuity'
  | 'performance-naturalness'
  | 'lip-sync'
  | 'audio-continuity'
  | 'camera-direction'
  | 'lighting-continuity'
  | 'temporal-continuity'
  | 'visual-cleanliness'
  | 'rights-coverage';

export type DirectorCoherenceLevel = 'shot' | 'scene' | 'sequence' | 'act' | 'final';

export interface DirectorProductionFixtureProfile {
  kind: DirectorProductionFixtureKind;
  minimumDurationSeconds: number;
  maximumDurationSeconds: number;
  requiredMetrics: readonly DirectorProductionQualityMetric[];
  requiredCoherenceLevels: readonly DirectorCoherenceLevel[];
  requireProductFidelity: boolean;
  requireExternalNleRoundTrip: boolean;
  minimumAudioStemRoles: readonly string[];
}

const BASE_METRICS: readonly DirectorProductionQualityMetric[] = Object.freeze([
  'story-causality',
  'character-identity',
  'voice-identity',
  'wardrobe-continuity',
  'spatial-continuity',
  'performance-naturalness',
  'lip-sync',
  'audio-continuity',
  'camera-direction',
  'lighting-continuity',
  'temporal-continuity',
  'visual-cleanliness',
  'rights-coverage',
]);

export const DIRECTOR_PRODUCTION_FINAL_FIXTURES: readonly DirectorProductionFixtureProfile[] = Object.freeze([
  Object.freeze({
    kind: 'commercial-30s',
    minimumDurationSeconds: 25,
    maximumDurationSeconds: 40,
    requiredMetrics: Object.freeze([...BASE_METRICS, 'product-fidelity'] as DirectorProductionQualityMetric[]),
    requiredCoherenceLevels: Object.freeze(['shot','scene','final'] as DirectorCoherenceLevel[]),
    requireProductFidelity: true,
    requireExternalNleRoundTrip: false,
    minimumAudioStemRoles: Object.freeze(['dialogue','music','sfx']),
  }),
  Object.freeze({
    kind: 'branded-short-8-13m',
    minimumDurationSeconds: 8 * 60,
    maximumDurationSeconds: 13 * 60,
    requiredMetrics: Object.freeze([...BASE_METRICS, 'product-fidelity'] as DirectorProductionQualityMetric[]),
    requiredCoherenceLevels: Object.freeze(['shot','scene','sequence','final'] as DirectorCoherenceLevel[]),
    requireProductFidelity: true,
    requireExternalNleRoundTrip: false,
    minimumAudioStemRoles: Object.freeze(['dialogue','music','sfx','foley','ambience']),
  }),
  Object.freeze({
    kind: 'episode-22-30m',
    minimumDurationSeconds: 22 * 60,
    maximumDurationSeconds: 30 * 60,
    requiredMetrics: BASE_METRICS,
    requiredCoherenceLevels: Object.freeze(['shot','scene','sequence','act','final'] as DirectorCoherenceLevel[]),
    requireProductFidelity: false,
    requireExternalNleRoundTrip: false,
    minimumAudioStemRoles: Object.freeze(['dialogue','music','sfx','foley','ambience']),
  }),
  Object.freeze({
    kind: 'feature-55-70m',
    minimumDurationSeconds: 55 * 60,
    maximumDurationSeconds: 70 * 60,
    requiredMetrics: BASE_METRICS,
    requiredCoherenceLevels: Object.freeze(['shot','scene','sequence','act','final'] as DirectorCoherenceLevel[]),
    requireProductFidelity: false,
    requireExternalNleRoundTrip: true,
    minimumAudioStemRoles: Object.freeze(['dialogue','music','sfx','foley','ambience']),
  }),
]);

export interface DirectorProductionArtifactEvidence {
  providerId: string;
  modelId: string;
  modelVersion: string;
  providerJobId: string;
  providerRuntimeReceiptId: string;
  assetId: string;
  sha256: string;
  contentType: string;
  measuredDurationSeconds: number;
  storageVerified: boolean;
  qualityClaim: boolean;
  productionProvider: boolean;
  synthetic?: boolean;
  evidenceIds: readonly string[];
}

export interface DirectorProductionMetricObservation {
  metric: DirectorProductionQualityMetric;
  score: number;
  evidenceIds: readonly string[];
}

export interface DirectorHierarchicalCoherenceEvidence {
  level: DirectorCoherenceLevel;
  scopeRef: string;
  admissible: boolean;
  evidenceIds: readonly string[];
}

export interface DirectorProductionEditabilityEvidence {
  baselineTimelineVersionId: string;
  finalTimelineVersionId: string;
  manualDirectiveIds: readonly string[];
  manualDirectivesSurvived: boolean;
  localizedRepairReceiptIds: readonly string[];
  audioStemRoles: readonly string[];
  externalNleRoundTrip?: {
    format: 'otio' | 'fcpxml' | 'aaf' | 'edl' | 'premiere-xml';
    exportedArtifactId: string;
    importedTimelineVersionId: string;
    preservedManualDirectiveIds: readonly string[];
    evidenceIds: readonly string[];
  };
  evidenceIds: readonly string[];
}

export interface DirectorProductionFinalEvidence {
  fixtureKind: DirectorProductionFixtureKind;
  projectId: string;
  finalMasterAssetId: string;
  finalWatchPasses: number;
  unresolvedDefectIds: readonly string[];
  rehearsalGraduationReceiptIds: readonly string[];
  artifact: DirectorProductionArtifactEvidence;
  metrics: readonly DirectorProductionMetricObservation[];
  coherence: readonly DirectorHierarchicalCoherenceEvidence[];
  editability: DirectorProductionEditabilityEvidence;
  rightsEvidenceIds: readonly string[];
  evidenceIds: readonly string[];
}

export interface DirectorProductionFinalDecision {
  fixtureKind: DirectorProductionFixtureKind;
  projectId: string;
  admissible: boolean;
  reasons: readonly string[];
  authority: 'DIRECTOR_PRODUCTION_QUALITY_QC';
}

const MINIMUM_SCORE: Readonly<Record<DirectorProductionQualityMetric, number>> = Object.freeze({
  'story-causality': 0.82,
  'character-identity': 0.90,
  'voice-identity': 0.88,
  'wardrobe-continuity': 0.90,
  'product-fidelity': 0.94,
  'spatial-continuity': 0.84,
  'performance-naturalness': 0.78,
  'lip-sync': 0.84,
  'audio-continuity': 0.84,
  'camera-direction': 0.80,
  'lighting-continuity': 0.80,
  'temporal-continuity': 0.84,
  'visual-cleanliness': 0.84,
  'rights-coverage': 1,
});

const FORBIDDEN_CERT_PROVIDER_IDS = new Set([
  'director-certification-smoke',
  'fixture',
  'synthetic',
  'mock',
  'test',
]);

export function directorProductionFixtureProfile(kind: DirectorProductionFixtureKind): DirectorProductionFixtureProfile {
  const profile = DIRECTOR_PRODUCTION_FINAL_FIXTURES.find((candidate) => candidate.kind === kind);
  if (!profile) throw new Error(`DIRECTOR_PRODUCTION_FIXTURE_UNKNOWN:${kind}`);
  return profile;
}

export function evaluateDirectorProductionFinalEvidence(
  evidence: DirectorProductionFinalEvidence,
): DirectorProductionFinalDecision {
  const reasons: string[] = [];
  const profile = directorProductionFixtureProfile(evidence.fixtureKind);

  if (!evidence.projectId.trim() || !evidence.finalMasterAssetId.trim() || !evidence.evidenceIds.length) {
    reasons.push('DIRECTOR_PRODUCTION_FINAL_IDENTITY_OR_EVIDENCE_REQUIRED');
  }

  const artifact = evidence.artifact;
  if (
    !artifact.providerId.trim() ||
    !artifact.modelId.trim() ||
    !artifact.modelVersion.trim() ||
    !artifact.providerJobId.trim() ||
    !artifact.providerRuntimeReceiptId.trim() ||
    !artifact.assetId.trim() ||
    !artifact.evidenceIds.length
  ) reasons.push('DIRECTOR_PRODUCTION_FINAL_PROVIDER_PROVENANCE_REQUIRED');
  if (FORBIDDEN_CERT_PROVIDER_IDS.has(artifact.providerId.toLowerCase())) {
    reasons.push('DIRECTOR_PRODUCTION_FINAL_SMOKE_PROVIDER_FORBIDDEN');
  }
  if (!artifact.productionProvider || !artifact.qualityClaim) {
    reasons.push('DIRECTOR_PRODUCTION_FINAL_REAL_PROVIDER_QUALITY_CLAIM_REQUIRED');
  }
  if (artifact.synthetic === true) reasons.push('DIRECTOR_PRODUCTION_FINAL_SYNTHETIC_EVIDENCE_FORBIDDEN');
  if (!/^[a-f0-9]{64}$/i.test(artifact.sha256)) reasons.push('DIRECTOR_PRODUCTION_FINAL_MASTER_HASH_INVALID');
  if (!artifact.contentType.toLowerCase().startsWith('video/')) reasons.push('DIRECTOR_PRODUCTION_FINAL_MASTER_VIDEO_REQUIRED');
  if (!artifact.storageVerified) reasons.push('DIRECTOR_PRODUCTION_FINAL_STORAGE_VERIFICATION_REQUIRED');
  if (
    !Number.isFinite(artifact.measuredDurationSeconds) ||
    artifact.measuredDurationSeconds < profile.minimumDurationSeconds ||
    artifact.measuredDurationSeconds > profile.maximumDurationSeconds
  ) reasons.push('DIRECTOR_PRODUCTION_FINAL_DURATION_OUT_OF_RANGE');

  if (!Number.isInteger(evidence.finalWatchPasses) || evidence.finalWatchPasses < 1) {
    reasons.push('DIRECTOR_PRODUCTION_FINAL_FULL_WATCH_REQUIRED');
  }
  if (evidence.unresolvedDefectIds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_UNRESOLVED_DEFECTS');
  if (!evidence.rehearsalGraduationReceiptIds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_REHEARSAL_GRADUATION_REQUIRED');
  if (!evidence.rightsEvidenceIds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_RIGHTS_EVIDENCE_REQUIRED');

  const byMetric = new Map(evidence.metrics.map((observation) => [observation.metric, observation]));
  for (const metric of profile.requiredMetrics) {
    const observation = byMetric.get(metric);
    if (!observation) {
      reasons.push(`DIRECTOR_PRODUCTION_FINAL_METRIC_MISSING:${metric}`);
      continue;
    }
    if (!Number.isFinite(observation.score) || observation.score < 0 || observation.score > 1) {
      reasons.push(`DIRECTOR_PRODUCTION_FINAL_METRIC_INVALID:${metric}`);
      continue;
    }
    if (!observation.evidenceIds.length) reasons.push(`DIRECTOR_PRODUCTION_FINAL_METRIC_EVIDENCE_REQUIRED:${metric}`);
    if (observation.score < MINIMUM_SCORE[metric]) reasons.push(`DIRECTOR_PRODUCTION_FINAL_METRIC_LOW:${metric}`);
  }

  for (const level of profile.requiredCoherenceLevels) {
    const observations = evidence.coherence.filter((item) => item.level === level);
    if (!observations.length) {
      reasons.push(`DIRECTOR_PRODUCTION_FINAL_COHERENCE_MISSING:${level}`);
      continue;
    }
    if (observations.some((item) => !item.admissible || !item.scopeRef.trim() || !item.evidenceIds.length)) {
      reasons.push(`DIRECTOR_PRODUCTION_FINAL_COHERENCE_FAILED:${level}`);
    }
  }

  const editability = evidence.editability;
  if (
    !editability.baselineTimelineVersionId.trim() ||
    !editability.finalTimelineVersionId.trim() ||
    editability.baselineTimelineVersionId === editability.finalTimelineVersionId ||
    !editability.evidenceIds.length
  ) reasons.push('DIRECTOR_PRODUCTION_FINAL_EDITABLE_TIMELINE_REQUIRED');
  if (!editability.manualDirectiveIds.length || !editability.manualDirectivesSurvived) {
    reasons.push('DIRECTOR_PRODUCTION_FINAL_MANUAL_LOCK_SURVIVAL_REQUIRED');
  }
  if (!editability.localizedRepairReceiptIds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_LOCALIZED_REPAIR_REQUIRED');

  const stemRoles = new Set(editability.audioStemRoles);
  for (const role of profile.minimumAudioStemRoles) {
    if (!stemRoles.has(role)) reasons.push(`DIRECTOR_PRODUCTION_FINAL_AUDIO_STEM_REQUIRED:${role}`);
  }

  if (profile.requireExternalNleRoundTrip) {
    const roundTrip = editability.externalNleRoundTrip;
    if (
      !roundTrip ||
      !roundTrip.exportedArtifactId.trim() ||
      !roundTrip.importedTimelineVersionId.trim() ||
      !roundTrip.evidenceIds.length
    ) {
      reasons.push('DIRECTOR_PRODUCTION_FINAL_NLE_ROUND_TRIP_REQUIRED');
    } else {
      const preserved = new Set(roundTrip.preservedManualDirectiveIds);
      if (editability.manualDirectiveIds.some((id) => !preserved.has(id))) {
        reasons.push('DIRECTOR_PRODUCTION_FINAL_NLE_MANUAL_LOCK_LOSS');
      }
    }
  }

  return Object.freeze({
    fixtureKind: evidence.fixtureKind,
    projectId: evidence.projectId,
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    authority: 'DIRECTOR_PRODUCTION_QUALITY_QC',
  });
}

export interface DirectorProductionFinalMatrixDecision {
  admissible: boolean;
  fixtureDecisions: readonly DirectorProductionFinalDecision[];
  reasons: readonly string[];
  authority: 'DIRECTOR_PRODUCTION_FINAL_MATRIX';
}

export function evaluateDirectorProductionFinalMatrix(
  evidence: readonly DirectorProductionFinalEvidence[],
): DirectorProductionFinalMatrixDecision {
  const reasons: string[] = [];
  const requiredKinds = DIRECTOR_PRODUCTION_FINAL_FIXTURES.map((fixture) => fixture.kind);
  for (const kind of requiredKinds) {
    const matches = evidence.filter((item) => item.fixtureKind === kind);
    if (matches.length !== 1) reasons.push(`DIRECTOR_PRODUCTION_FINAL_FIXTURE_COUNT:${kind}:${matches.length}`);
  }
  if (evidence.length !== requiredKinds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_EXACTLY_FOUR_PRODUCTIONS_REQUIRED');

  const projectIds = new Set(evidence.map((item) => item.projectId));
  const assetIds = new Set(evidence.map((item) => item.artifact.assetId));
  const hashes = new Set(evidence.map((item) => item.artifact.sha256.toLowerCase()));
  if (projectIds.size !== evidence.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_PROJECT_REUSE_FORBIDDEN');
  if (assetIds.size !== evidence.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_MASTER_ASSET_REUSE_FORBIDDEN');
  if (hashes.size !== evidence.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_MASTER_HASH_REUSE_FORBIDDEN');

  const fixtureDecisions = evidence.map(evaluateDirectorProductionFinalEvidence);
  for (const decision of fixtureDecisions) {
    if (!decision.admissible) reasons.push(`DIRECTOR_PRODUCTION_FINAL_FIXTURE_FAILED:${decision.fixtureKind}`);
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    fixtureDecisions: Object.freeze(fixtureDecisions),
    reasons: Object.freeze([...new Set(reasons)]),
    authority: 'DIRECTOR_PRODUCTION_FINAL_MATRIX',
  });
}

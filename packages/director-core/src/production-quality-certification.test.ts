import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_PRODUCTION_FINAL_FIXTURES,
  evaluateDirectorProductionFinalEvidence,
  evaluateDirectorProductionFinalMatrix,
  type DirectorProductionFinalEvidence,
  type DirectorProductionFixtureKind,
  type DirectorProductionQualityMetric,
} from './production-quality-certification.js';

const allMetrics: readonly DirectorProductionQualityMetric[] = [
  'story-causality','character-identity','voice-identity','wardrobe-continuity','product-fidelity',
  'spatial-continuity','performance-naturalness','lip-sync','audio-continuity','camera-direction',
  'lighting-continuity','temporal-continuity','visual-cleanliness','rights-coverage',
];

function fixture(kind: DirectorProductionFixtureKind, index = 1): DirectorProductionFinalEvidence {
  const profile = DIRECTOR_PRODUCTION_FINAL_FIXTURES.find((item) => item.kind === kind)!;
  const duration = Math.round((profile.minimumDurationSeconds + profile.maximumDurationSeconds) / 2);
  return {
    fixtureKind: kind,
    projectId: `project:${index}`,
    finalMasterAssetId: `master:${index}`,
    finalWatchPasses: 1,
    unresolvedDefectIds: [],
    rehearsalGraduationReceiptIds: [`rehearsal:${index}`],
    artifact: {
      providerId: 'production-video-worker',
      modelId: 'cinematic-model',
      modelVersion: '1.0.0',
      providerJobId: `provider-job:${index}`,
      providerRuntimeReceiptId: `runtime:${index}`,
      assetId: `asset:${index}`,
      sha256: String(index).padStart(64, 'a').slice(-64),
      contentType: 'video/mp4',
      measuredDurationSeconds: duration,
      storageVerified: true,
      qualityClaim: true,
      productionProvider: true,
      evidenceIds: [`provider-evidence:${index}`],
    },
    metrics: allMetrics.map((metric) => ({
      metric,
      score: metric === 'rights-coverage' ? 1 : 0.98,
      evidenceIds: [`metric:${metric}:${index}`],
    })),
    coherence: profile.requiredCoherenceLevels.map((level) => ({
      level,
      scopeRef: `${level}:${index}`,
      admissible: true,
      evidenceIds: [`coherence:${level}:${index}`],
    })),
    editability: {
      baselineTimelineVersionId: `timeline:${index}:base`,
      finalTimelineVersionId: `timeline:${index}:final`,
      manualDirectiveIds: [`directive:${index}`],
      manualDirectivesSurvived: true,
      localizedRepairReceiptIds: [`repair:${index}`],
      audioStemRoles: ['dialogue','music','sfx','foley','ambience'],
      ...(profile.requireExternalNleRoundTrip ? {
        externalNleRoundTrip: {
          format: 'otio' as const,
          exportedArtifactId: `otio:${index}`,
          importedTimelineVersionId: `timeline:${index}:roundtrip`,
          preservedManualDirectiveIds: [`directive:${index}`],
          evidenceIds: [`nle:${index}`],
        },
      } : {}),
      evidenceIds: [`editability:${index}`],
    },
    rightsEvidenceIds: [`rights:${index}`],
    evidenceIds: [`production:${index}`],
  };
}

describe('DIRECTOR-PRODUCTION.FINAL quality gate', () => {
  it('cannot promote the old smoke renderer into cinematic certification', () => {
    const evidence = fixture('commercial-30s');
    const decision = evaluateDirectorProductionFinalEvidence({
      ...evidence,
      artifact: {
        ...evidence.artifact,
        providerId: 'director-certification-smoke',
        qualityClaim: false,
        productionProvider: false,
      },
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_SMOKE_PROVIDER_FORBIDDEN');
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_REAL_PROVIDER_QUALITY_CLAIM_REQUIRED');
  });

  it('requires measured duration, real QC evidence, rehearsal, editability and lock survival', () => {
    const evidence = fixture('branded-short-8-13m');
    const decision = evaluateDirectorProductionFinalEvidence({
      ...evidence,
      finalWatchPasses: 0,
      rehearsalGraduationReceiptIds: [],
      metrics: evidence.metrics.filter((metric) => metric.metric !== 'character-identity'),
      editability: {
        ...evidence.editability,
        manualDirectivesSurvived: false,
        localizedRepairReceiptIds: [],
      },
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_FULL_WATCH_REQUIRED');
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_REHEARSAL_GRADUATION_REQUIRED');
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_METRIC_MISSING:character-identity');
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_MANUAL_LOCK_SURVIVAL_REQUIRED');
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_LOCALIZED_REPAIR_REQUIRED');
  });

  it('requires a real external NLE round trip for the feature fixture', () => {
    const evidence = fixture('feature-55-70m');
    const decision = evaluateDirectorProductionFinalEvidence({
      ...evidence,
      editability: { ...evidence.editability, externalNleRoundTrip: undefined },
    });
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_NLE_ROUND_TRIP_REQUIRED');
  });

  it('passes only when all four distinct real-production fixtures pass', () => {
    const matrix = evaluateDirectorProductionFinalMatrix([
      fixture('commercial-30s', 1),
      fixture('branded-short-8-13m', 2),
      fixture('episode-22-30m', 3),
      fixture('feature-55-70m', 4),
    ]);
    expect(matrix.admissible).toBe(true);
    expect(matrix.fixtureDecisions).toHaveLength(4);
  });

  it('rejects reused projects or masters across the matrix', () => {
    const first = fixture('commercial-30s', 1);
    const second = fixture('branded-short-8-13m', 2);
    const matrix = evaluateDirectorProductionFinalMatrix([
      first,
      { ...second, projectId: first.projectId, artifact: { ...second.artifact, assetId: first.artifact.assetId, sha256: first.artifact.sha256 } },
      fixture('episode-22-30m', 3),
      fixture('feature-55-70m', 4),
    ]);
    expect(matrix.admissible).toBe(false);
    expect(matrix.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_PROJECT_REUSE_FORBIDDEN');
    expect(matrix.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_MASTER_ASSET_REUSE_FORBIDDEN');
    expect(matrix.reasons).toContain('DIRECTOR_PRODUCTION_FINAL_MASTER_HASH_REUSE_FORBIDDEN');
  });
});

import type {
  ReferenceArtifactPin,
  ReferenceProvenanceRegistry,
} from './index.js';

export const ARTIFACT_ADMISSION_READINESS_SCHEMA_VERSION =
  'REF-PROV-05' as const;

export type ArtifactAdmissionReadinessStatus =
  | 'READY_FOR_COMPATIBILITY_MANIFEST'
  | 'REQUIRES_LICENSE_REVIEW'
  | 'BLOCKED_UNRESOLVED_PIN'
  | 'BLOCKED_SOURCE_VERIFICATION'
  | 'BLOCKED_LICENSE';

export type ArtifactAdmissionReadinessRow = Readonly<{
  pinId: string;
  artifactId: string;
  referenceId: string;
  status: ArtifactAdmissionReadinessStatus;
  reason: string;
}>;

export type ArtifactAdmissionReadinessReport = Readonly<{
  schemaVersion:
    typeof ARTIFACT_ADMISSION_READINESS_SCHEMA_VERSION;
  rows: readonly ArtifactAdmissionReadinessRow[];
  readyPinIds: readonly string[];
  reviewRequiredPinIds: readonly string[];
  blockedPinIds: readonly string[];
}>;

function readinessForPin(
  registry: ReferenceProvenanceRegistry,
  pin: ReferenceArtifactPin,
): ArtifactAdmissionReadinessRow {
  if (pin.status !== 'PINNED' || !pin.digest) {
    return Object.freeze({
      pinId: pin.pinId,
      artifactId: pin.artifactId,
      referenceId: pin.referenceId,
      status: 'BLOCKED_UNRESOLVED_PIN',
      reason:
        'Artifact bytes are not pinned to a verified SHA-256 digest.',
    });
  }

  const source = registry.latestSourceVerification(pin.referenceId);
  if (
    !source ||
    (source.sourceVerificationStatus !== 'PINNED' &&
      source.sourceVerificationStatus !== 'VERSIONED') ||
    (pin.sourceRevision !== undefined &&
      source.sourceRevision !== pin.sourceRevision)
  ) {
    return Object.freeze({
      pinId: pin.pinId,
      artifactId: pin.artifactId,
      referenceId: pin.referenceId,
      status: 'BLOCKED_SOURCE_VERIFICATION',
      reason:
        'Artifact pin is not bound to reproducible source verification.',
    });
  }

  if (
    source.licenseFinding !== 'VERIFIED' ||
    source.licenseReusePolicy === 'NO_LICENSE' ||
    source.licenseReusePolicy === 'NOT_APPLICABLE'
  ) {
    return Object.freeze({
      pinId: pin.pinId,
      artifactId: pin.artifactId,
      referenceId: pin.referenceId,
      status: 'BLOCKED_LICENSE',
      reason:
        'Source license is not verified for runtime artifact admission.',
    });
  }

  if (
    source.licenseReusePolicy === 'COPYLEFT_REVIEW_REQUIRED' ||
    source.licenseReusePolicy === 'CUSTOM_REVIEW_REQUIRED'
  ) {
    return Object.freeze({
      pinId: pin.pinId,
      artifactId: pin.artifactId,
      referenceId: pin.referenceId,
      status: 'REQUIRES_LICENSE_REVIEW',
      reason:
        'Runtime use requires an explicit review receipt bound to the source verification.',
    });
  }

  return Object.freeze({
    pinId: pin.pinId,
    artifactId: pin.artifactId,
    referenceId: pin.referenceId,
    status: 'READY_FOR_COMPATIBILITY_MANIFEST',
    reason:
      'Pinned bytes, reproducible source, and permissive verified license are present.',
  });
}

export function buildArtifactAdmissionReadinessReport(
  registry: ReferenceProvenanceRegistry,
): ArtifactAdmissionReadinessReport {
  registry.assertIntegrity();
  const rows = Object.freeze(
    registry
      .listArtifactPins()
      .map((pin) => readinessForPin(registry, pin))
      .sort((a, b) => a.pinId.localeCompare(b.pinId)),
  );

  return Object.freeze({
    schemaVersion: ARTIFACT_ADMISSION_READINESS_SCHEMA_VERSION,
    rows,
    readyPinIds: Object.freeze(
      rows
        .filter(
          (row) =>
            row.status === 'READY_FOR_COMPATIBILITY_MANIFEST',
        )
        .map((row) => row.pinId),
    ),
    reviewRequiredPinIds: Object.freeze(
      rows
        .filter(
          (row) => row.status === 'REQUIRES_LICENSE_REVIEW',
        )
        .map((row) => row.pinId),
    ),
    blockedPinIds: Object.freeze(
      rows
        .filter(
          (row) =>
            row.status !== 'READY_FOR_COMPATIBILITY_MANIFEST' &&
            row.status !== 'REQUIRES_LICENSE_REVIEW',
        )
        .map((row) => row.pinId),
    ),
  });
}

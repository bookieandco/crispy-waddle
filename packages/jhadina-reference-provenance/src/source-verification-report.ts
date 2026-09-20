import type {
  ReferenceProvenanceRegistry,
  ReferenceSourceVerification,
} from './index.js';

export const SOURCE_VERIFICATION_REPORT_SCHEMA_VERSION =
  'REF-PROV-03' as const;

export type ReferenceSourceVerificationReport = Readonly<{
  schemaVersion: typeof SOURCE_VERIFICATION_REPORT_SCHEMA_VERSION;
  pinnedReferenceIds: readonly string[];
  licenseVerifiedReferenceIds: readonly string[];
  permissiveReuseReferenceIds: readonly string[];
  licenseReviewRequiredReferenceIds: readonly string[];
  noLicenseReferenceIds: readonly string[];
  sourceUnverifiedReferenceIds: readonly string[];
  unpinnedApiContractReferenceIds: readonly string[];
  unresolvedProvenanceDespiteVerifiedSourceIds: readonly string[];
  latestVerificationIds: readonly string[];
  totalReferences: number;
  totalVerifiedSources: number;
}>;

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

function isVerifiedSource(
  verification: ReferenceSourceVerification | undefined,
): boolean {
  return (
    verification?.sourceVerificationStatus === 'PINNED' ||
    verification?.sourceVerificationStatus === 'VERSIONED'
  );
}

export function buildReferenceSourceVerificationReport(
  registry: ReferenceProvenanceRegistry,
): ReferenceSourceVerificationReport {
  registry.assertIntegrity();
  const references = registry.listReferences();
  const latest = references
    .map((reference) => ({
      reference,
      verification: registry.latestSourceVerification(
        reference.referenceId,
      ),
    }));

  const pinnedReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ verification }) =>
          verification?.sourceVerificationStatus === 'PINNED',
      )
      .map(({ reference }) => reference.referenceId),
  );

  const licenseVerifiedReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ verification }) =>
          verification?.licenseFinding === 'VERIFIED',
      )
      .map(({ reference }) => reference.referenceId),
  );

  const permissiveReuseReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ verification }) =>
          verification?.licenseFinding === 'VERIFIED' &&
          verification.licenseReusePolicy === 'PERMISSIVE',
      )
      .map(({ reference }) => reference.referenceId),
  );

  const licenseReviewRequiredReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ verification }) =>
          verification?.licenseReusePolicy ===
            'COPYLEFT_REVIEW_REQUIRED' ||
          verification?.licenseReusePolicy ===
            'CUSTOM_REVIEW_REQUIRED',
      )
      .map(({ reference }) => reference.referenceId),
  );

  const noLicenseReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ verification }) =>
          verification?.licenseFinding === 'NO_LICENSE_FILE' ||
          verification?.licenseReusePolicy === 'NO_LICENSE',
      )
      .map(({ reference }) => reference.referenceId),
  );

  const sourceUnverifiedReferenceIds = uniqueSorted(
    latest
      .filter(({ verification }) => !verification)
      .map(({ reference }) => reference.referenceId),
  );

  const unpinnedApiContractReferenceIds = uniqueSorted(
    latest
      .filter(
        ({ reference, verification }) =>
          reference.kind === 'API_DOCUMENTATION' &&
          !isVerifiedSource(verification),
      )
      .map(({ reference }) => reference.referenceId),
  );

  const unresolvedProvenanceDespiteVerifiedSourceIds =
    uniqueSorted(
      latest
        .filter(
          ({ reference, verification }) =>
            isVerifiedSource(verification) &&
            (reference.traceabilityStatus === 'HANDOFF_ONLY' ||
              reference.traceabilityStatus === 'UNVERIFIED'),
        )
        .map(({ reference }) => reference.referenceId),
    );

  const latestVerificationIds = uniqueSorted(
    latest
      .map(({ verification }) => verification?.verificationId)
      .filter(
        (value): value is string => value !== undefined,
      ),
  );

  return Object.freeze({
    schemaVersion: SOURCE_VERIFICATION_REPORT_SCHEMA_VERSION,
    pinnedReferenceIds,
    licenseVerifiedReferenceIds,
    permissiveReuseReferenceIds,
    licenseReviewRequiredReferenceIds,
    noLicenseReferenceIds,
    sourceUnverifiedReferenceIds,
    unpinnedApiContractReferenceIds,
    unresolvedProvenanceDespiteVerifiedSourceIds,
    latestVerificationIds,
    totalReferences: references.length,
    totalVerifiedSources: latestVerificationIds.length,
  });
}

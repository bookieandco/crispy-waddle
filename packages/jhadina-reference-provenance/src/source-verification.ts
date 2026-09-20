import { createHash } from 'node:crypto';
import type {
  ReferenceAuthority,
  ReferenceProvenanceRegistry,
} from './index.js';

const NO_SOURCE_AUTHORITY: ReferenceAuthority = Object.freeze({
  runtimeAuthority: 'NONE',
  policyAuthority: 'NONE',
  executionAuthority: 'NONE',
  factualAuthority: 'NONE',
});

export const REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION =
  'REF-PROV-03' as const;

export type ReferenceSourceKind =
  | 'GIT_REPOSITORY'
  | 'API_DOCUMENTATION'
  | 'MODEL_ARTIFACT'
  | 'OTHER';

export type ReferenceRevisionKind =
  | 'GIT_COMMIT'
  | 'VERSION'
  | 'DOCUMENTATION_ANCHOR';

export type ReferenceSourceVerificationStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'REJECTED';

export type ReferenceLicenseVerificationStatus =
  | 'VERIFIED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE'
  | 'CONFLICTING';

export type ReferenceSourceRevision = Readonly<{
  kind: ReferenceRevisionKind;
  value: string;
  defaultBranch?: string;
}>;

export type ReferenceLicenseVerification = Readonly<{
  status: ReferenceLicenseVerificationStatus;
  expression?: string;
  evidenceLocator?: string;
  note?: string;
}>;

export type ReferenceSourceVerificationEvidence = Readonly<{
  evidenceId: string;
  kind:
    | 'UPSTREAM_REPOSITORY'
    | 'IMMUTABLE_REVISION'
    | 'LICENSE_FILE'
    | 'DOCUMENTATION'
    | 'OTHER';
  locator: string;
}>;

export type ReferenceSourceVerification = Readonly<{
  schemaVersion:
    typeof REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION;
  verificationId: string;
  referenceId: string;
  status: ReferenceSourceVerificationStatus;
  sourceKind: ReferenceSourceKind;
  upstreamLocator: string;
  revision?: ReferenceSourceRevision;
  sourceDigest?: string;
  license: ReferenceLicenseVerification;
  verifiedAt: string;
  evidence: readonly ReferenceSourceVerificationEvidence[];
  note?: string;
  authority: ReferenceAuthority;
  verificationHash: string;
}>;

export type RegisterReferenceSourceVerificationInput = Omit<
  ReferenceSourceVerification,
  'schemaVersion' | 'authority' | 'verificationHash'
>;

export type ReferenceSourceVerificationReport = Readonly<{
  schemaVersion:
    typeof REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION;
  totalReferences: number;
  totalVerifications: number;
  sourceVerifiedReferenceIds: readonly string[];
  sourcePartialReferenceIds: readonly string[];
  sourceRejectedReferenceIds: readonly string[];
  sourceUnverifiedReferenceIds: readonly string[];
  licenseVerifiedReferenceIds: readonly string[];
  licenseUnknownReferenceIds: readonly string[];
  relationshipStillUnverifiedReferenceIds: readonly string[];
}>;

function stableCanonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('REF_PROV_SOURCE_NONFINITE_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => stableCanonicalize(item))
      .join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .filter((key) => object[key] !== undefined)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableCanonicalize(
            object[key],
          )}`,
      )
      .join(',')}}`;
  }
  throw new Error('REF_PROV_SOURCE_UNSUPPORTED_VALUE');
}

function hash(value: unknown): string {
  return createHash('sha256')
    .update(stableCanonicalize(value), 'utf8')
    .digest('hex');
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

function assertAbsoluteLocator(value: string, code: string): void {
  if (
    !value.startsWith('https://') &&
    !value.startsWith('urn:')
  ) {
    throw new Error(code);
  }
}

function assertInput(
  input: RegisterReferenceSourceVerificationInput,
): void {
  if (!input.verificationId.trim()) {
    throw new Error('REF_PROV_SOURCE_VERIFICATION_ID_REQUIRED');
  }
  if (!input.referenceId.trim()) {
    throw new Error('REF_PROV_SOURCE_REFERENCE_ID_REQUIRED');
  }
  assertAbsoluteLocator(
    input.upstreamLocator,
    'REF_PROV_SOURCE_UPSTREAM_LOCATOR_INVALID',
  );
  if (Number.isNaN(Date.parse(input.verifiedAt))) {
    throw new Error('REF_PROV_SOURCE_VERIFIED_AT_INVALID');
  }
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_SOURCE_EVIDENCE_REQUIRED');
  }

  const evidenceIds = new Set<string>();
  for (const evidence of input.evidence) {
    if (!evidence.evidenceId.trim() || !evidence.locator.trim()) {
      throw new Error('REF_PROV_SOURCE_EVIDENCE_INVALID');
    }
    if (evidenceIds.has(evidence.evidenceId)) {
      throw new Error('REF_PROV_SOURCE_EVIDENCE_DUPLICATE');
    }
    evidenceIds.add(evidence.evidenceId);
  }

  if (input.status === 'VERIFIED' && !input.revision) {
    throw new Error('REF_PROV_SOURCE_REVISION_REQUIRED');
  }

  if (
    input.sourceKind === 'GIT_REPOSITORY' &&
    input.status === 'VERIFIED'
  ) {
    if (input.revision?.kind !== 'GIT_COMMIT') {
      throw new Error(
        'REF_PROV_SOURCE_GIT_COMMIT_REVISION_REQUIRED',
      );
    }
    if (!/^[0-9a-f]{40,64}$/i.test(input.revision.value)) {
      throw new Error('REF_PROV_SOURCE_GIT_REVISION_INVALID');
    }
    if (
      input.sourceDigest !==
      `git-commit:${input.revision.value.toLowerCase()}`
    ) {
      throw new Error('REF_PROV_SOURCE_GIT_DIGEST_MISMATCH');
    }
    if (!input.upstreamLocator.startsWith('https://github.com/')) {
      throw new Error('REF_PROV_SOURCE_GITHUB_LOCATOR_REQUIRED');
    }
  }

  if (
    input.license.status === 'VERIFIED' &&
    (!input.license.expression ||
      !input.license.evidenceLocator)
  ) {
    throw new Error(
      'REF_PROV_SOURCE_LICENSE_EVIDENCE_REQUIRED',
    );
  }
  if (
    input.license.status !== 'VERIFIED' &&
    (input.license.expression ||
      input.license.evidenceLocator)
  ) {
    throw new Error(
      'REF_PROV_SOURCE_UNVERIFIED_LICENSE_CLAIM_FORBIDDEN',
    );
  }
  if (
    input.license.status === 'VERIFIED' &&
    input.sourceKind === 'GIT_REPOSITORY' &&
    input.revision &&
    !input.license.evidenceLocator?.includes(input.revision.value)
  ) {
    throw new Error(
      'REF_PROV_SOURCE_LICENSE_NOT_REVISION_PINNED',
    );
  }
}

export function buildReferenceSourceVerification(
  input: RegisterReferenceSourceVerificationInput,
): ReferenceSourceVerification {
  assertInput(input);
  const withoutHash = {
    schemaVersion:
      REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION,
    verificationId: input.verificationId,
    referenceId: input.referenceId,
    status: input.status,
    sourceKind: input.sourceKind,
    upstreamLocator: input.upstreamLocator,
    revision: input.revision
      ? Object.freeze({ ...input.revision })
      : undefined,
    sourceDigest: input.sourceDigest,
    license: Object.freeze({ ...input.license }),
    verifiedAt: input.verifiedAt,
    evidence: Object.freeze(
      input.evidence.map((evidence) =>
        Object.freeze({ ...evidence }),
      ),
    ),
    note: input.note,
    authority: NO_SOURCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    verificationHash: hash(withoutHash),
  });
}

export class ReferenceSourceVerificationRegistry {
  private readonly verifications = new Map<
    string,
    ReferenceSourceVerification
  >();

  constructor(
    private readonly references: ReferenceProvenanceRegistry,
  ) {}

  register(
    input: RegisterReferenceSourceVerificationInput,
  ): ReferenceSourceVerification {
    if (!this.references.getReference(input.referenceId)) {
      throw new Error('REF_PROV_SOURCE_REFERENCE_NOT_REGISTERED');
    }
    if (this.verifications.has(input.referenceId)) {
      throw new Error(
        'REF_PROV_SOURCE_REFERENCE_ALREADY_VERIFIED',
      );
    }
    const verification =
      buildReferenceSourceVerification(input);
    this.verifications.set(
      verification.referenceId,
      verification,
    );
    return verification;
  }

  get(
    referenceId: string,
  ): ReferenceSourceVerification | undefined {
    return this.verifications.get(referenceId);
  }

  list(): readonly ReferenceSourceVerification[] {
    return Object.freeze(
      [...this.verifications.values()].sort((a, b) =>
        a.referenceId.localeCompare(b.referenceId),
      ),
    );
  }

  assertIntegrity(): void {
    for (const verification of this.verifications.values()) {
      if (
        !this.references.getReference(
          verification.referenceId,
        )
      ) {
        throw new Error(
          'REF_PROV_SOURCE_VERIFICATION_ORPHANED',
        );
      }
      assertInput(verification);
    }
  }

  report(): ReferenceSourceVerificationReport {
    this.assertIntegrity();
    const references = this.references.listReferences();
    const sourceVerifiedReferenceIds = uniqueSorted(
      this.list()
        .filter((item) => item.status === 'VERIFIED')
        .map((item) => item.referenceId),
    );
    const sourcePartialReferenceIds = uniqueSorted(
      this.list()
        .filter((item) => item.status === 'PARTIAL')
        .map((item) => item.referenceId),
    );
    const sourceRejectedReferenceIds = uniqueSorted(
      this.list()
        .filter((item) => item.status === 'REJECTED')
        .map((item) => item.referenceId),
    );
    const verifiedSet = new Set(
      this.list().map((item) => item.referenceId),
    );
    const sourceUnverifiedReferenceIds = uniqueSorted(
      references
        .filter(
          (reference) =>
            !verifiedSet.has(reference.referenceId),
        )
        .map((reference) => reference.referenceId),
    );
    const licenseVerifiedReferenceIds = uniqueSorted(
      this.list()
        .filter(
          (item) => item.license.status === 'VERIFIED',
        )
        .map((item) => item.referenceId),
    );
    const licenseUnknownReferenceIds = uniqueSorted(
      this.list()
        .filter(
          (item) =>
            item.license.status === 'UNKNOWN' ||
            item.license.status === 'CONFLICTING',
        )
        .map((item) => item.referenceId),
    );
    const relationshipStillUnverifiedReferenceIds =
      uniqueSorted(
        references
          .filter(
            (reference) =>
              (reference.traceabilityStatus ===
                'HANDOFF_ONLY' ||
                reference.traceabilityStatus ===
                  'UNVERIFIED') &&
              verifiedSet.has(reference.referenceId),
          )
          .map((reference) => reference.referenceId),
      );

    return Object.freeze({
      schemaVersion:
        REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION,
      totalReferences: references.length,
      totalVerifications: this.verifications.size,
      sourceVerifiedReferenceIds,
      sourcePartialReferenceIds,
      sourceRejectedReferenceIds,
      sourceUnverifiedReferenceIds,
      licenseVerifiedReferenceIds,
      licenseUnknownReferenceIds,
      relationshipStillUnverifiedReferenceIds,
    });
  }
}

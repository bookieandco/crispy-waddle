import { createHash } from 'node:crypto';
import type {
  ProviderContractSnapshot,
  ReferenceArtifactPin,
  ReferenceAuthority,
  ReferenceEvidence,
  ReferenceProvenanceRegistry,
  ReferenceSourceVerification,
} from './index.js';

export const ARTIFACT_ADMISSION_SCHEMA_VERSION =
  'REF-PROV-05' as const;

const NO_ADMISSION_AUTHORITY: ReferenceAuthority = Object.freeze({
  runtimeAuthority: 'NONE',
  policyAuthority: 'NONE',
  executionAuthority: 'NONE',
  factualAuthority: 'NONE',
});

export type ArtifactRuntimeDescriptor = Readonly<{
  runtimeName: string;
  runtimeVersion: string;
  platform: string;
  architecture: string;
  accelerator?: string;
}>;

export type ArtifactCompatibilityManifestInput = Readonly<{
  manifestId: string;
  pinId: string;
  artifactId: string;
  supportedRuntimes: readonly ArtifactRuntimeDescriptor[];
  requiredProviderContractIds: readonly string[];
  createdAt: string;
  evidence: readonly ReferenceEvidence[];
  notes?: string;
}>;

export type ArtifactCompatibilityManifest = Readonly<{
  schemaVersion: typeof ARTIFACT_ADMISSION_SCHEMA_VERSION;
  manifestId: string;
  pinId: string;
  artifactId: string;
  supportedRuntimes: readonly ArtifactRuntimeDescriptor[];
  requiredProviderContractIds: readonly string[];
  createdAt: string;
  evidence: readonly ReferenceEvidence[];
  notes?: string;
  manifestHash: string;
  authority: ReferenceAuthority;
}>;

export type ArtifactLicenseReviewReceipt = Readonly<{
  receiptId: string;
  referenceId: string;
  sourceVerificationId: string;
  scope: 'RUNTIME_USE';
  decision: 'ALLOW' | 'DENY';
  reviewerId: string;
  reviewedAt: string;
  evidenceRefs: readonly string[];
}>;

export type ArtifactAdmissionRequest = Readonly<{
  admissionId: string;
  pinId: string;
  bytes: Uint8Array;
  compatibilityManifest: ArtifactCompatibilityManifest;
  runtime: ArtifactRuntimeDescriptor;
  activeProviderContractIds: readonly string[];
  admittedAt: string;
  licenseReviewReceipt?: ArtifactLicenseReviewReceipt;
}>;

export type ArtifactAdmissionLicenseBasis =
  | 'PERMISSIVE_VERIFIED'
  | 'EXPLICIT_REVIEW';

export type ArtifactAdmissionReceipt = Readonly<{
  schemaVersion: typeof ARTIFACT_ADMISSION_SCHEMA_VERSION;
  admissionId: string;
  pinId: string;
  referenceId: string;
  artifactId: string;
  artifactDigest: string;
  pinHash: string;
  sourceVerificationId: string;
  sourceVerificationHash: string;
  sourceRevision?: string;
  compatibilityManifestId: string;
  compatibilityManifestHash: string;
  runtime: ArtifactRuntimeDescriptor;
  activeProviderContractIds: readonly string[];
  providerContractDigests: Readonly<Record<string, string>>;
  licenseBasis: ArtifactAdmissionLicenseBasis;
  licenseReviewReceiptId?: string;
  registryHash: string;
  admittedAt: string;
  receiptHash: string;
  authority: ReferenceAuthority;
}>;

export type RuntimeArtifactAttestationRequest = Readonly<{
  attestationId: string;
  admissionReceipt: ArtifactAdmissionReceipt;
  runtimeInstanceId: string;
  runtime: ArtifactRuntimeDescriptor;
  observedArtifactDigest: string;
  loadedAt: string;
}>;

export type RuntimeArtifactAttestation = Readonly<{
  schemaVersion: typeof ARTIFACT_ADMISSION_SCHEMA_VERSION;
  attestationId: string;
  admissionId: string;
  admissionReceiptHash: string;
  pinId: string;
  artifactId: string;
  artifactDigest: string;
  runtimeInstanceId: string;
  runtime: ArtifactRuntimeDescriptor;
  loadedAt: string;
  attestationHash: string;
  authority: ReferenceAuthority;
}>;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function stableCanonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('REF_PROV_05_NONFINITE_NUMBER');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableCanonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(object)
        .sort()
        .filter((key) => object[key] !== undefined)
        .map(
          (key) =>
            JSON.stringify(key) +
            ':' +
            stableCanonicalize(object[key]),
        )
        .join(',') +
      '}'
    );
  }
  throw new Error('REF_PROV_05_UNSUPPORTED_VALUE');
}

function hash(value: unknown): string {
  return createHash('sha256')
    .update(stableCanonicalize(value), 'utf8')
    .digest('hex');
}

function digestBytes(bytes: Uint8Array): string {
  return (
    'sha256:' +
    createHash('sha256').update(bytes).digest('hex')
  );
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

function freezeRuntime(
  runtime: ArtifactRuntimeDescriptor,
): ArtifactRuntimeDescriptor {
  return Object.freeze({
    runtimeName: runtime.runtimeName,
    runtimeVersion: runtime.runtimeVersion,
    platform: runtime.platform,
    architecture: runtime.architecture,
    accelerator: runtime.accelerator,
  });
}

function runtimeKey(runtime: ArtifactRuntimeDescriptor): string {
  return stableCanonicalize(freezeRuntime(runtime));
}

function assertRuntime(runtime: ArtifactRuntimeDescriptor): void {
  assertNonEmpty(
    runtime.runtimeName,
    'REF_PROV_05_RUNTIME_NAME_REQUIRED',
  );
  assertNonEmpty(
    runtime.runtimeVersion,
    'REF_PROV_05_RUNTIME_VERSION_REQUIRED',
  );
  assertNonEmpty(
    runtime.platform,
    'REF_PROV_05_RUNTIME_PLATFORM_REQUIRED',
  );
  assertNonEmpty(
    runtime.architecture,
    'REF_PROV_05_RUNTIME_ARCHITECTURE_REQUIRED',
  );
  if (runtime.accelerator !== undefined) {
    assertNonEmpty(
      runtime.accelerator,
      'REF_PROV_05_RUNTIME_ACCELERATOR_INVALID',
    );
  }
}

function assertIsoTimestamp(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

function freezeEvidence(
  evidence: readonly ReferenceEvidence[],
): readonly ReferenceEvidence[] {
  return Object.freeze(
    evidence.map((item) =>
      Object.freeze({
        evidenceId: item.evidenceId,
        kind: item.kind,
        locator: item.locator,
        note: item.note,
      }),
    ),
  );
}

function assertPinnedArtifactBytes(
  pin: ReferenceArtifactPin,
  bytes: Uint8Array,
): string {
  if (pin.status !== 'PINNED' || !pin.digest) {
    throw new Error('REF_PROV_05_ARTIFACT_NOT_PINNED');
  }
  const actual = digestBytes(bytes);
  if (actual !== pin.digest) {
    throw new Error('REF_PROV_05_ARTIFACT_DIGEST_MISMATCH');
  }
  if (
    pin.byteLength !== undefined &&
    pin.byteLength !== bytes.byteLength
  ) {
    throw new Error('REF_PROV_05_ARTIFACT_LENGTH_MISMATCH');
  }
  return actual;
}

function assertSourceLineage(
  pin: ReferenceArtifactPin,
  source: ReferenceSourceVerification | undefined,
): ReferenceSourceVerification {
  if (!source) {
    throw new Error('REF_PROV_05_SOURCE_VERIFICATION_REQUIRED');
  }
  if (
    source.sourceVerificationStatus !== 'PINNED' &&
    source.sourceVerificationStatus !== 'VERSIONED'
  ) {
    throw new Error('REF_PROV_05_SOURCE_NOT_REPRODUCIBLE');
  }
  if (
    pin.sourceRevision !== undefined &&
    source.sourceRevision !== pin.sourceRevision
  ) {
    throw new Error('REF_PROV_05_SOURCE_REVISION_MISMATCH');
  }
  return source;
}

function assertLicenseAdmission(
  source: ReferenceSourceVerification,
  review: ArtifactLicenseReviewReceipt | undefined,
  admittedAt: string,
): {
  basis: ArtifactAdmissionLicenseBasis;
  reviewReceiptId?: string;
} {
  if (
    source.licenseFinding === 'VERIFIED' &&
    source.licenseReusePolicy === 'PERMISSIVE'
  ) {
    return { basis: 'PERMISSIVE_VERIFIED' };
  }

  if (
    source.licenseFinding !== 'VERIFIED' ||
    source.licenseReusePolicy === 'NO_LICENSE' ||
    source.licenseReusePolicy === 'NOT_APPLICABLE'
  ) {
    throw new Error('REF_PROV_05_LICENSE_NOT_ADMISSIBLE');
  }

  if (!review) {
    throw new Error('REF_PROV_05_LICENSE_REVIEW_REQUIRED');
  }
  if (
    review.referenceId !== source.referenceId ||
    review.sourceVerificationId !== source.verificationId ||
    review.scope !== 'RUNTIME_USE'
  ) {
    throw new Error('REF_PROV_05_LICENSE_REVIEW_BINDING_MISMATCH');
  }
  if (review.decision !== 'ALLOW') {
    throw new Error('REF_PROV_05_LICENSE_REVIEW_DENIED');
  }
  assertNonEmpty(
    review.receiptId,
    'REF_PROV_05_LICENSE_REVIEW_ID_REQUIRED',
  );
  assertNonEmpty(
    review.reviewerId,
    'REF_PROV_05_LICENSE_REVIEWER_REQUIRED',
  );
  assertIsoTimestamp(
    review.reviewedAt,
    'REF_PROV_05_LICENSE_REVIEW_TIME_INVALID',
  );
  if (Date.parse(review.reviewedAt) > Date.parse(admittedAt)) {
    throw new Error('REF_PROV_05_LICENSE_REVIEW_AFTER_ADMISSION');
  }
  if (review.evidenceRefs.length === 0) {
    throw new Error(
      'REF_PROV_05_LICENSE_REVIEW_EVIDENCE_REQUIRED',
    );
  }
  return {
    basis: 'EXPLICIT_REVIEW',
    reviewReceiptId: review.receiptId,
  };
}

function providerContractDigestMap(
  registry: ReferenceProvenanceRegistry,
  contractIds: readonly string[],
): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const contractId of uniqueSorted(contractIds)) {
    const contract: ProviderContractSnapshot | undefined =
      registry.getProviderContract(contractId);
    if (!contract) {
      throw new Error(
        'REF_PROV_05_PROVIDER_CONTRACT_NOT_REGISTERED',
      );
    }
    result[contractId] = contract.contractDigest;
  }
  return Object.freeze(result);
}

export function buildArtifactCompatibilityManifest(
  registry: ReferenceProvenanceRegistry,
  input: ArtifactCompatibilityManifestInput,
): ArtifactCompatibilityManifest {
  assertNonEmpty(
    input.manifestId,
    'REF_PROV_05_MANIFEST_ID_REQUIRED',
  );
  assertNonEmpty(input.pinId, 'REF_PROV_05_MANIFEST_PIN_REQUIRED');
  assertNonEmpty(
    input.artifactId,
    'REF_PROV_05_MANIFEST_ARTIFACT_REQUIRED',
  );
  assertIsoTimestamp(
    input.createdAt,
    'REF_PROV_05_MANIFEST_CREATED_AT_INVALID',
  );
  if (input.supportedRuntimes.length === 0) {
    throw new Error('REF_PROV_05_MANIFEST_RUNTIME_REQUIRED');
  }
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_05_MANIFEST_EVIDENCE_REQUIRED');
  }

  const pin = registry.getArtifactPin(input.pinId);
  if (!pin || pin.status !== 'PINNED') {
    throw new Error('REF_PROV_05_MANIFEST_REQUIRES_PINNED_ARTIFACT');
  }
  if (pin.artifactId !== input.artifactId) {
    throw new Error('REF_PROV_05_MANIFEST_ARTIFACT_MISMATCH');
  }

  const runtimeMap = new Map<string, ArtifactRuntimeDescriptor>();
  for (const runtime of input.supportedRuntimes) {
    assertRuntime(runtime);
    const key = runtimeKey(runtime);
    if (runtimeMap.has(key)) {
      throw new Error('REF_PROV_05_MANIFEST_RUNTIME_DUPLICATE');
    }
    runtimeMap.set(key, freezeRuntime(runtime));
  }

  const requiredProviderContractIds = uniqueSorted(
    input.requiredProviderContractIds,
  );
  providerContractDigestMap(
    registry,
    requiredProviderContractIds,
  );

  const supportedRuntimes = Object.freeze(
    [...runtimeMap.values()].sort((a, b) =>
      runtimeKey(a).localeCompare(runtimeKey(b)),
    ),
  );
  const withoutHash = {
    schemaVersion: ARTIFACT_ADMISSION_SCHEMA_VERSION,
    manifestId: input.manifestId,
    pinId: input.pinId,
    artifactId: input.artifactId,
    supportedRuntimes,
    requiredProviderContractIds,
    createdAt: input.createdAt,
    evidence: freezeEvidence(input.evidence),
    notes: input.notes,
    authority: NO_ADMISSION_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    manifestHash: hash(withoutHash),
  });
}

export class ArtifactAdmissionGate {
  private readonly admissions = new Map<
    string,
    ArtifactAdmissionReceipt
  >();
  private readonly attestations = new Map<
    string,
    RuntimeArtifactAttestation
  >();

  constructor(
    private readonly registry: ReferenceProvenanceRegistry,
  ) {}

  admit(request: ArtifactAdmissionRequest): ArtifactAdmissionReceipt {
    if (this.admissions.has(request.admissionId)) {
      throw new Error('REF_PROV_05_ADMISSION_ID_REPLAY');
    }
    assertNonEmpty(
      request.admissionId,
      'REF_PROV_05_ADMISSION_ID_REQUIRED',
    );
    assertIsoTimestamp(
      request.admittedAt,
      'REF_PROV_05_ADMISSION_TIME_INVALID',
    );
    assertRuntime(request.runtime);

    const pin = this.registry.getArtifactPin(request.pinId);
    if (!pin) {
      throw new Error('REF_PROV_05_ARTIFACT_PIN_NOT_FOUND');
    }
    const artifactDigest = assertPinnedArtifactBytes(
      pin,
      request.bytes,
    );

    const reference = this.registry.getReference(pin.referenceId);
    if (!reference) {
      throw new Error('REF_PROV_05_REFERENCE_NOT_FOUND');
    }
    const source = assertSourceLineage(
      pin,
      this.registry.latestSourceVerification(pin.referenceId),
    );

    const manifest = request.compatibilityManifest;
    if (
      manifest.pinId !== pin.pinId ||
      manifest.artifactId !== pin.artifactId
    ) {
      throw new Error('REF_PROV_05_MANIFEST_BINDING_MISMATCH');
    }
    const rebuiltManifest = buildArtifactCompatibilityManifest(
      this.registry,
      {
        manifestId: manifest.manifestId,
        pinId: manifest.pinId,
        artifactId: manifest.artifactId,
        supportedRuntimes: manifest.supportedRuntimes,
        requiredProviderContractIds:
          manifest.requiredProviderContractIds,
        createdAt: manifest.createdAt,
        evidence: manifest.evidence,
        notes: manifest.notes,
      },
    );
    if (rebuiltManifest.manifestHash !== manifest.manifestHash) {
      throw new Error('REF_PROV_05_MANIFEST_HASH_MISMATCH');
    }

    const runtime = freezeRuntime(request.runtime);
    if (
      !manifest.supportedRuntimes.some(
        (supported) => runtimeKey(supported) === runtimeKey(runtime),
      )
    ) {
      throw new Error('REF_PROV_05_RUNTIME_INCOMPATIBLE');
    }

    const activeProviderContractIds = uniqueSorted(
      request.activeProviderContractIds,
    );
    const active = new Set(activeProviderContractIds);
    for (const requiredId of manifest.requiredProviderContractIds) {
      if (!active.has(requiredId)) {
        throw new Error(
          'REF_PROV_05_REQUIRED_PROVIDER_CONTRACT_MISSING',
        );
      }
    }
    const providerContractDigests = providerContractDigestMap(
      this.registry,
      activeProviderContractIds,
    );

    const license = assertLicenseAdmission(
      source,
      request.licenseReviewReceipt,
      request.admittedAt,
    );
    const registryHash = this.registry.snapshot(
      request.admittedAt,
    ).registryHash;

    const withoutHash = {
      schemaVersion: ARTIFACT_ADMISSION_SCHEMA_VERSION,
      admissionId: request.admissionId,
      pinId: pin.pinId,
      referenceId: pin.referenceId,
      artifactId: pin.artifactId,
      artifactDigest,
      pinHash: pin.pinHash,
      sourceVerificationId: source.verificationId,
      sourceVerificationHash: source.verificationHash,
      sourceRevision: source.sourceRevision,
      compatibilityManifestId: manifest.manifestId,
      compatibilityManifestHash: manifest.manifestHash,
      runtime,
      activeProviderContractIds,
      providerContractDigests,
      licenseBasis: license.basis,
      licenseReviewReceiptId: license.reviewReceiptId,
      registryHash,
      admittedAt: request.admittedAt,
      authority: NO_ADMISSION_AUTHORITY,
    } as const;
    const receipt = Object.freeze({
      ...withoutHash,
      receiptHash: hash(withoutHash),
    });
    this.admissions.set(receipt.admissionId, receipt);
    return receipt;
  }

  attest(
    request: RuntimeArtifactAttestationRequest,
  ): RuntimeArtifactAttestation {
    if (this.attestations.has(request.attestationId)) {
      throw new Error('REF_PROV_05_ATTESTATION_ID_REPLAY');
    }
    assertNonEmpty(
      request.attestationId,
      'REF_PROV_05_ATTESTATION_ID_REQUIRED',
    );
    assertNonEmpty(
      request.runtimeInstanceId,
      'REF_PROV_05_RUNTIME_INSTANCE_REQUIRED',
    );
    assertRuntime(request.runtime);
    assertIsoTimestamp(
      request.loadedAt,
      'REF_PROV_05_ATTESTATION_TIME_INVALID',
    );

    const receipt = this.admissions.get(
      request.admissionReceipt.admissionId,
    );
    if (
      !receipt ||
      receipt.receiptHash !== request.admissionReceipt.receiptHash
    ) {
      throw new Error('REF_PROV_05_ADMISSION_RECEIPT_NOT_REGISTERED');
    }
    if (
      Date.parse(request.loadedAt) <
      Date.parse(receipt.admittedAt)
    ) {
      throw new Error('REF_PROV_05_ATTESTATION_PRECEDES_ADMISSION');
    }
    if (
      runtimeKey(request.runtime) !== runtimeKey(receipt.runtime)
    ) {
      throw new Error('REF_PROV_05_ATTESTATION_RUNTIME_MISMATCH');
    }
    if (
      request.observedArtifactDigest !== receipt.artifactDigest
    ) {
      throw new Error('REF_PROV_05_ATTESTATION_DIGEST_MISMATCH');
    }

    const runtime = freezeRuntime(request.runtime);
    const withoutHash = {
      schemaVersion: ARTIFACT_ADMISSION_SCHEMA_VERSION,
      attestationId: request.attestationId,
      admissionId: receipt.admissionId,
      admissionReceiptHash: receipt.receiptHash,
      pinId: receipt.pinId,
      artifactId: receipt.artifactId,
      artifactDigest: receipt.artifactDigest,
      runtimeInstanceId: request.runtimeInstanceId,
      runtime,
      loadedAt: request.loadedAt,
      authority: NO_ADMISSION_AUTHORITY,
    } as const;
    const attestation = Object.freeze({
      ...withoutHash,
      attestationHash: hash(withoutHash),
    });
    this.attestations.set(
      attestation.attestationId,
      attestation,
    );
    return attestation;
  }

  getAdmission(
    admissionId: string,
  ): ArtifactAdmissionReceipt | undefined {
    return this.admissions.get(admissionId);
  }

  getAttestation(
    attestationId: string,
  ): RuntimeArtifactAttestation | undefined {
    return this.attestations.get(attestationId);
  }

  listAdmissions(): readonly ArtifactAdmissionReceipt[] {
    return Object.freeze(
      [...this.admissions.values()].sort((a, b) =>
        a.admissionId.localeCompare(b.admissionId),
      ),
    );
  }

  listAttestations(): readonly RuntimeArtifactAttestation[] {
    return Object.freeze(
      [...this.attestations.values()].sort((a, b) =>
        a.attestationId.localeCompare(b.attestationId),
      ),
    );
  }
}

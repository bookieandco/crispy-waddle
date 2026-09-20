import { createHash } from 'node:crypto';

export const REFERENCE_PROVENANCE_SCHEMA_VERSION =
  'REF-PROV-01' as const;

export const REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION =
  'REF-PROV-03' as const;

export const REFERENCE_PROVIDER_CONTRACT_SCHEMA_VERSION =
  'REF-PROV-04' as const;

export const REFERENCE_ARTIFACT_PIN_SCHEMA_VERSION =
  'REF-PROV-04' as const;

export type ReferenceKind =
  | 'GITHUB_REPOSITORY'
  | 'API_DOCUMENTATION'
  | 'PAPER'
  | 'DATASET'
  | 'STANDARD'
  | 'WEBSITE'
  | 'LIBRARY'
  | 'MODEL'
  | 'OTHER';

export type ReferenceRole =
  | 'ARCHITECTURE_REFERENCE'
  | 'ALGORITHM_REFERENCE'
  | 'API_PROVIDER'
  | 'DATA_SOURCE'
  | 'MODEL_REFERENCE'
  | 'SECURITY_REFERENCE'
  | 'UI_REFERENCE'
  | 'TEST_REFERENCE'
  | 'INSPIRATION'
  | 'OTHER';

export type ReferenceTraceabilityStatus =
  | 'REPO_TRACEABLE'
  | 'EXTERNALLY_VERIFIED'
  | 'HANDOFF_ONLY'
  | 'UNVERIFIED'
  | 'SUPERSEDED'
  | 'REJECTED';

export type ReferenceLicenseStatus =
  | 'VERIFIED'
  | 'DECLARED_UNVERIFIED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type ReferenceAdoptionStatus =
  | 'DISCOVERED'
  | 'EVALUATED'
  | 'PLANNED'
  | 'ADAPTED'
  | 'IMPLEMENTED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type BorrowedArtifactKind =
  | 'IDEA_ONLY'
  | 'INTERFACE_SHAPE'
  | 'ALGORITHM'
  | 'DATA_SCHEMA'
  | 'TEST_PATTERN'
  | 'CODE'
  | 'OTHER';

export type ReferenceDiscoverySource =
  | 'REPOSITORY'
  | 'HANDOFF'
  | 'USER'
  | 'WEB_RESEARCH'
  | 'OTHER';

export type ReferenceAuthority = Readonly<{
  runtimeAuthority: 'NONE';
  policyAuthority: 'NONE';
  executionAuthority: 'NONE';
  factualAuthority: 'NONE';
}>;

export const NO_REFERENCE_AUTHORITY: ReferenceAuthority =
  Object.freeze({
    runtimeAuthority: 'NONE',
    policyAuthority: 'NONE',
    executionAuthority: 'NONE',
    factualAuthority: 'NONE',
  });

export type ReferenceEvidence = Readonly<{
  evidenceId: string;
  kind:
    | 'REPO_PATH'
    | 'COMMIT'
    | 'PULL_REQUEST'
    | 'URL'
    | 'HANDOFF_NOTE'
    | 'OTHER';
  locator: string;
  note?: string;
}>;

export type ReferenceRecord = Readonly<{
  schemaVersion: typeof REFERENCE_PROVENANCE_SCHEMA_VERSION;
  referenceId: string;
  canonicalName: string;
  kind: ReferenceKind;
  roles: readonly ReferenceRole[];
  canonicalLocator: string;
  sourceRevision?: string;
  discoveredFrom: ReferenceDiscoverySource;
  traceabilityStatus: ReferenceTraceabilityStatus;
  licenseStatus: ReferenceLicenseStatus;
  licenseExpression?: string;
  licenseEvidenceLocator?: string;
  notes?: string;
  evidence: readonly ReferenceEvidence[];
  supersededByReferenceId?: string;
  authority: ReferenceAuthority;
  recordHash: string;
}>;

export type ReferenceImplementationMapping = Readonly<{
  mappingId: string;
  referenceId: string;
  subsystem: string;
  targetPaths: readonly string[];
  borrowedArtifactKinds: readonly BorrowedArtifactKind[];
  borrowedConcepts: readonly string[];
  adaptationNotes: string;
  adoptionStatus: ReferenceAdoptionStatus;
  implementationEvidence: readonly ReferenceEvidence[];
  sourceRevision?: string;
  mappingHash: string;
  authority: ReferenceAuthority;
}>;

export type ReferenceSourceVerificationStatus =
  | 'PINNED'
  | 'VERSIONED'
  | 'UNPINNED'
  | 'UNRESOLVED';

export type ReferenceLicenseFinding =
  | 'VERIFIED'
  | 'NO_LICENSE_FILE'
  | 'AMBIGUOUS'
  | 'NOT_APPLICABLE';

export type ReferenceLicenseReusePolicy =
  | 'PERMISSIVE'
  | 'COPYLEFT_REVIEW_REQUIRED'
  | 'CUSTOM_REVIEW_REQUIRED'
  | 'NO_LICENSE'
  | 'NOT_APPLICABLE';

export type ReferenceSourceVerification = Readonly<{
  schemaVersion:
    typeof REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION;
  verificationId: string;
  referenceId: string;
  canonicalSourceLocator: string;
  sourceVerificationStatus: ReferenceSourceVerificationStatus;
  sourceRevision?: string;
  sourceDigest?: string;
  verifiedAt: string;
  licenseFinding: ReferenceLicenseFinding;
  licenseExpression?: string;
  licenseEvidenceLocator?: string;
  licenseReusePolicy: ReferenceLicenseReusePolicy;
  evidence: readonly ReferenceEvidence[];
  notes?: string;
  authority: ReferenceAuthority;
  verificationHash: string;
}>;

export type ProviderContractProtocol =
  | 'HTTP'
  | 'JSON_RPC'
  | 'LOCAL_HTTP'
  | 'LOCAL_ADAPTER';

export type ProviderContractVersionStrategy =
  | 'HEADER'
  | 'PATH'
  | 'PROTOCOL'
  | 'UPSTREAM_REVISION'
  | 'PACKAGE_VERSION'
  | 'CONTRACT_DIGEST';

export type ProviderContractEndpoint = Readonly<{
  operationId: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  pathTemplate: string;
  requiredRequestHeaders: readonly string[];
  requiredRequestFields: readonly string[];
  requiredResponseFields: readonly string[];
}>;

export type ProviderContractShape = Readonly<{
  providerId: string;
  protocol: ProviderContractProtocol;
  baseLocator: string;
  versionStrategy: ProviderContractVersionStrategy;
  versionValue: string;
  endpoints: readonly ProviderContractEndpoint[];
}>;

export type ProviderContractSnapshot = Readonly<{
  schemaVersion:
    typeof REFERENCE_PROVIDER_CONTRACT_SCHEMA_VERSION;
  contractId: string;
  referenceId: string;
  providerId: string;
  protocol: ProviderContractProtocol;
  baseLocator: string;
  versionStrategy: ProviderContractVersionStrategy;
  versionValue: string;
  endpoints: readonly ProviderContractEndpoint[];
  verifiedAt: string;
  evidence: readonly ReferenceEvidence[];
  contractDigest: string;
  recordHash: string;
  authority: ReferenceAuthority;
}>;

export type ReferenceArtifactKind =
  | 'MODEL_WEIGHTS'
  | 'BINARY'
  | 'WORKFLOW'
  | 'SCHEMA'
  | 'DATASET'
  | 'OTHER';

export type ReferenceArtifactPinStatus =
  | 'PINNED'
  | 'REQUIRED_UNRESOLVED'
  | 'NOT_APPLICABLE';

export type ReferenceArtifactPin = Readonly<{
  schemaVersion: typeof REFERENCE_ARTIFACT_PIN_SCHEMA_VERSION;
  pinId: string;
  referenceId: string;
  artifactId: string;
  artifactKind: ReferenceArtifactKind;
  status: ReferenceArtifactPinStatus;
  locator?: string;
  version?: string;
  sourceRevision?: string;
  digestAlgorithm: 'SHA256';
  digest?: string;
  byteLength?: number;
  verifiedAt?: string;
  evidence: readonly ReferenceEvidence[];
  notes?: string;
  pinHash: string;
  authority: ReferenceAuthority;
}>;

export type ReferenceRegistrySnapshot = Readonly<{
  schemaVersion: typeof REFERENCE_PROVENANCE_SCHEMA_VERSION;
  sourceVerificationSchemaVersion:
    typeof REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION;
  referenceIds: readonly string[];
  mappingIds: readonly string[];
  sourceVerificationIds: readonly string[];
  providerContractIds: readonly string[];
  artifactPinIds: readonly string[];
  generatedAt: string;
  registryHash: string;
  authority: ReferenceAuthority;
}>;

export type RegisterReferenceInput = Omit<
  ReferenceRecord,
  'schemaVersion' | 'authority' | 'recordHash'
>;

export type RegisterMappingInput = Omit<
  ReferenceImplementationMapping,
  'authority' | 'mappingHash'
>;

export type RegisterSourceVerificationInput = Omit<
  ReferenceSourceVerification,
  'schemaVersion' | 'authority' | 'verificationHash'
>;

export type RegisterProviderContractInput = Omit<
  ProviderContractSnapshot,
  'schemaVersion' | 'authority' | 'contractDigest' | 'recordHash'
>;

export type RegisterArtifactPinInput = Omit<
  ReferenceArtifactPin,
  'schemaVersion' | 'authority' | 'pinHash'
>;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function assertAbsoluteLocator(value: string): void {
  assertNonEmpty(value, 'REF_PROV_LOCATOR_REQUIRED');
  if (
    !value.startsWith('https://') &&
    !value.startsWith('urn:') &&
    !value.startsWith('repo:')
  ) {
    throw new Error('REF_PROV_LOCATOR_NOT_CANONICAL');
  }
}

function stableCanonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('REF_PROV_NONFINITE_NUMBER');
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
  throw new Error('REF_PROV_UNSUPPORTED_VALUE');
}

function hash(value: unknown): string {
  return createHash('sha256')
    .update(stableCanonicalize(value), 'utf8')
    .digest('hex');
}

function uniqueSorted<T extends string>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
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

function assertEvidence(
  evidence: readonly ReferenceEvidence[],
  codePrefix: string,
): void {
  const ids = new Set<string>();
  for (const item of evidence) {
    assertNonEmpty(
      item.evidenceId,
      `${codePrefix}_EVIDENCE_ID_REQUIRED`,
    );
    assertNonEmpty(
      item.locator,
      `${codePrefix}_EVIDENCE_LOCATOR_REQUIRED`,
    );
    if (ids.has(item.evidenceId)) {
      throw new Error(`${codePrefix}_EVIDENCE_ID_DUPLICATE`);
    }
    ids.add(item.evidenceId);
  }
}

function assertReferenceInput(input: RegisterReferenceInput): void {
  assertNonEmpty(input.referenceId, 'REF_PROV_REFERENCE_ID_REQUIRED');
  assertNonEmpty(
    input.canonicalName,
    'REF_PROV_CANONICAL_NAME_REQUIRED',
  );
  assertAbsoluteLocator(input.canonicalLocator);
  if (input.roles.length === 0) {
    throw new Error('REF_PROV_ROLE_REQUIRED');
  }
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_REFERENCE_EVIDENCE_REQUIRED');
  }
  assertEvidence(input.evidence, 'REF_PROV_REFERENCE');

  if (
    input.traceabilityStatus === 'REPO_TRACEABLE' &&
    !input.evidence.some(
      (item) =>
        item.kind === 'REPO_PATH' ||
        item.kind === 'COMMIT' ||
        item.kind === 'PULL_REQUEST',
    )
  ) {
    throw new Error('REF_PROV_REPO_TRACEABILITY_EVIDENCE_REQUIRED');
  }

  if (
    input.licenseStatus === 'VERIFIED' &&
    (!input.licenseExpression || !input.licenseEvidenceLocator)
  ) {
    throw new Error('REF_PROV_VERIFIED_LICENSE_EVIDENCE_REQUIRED');
  }

  if (
    input.licenseStatus !== 'VERIFIED' &&
    input.licenseEvidenceLocator
  ) {
    throw new Error('REF_PROV_UNVERIFIED_LICENSE_EVIDENCE_FORBIDDEN');
  }

  if (
    input.traceabilityStatus === 'SUPERSEDED' &&
    !input.supersededByReferenceId
  ) {
    throw new Error('REF_PROV_SUPERSESSION_TARGET_REQUIRED');
  }
}

function assertMappingInput(
  input: RegisterMappingInput,
  reference: ReferenceRecord,
  sourceVerification?: ReferenceSourceVerification,
): void {
  assertNonEmpty(input.mappingId, 'REF_PROV_MAPPING_ID_REQUIRED');
  assertNonEmpty(input.referenceId, 'REF_PROV_MAPPING_REFERENCE_REQUIRED');
  assertNonEmpty(input.subsystem, 'REF_PROV_MAPPING_SUBSYSTEM_REQUIRED');
  assertNonEmpty(
    input.adaptationNotes,
    'REF_PROV_MAPPING_ADAPTATION_NOTES_REQUIRED',
  );
  if (input.targetPaths.length === 0) {
    throw new Error('REF_PROV_MAPPING_TARGET_REQUIRED');
  }
  if (input.borrowedArtifactKinds.length === 0) {
    throw new Error('REF_PROV_BORROWED_ARTIFACT_KIND_REQUIRED');
  }
  if (input.borrowedConcepts.length === 0) {
    throw new Error('REF_PROV_BORROWED_CONCEPT_REQUIRED');
  }
  if (input.implementationEvidence.length === 0) {
    throw new Error('REF_PROV_MAPPING_EVIDENCE_REQUIRED');
  }
  assertEvidence(
    input.implementationEvidence,
    'REF_PROV_MAPPING',
  );

  if (
    input.adoptionStatus === 'IMPLEMENTED' &&
    ![
      'REPO_TRACEABLE',
      'EXTERNALLY_VERIFIED',
    ].includes(reference.traceabilityStatus)
  ) {
    throw new Error(
      'REF_PROV_IMPLEMENTED_REFERENCE_NOT_VERIFIED',
    );
  }

  if (
    input.adoptionStatus === 'IMPLEMENTED' &&
    !input.implementationEvidence.some(
      (item) =>
        item.kind === 'REPO_PATH' ||
        item.kind === 'COMMIT' ||
        item.kind === 'PULL_REQUEST',
    )
  ) {
    throw new Error(
      'REF_PROV_IMPLEMENTATION_REPO_EVIDENCE_REQUIRED',
    );
  }

  if (input.borrowedArtifactKinds.includes('CODE')) {
    if (sourceVerification) {
      if (sourceVerification.licenseFinding !== 'VERIFIED') {
        throw new Error(
          'REF_PROV_CODE_DERIVATION_LICENSE_NOT_VERIFIED',
        );
      }
      if (
        sourceVerification.licenseReusePolicy !== 'PERMISSIVE'
      ) {
        throw new Error(
          'REF_PROV_CODE_DERIVATION_REUSE_REVIEW_REQUIRED',
        );
      }
    } else if (reference.licenseStatus !== 'VERIFIED') {
      throw new Error(
        'REF_PROV_CODE_DERIVATION_LICENSE_NOT_VERIFIED',
      );
    }
  }
}

function assertSourceVerificationInput(
  input: RegisterSourceVerificationInput,
  reference: ReferenceRecord,
): void {
  if (input.referenceId !== reference.referenceId) {
    throw new Error('REF_PROV_SOURCE_REFERENCE_MISMATCH');
  }
  assertNonEmpty(
    input.verificationId,
    'REF_PROV_SOURCE_VERIFICATION_ID_REQUIRED',
  );
  assertAbsoluteLocator(input.canonicalSourceLocator);
  if (Number.isNaN(Date.parse(input.verifiedAt))) {
    throw new Error('REF_PROV_SOURCE_VERIFIED_AT_INVALID');
  }
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_SOURCE_EVIDENCE_REQUIRED');
  }
  assertEvidence(input.evidence, 'REF_PROV_SOURCE');

  if (input.sourceVerificationStatus === 'PINNED') {
    assertNonEmpty(
      input.sourceRevision ?? '',
      'REF_PROV_SOURCE_REVISION_REQUIRED',
    );
    assertNonEmpty(
      input.sourceDigest ?? '',
      'REF_PROV_SOURCE_DIGEST_REQUIRED',
    );
    if (
      !input.evidence.some((item) => item.kind === 'COMMIT')
    ) {
      throw new Error('REF_PROV_SOURCE_COMMIT_EVIDENCE_REQUIRED');
    }
  }

  if (
    input.sourceDigest !== undefined &&
    !/^git-commit-sha1:[0-9a-f]{40}$/.test(input.sourceDigest)
  ) {
    throw new Error('REF_PROV_SOURCE_DIGEST_INVALID');
  }

  if (input.licenseFinding === 'VERIFIED') {
    assertNonEmpty(
      input.licenseExpression ?? '',
      'REF_PROV_SOURCE_LICENSE_EXPRESSION_REQUIRED',
    );
    assertNonEmpty(
      input.licenseEvidenceLocator ?? '',
      'REF_PROV_SOURCE_LICENSE_EVIDENCE_REQUIRED',
    );
    if (
      input.licenseReusePolicy === 'NO_LICENSE' ||
      input.licenseReusePolicy === 'NOT_APPLICABLE'
    ) {
      throw new Error('REF_PROV_SOURCE_LICENSE_POLICY_INVALID');
    }
  } else if (input.licenseEvidenceLocator !== undefined) {
    throw new Error(
      'REF_PROV_SOURCE_UNVERIFIED_LICENSE_EVIDENCE_FORBIDDEN',
    );
  }

  if (
    input.licenseFinding === 'NO_LICENSE_FILE' &&
    input.licenseReusePolicy !== 'NO_LICENSE'
  ) {
    throw new Error('REF_PROV_SOURCE_NO_LICENSE_POLICY_REQUIRED');
  }

  if (
    input.licenseFinding === 'NOT_APPLICABLE' &&
    input.licenseReusePolicy !== 'NOT_APPLICABLE'
  ) {
    throw new Error('REF_PROV_SOURCE_NA_LICENSE_POLICY_REQUIRED');
  }
}

export function buildReferenceSourceVerification(
  input: RegisterSourceVerificationInput,
  reference: ReferenceRecord,
): ReferenceSourceVerification {
  assertSourceVerificationInput(input, reference);
  const withoutHash = {
    schemaVersion: REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION,
    verificationId: input.verificationId,
    referenceId: input.referenceId,
    canonicalSourceLocator: input.canonicalSourceLocator,
    sourceVerificationStatus: input.sourceVerificationStatus,
    sourceRevision: input.sourceRevision,
    sourceDigest: input.sourceDigest,
    verifiedAt: input.verifiedAt,
    licenseFinding: input.licenseFinding,
    licenseExpression: input.licenseExpression,
    licenseEvidenceLocator: input.licenseEvidenceLocator,
    licenseReusePolicy: input.licenseReusePolicy,
    evidence: freezeEvidence(input.evidence),
    notes: input.notes,
    authority: NO_REFERENCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    verificationHash: hash(withoutHash),
  });
}

function normalizeStringArray(
  values: readonly string[],
): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

function normalizeContractEndpoints(
  endpoints: readonly ProviderContractEndpoint[],
): readonly ProviderContractEndpoint[] {
  const operationIds = new Set<string>();
  const normalized = endpoints.map((endpoint) => {
    assertNonEmpty(
      endpoint.operationId,
      'REF_PROV_CONTRACT_OPERATION_ID_REQUIRED',
    );
    if (operationIds.has(endpoint.operationId)) {
      throw new Error(
        'REF_PROV_CONTRACT_OPERATION_ID_DUPLICATE',
      );
    }
    operationIds.add(endpoint.operationId);
    if (!endpoint.pathTemplate.startsWith('/')) {
      throw new Error('REF_PROV_CONTRACT_PATH_INVALID');
    }
    return Object.freeze({
      operationId: endpoint.operationId,
      method: endpoint.method,
      pathTemplate: endpoint.pathTemplate,
      requiredRequestHeaders: normalizeStringArray(
        endpoint.requiredRequestHeaders,
      ),
      requiredRequestFields: normalizeStringArray(
        endpoint.requiredRequestFields,
      ),
      requiredResponseFields: normalizeStringArray(
        endpoint.requiredResponseFields,
      ),
    });
  });
  return Object.freeze(
    normalized.sort((a, b) =>
      a.operationId.localeCompare(b.operationId),
    ),
  );
}

export function providerContractShapeDigest(
  shape: ProviderContractShape,
): string {
  const normalized = {
    providerId: shape.providerId,
    protocol: shape.protocol,
    baseLocator: shape.baseLocator.replace(/\/$/, ''),
    versionStrategy: shape.versionStrategy,
    versionValue: shape.versionValue,
    endpoints: normalizeContractEndpoints(shape.endpoints),
  };
  return `sha256:${hash(normalized)}`;
}

export function buildProviderContractSnapshot(
  input: RegisterProviderContractInput,
): ProviderContractSnapshot {
  assertNonEmpty(input.contractId, 'REF_PROV_CONTRACT_ID_REQUIRED');
  assertNonEmpty(
    input.referenceId,
    'REF_PROV_CONTRACT_REFERENCE_REQUIRED',
  );
  assertNonEmpty(
    input.providerId,
    'REF_PROV_CONTRACT_PROVIDER_REQUIRED',
  );
  assertAbsoluteLocator(input.baseLocator);
  assertNonEmpty(
    input.versionValue,
    'REF_PROV_CONTRACT_VERSION_REQUIRED',
  );
  if (Number.isNaN(Date.parse(input.verifiedAt))) {
    throw new Error('REF_PROV_CONTRACT_VERIFIED_AT_INVALID');
  }
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_CONTRACT_EVIDENCE_REQUIRED');
  }
  assertEvidence(input.evidence, 'REF_PROV_CONTRACT');
  if (input.endpoints.length === 0) {
    throw new Error('REF_PROV_CONTRACT_ENDPOINT_REQUIRED');
  }

  const endpoints = normalizeContractEndpoints(input.endpoints);
  const shape: ProviderContractShape = {
    providerId: input.providerId,
    protocol: input.protocol,
    baseLocator: input.baseLocator.replace(/\/$/, ''),
    versionStrategy: input.versionStrategy,
    versionValue: input.versionValue,
    endpoints,
  };
  const contractDigest = providerContractShapeDigest(shape);
  const withoutHash = {
    schemaVersion: REFERENCE_PROVIDER_CONTRACT_SCHEMA_VERSION,
    contractId: input.contractId,
    referenceId: input.referenceId,
    ...shape,
    verifiedAt: input.verifiedAt,
    evidence: freezeEvidence(input.evidence),
    contractDigest,
    authority: NO_REFERENCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    recordHash: hash(withoutHash),
  });
}

export function assertProviderContractCompatible(
  expected: ProviderContractSnapshot,
  runtime: ProviderContractShape,
): void {
  const actualDigest = providerContractShapeDigest(runtime);
  if (actualDigest !== expected.contractDigest) {
    throw new Error(
      `REF_PROV_PROVIDER_CONTRACT_DRIFT:${expected.providerId}`,
    );
  }
}

export function buildReferenceArtifactPin(
  input: RegisterArtifactPinInput,
): ReferenceArtifactPin {
  assertNonEmpty(input.pinId, 'REF_PROV_ARTIFACT_PIN_ID_REQUIRED');
  assertNonEmpty(
    input.referenceId,
    'REF_PROV_ARTIFACT_REFERENCE_REQUIRED',
  );
  assertNonEmpty(
    input.artifactId,
    'REF_PROV_ARTIFACT_ID_REQUIRED',
  );
  if (input.evidence.length === 0) {
    throw new Error('REF_PROV_ARTIFACT_EVIDENCE_REQUIRED');
  }
  assertEvidence(input.evidence, 'REF_PROV_ARTIFACT');

  if (input.status === 'PINNED') {
    assertAbsoluteLocator(input.locator ?? '');
    if (!/^sha256:[0-9a-f]{64}$/.test(input.digest ?? '')) {
      throw new Error('REF_PROV_ARTIFACT_DIGEST_REQUIRED');
    }
    if (
      input.byteLength !== undefined &&
      (!Number.isInteger(input.byteLength) ||
        input.byteLength < 0)
    ) {
      throw new Error('REF_PROV_ARTIFACT_LENGTH_INVALID');
    }
    if (!input.verifiedAt || Number.isNaN(Date.parse(input.verifiedAt))) {
      throw new Error('REF_PROV_ARTIFACT_VERIFIED_AT_REQUIRED');
    }
  } else if (
    input.digest !== undefined ||
    input.byteLength !== undefined ||
    input.verifiedAt !== undefined
  ) {
    throw new Error(
      'REF_PROV_UNRESOLVED_ARTIFACT_CANNOT_CLAIM_DIGEST',
    );
  }

  const withoutHash = {
    schemaVersion: REFERENCE_ARTIFACT_PIN_SCHEMA_VERSION,
    pinId: input.pinId,
    referenceId: input.referenceId,
    artifactId: input.artifactId,
    artifactKind: input.artifactKind,
    status: input.status,
    locator: input.locator,
    version: input.version,
    sourceRevision: input.sourceRevision,
    digestAlgorithm: 'SHA256' as const,
    digest: input.digest,
    byteLength: input.byteLength,
    verifiedAt: input.verifiedAt,
    evidence: freezeEvidence(input.evidence),
    notes: input.notes,
    authority: NO_REFERENCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    pinHash: hash(withoutHash),
  });
}

export function verifyArtifactBytes(
  pin: ReferenceArtifactPin,
  bytes: Uint8Array,
): void {
  if (pin.status !== 'PINNED' || !pin.digest) {
    throw new Error('REF_PROV_ARTIFACT_NOT_PINNED');
  }
  const actual = `sha256:${createHash('sha256')
    .update(bytes)
    .digest('hex')}`;
  if (actual !== pin.digest) {
    throw new Error(
      `REF_PROV_ARTIFACT_DIGEST_MISMATCH:${pin.artifactId}`,
    );
  }
  if (
    pin.byteLength !== undefined &&
    bytes.byteLength !== pin.byteLength
  ) {
    throw new Error(
      `REF_PROV_ARTIFACT_LENGTH_MISMATCH:${pin.artifactId}`,
    );
  }
}

export function buildReferenceRecord(
  input: RegisterReferenceInput,
): ReferenceRecord {
  assertReferenceInput(input);

  const withoutHash = {
    schemaVersion: REFERENCE_PROVENANCE_SCHEMA_VERSION,
    referenceId: input.referenceId,
    canonicalName: input.canonicalName,
    kind: input.kind,
    roles: uniqueSorted(input.roles),
    canonicalLocator: input.canonicalLocator,
    sourceRevision: input.sourceRevision,
    discoveredFrom: input.discoveredFrom,
    traceabilityStatus: input.traceabilityStatus,
    licenseStatus: input.licenseStatus,
    licenseExpression: input.licenseExpression,
    licenseEvidenceLocator: input.licenseEvidenceLocator,
    notes: input.notes,
    evidence: freezeEvidence(input.evidence),
    supersededByReferenceId: input.supersededByReferenceId,
    authority: NO_REFERENCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    recordHash: hash(withoutHash),
  });
}

export function buildReferenceMapping(
  input: RegisterMappingInput,
  reference: ReferenceRecord,
  sourceVerification?: ReferenceSourceVerification,
): ReferenceImplementationMapping {
  if (input.referenceId !== reference.referenceId) {
    throw new Error('REF_PROV_MAPPING_REFERENCE_MISMATCH');
  }
  assertMappingInput(input, reference, sourceVerification);

  const withoutHash = {
    mappingId: input.mappingId,
    referenceId: input.referenceId,
    subsystem: input.subsystem,
    targetPaths: uniqueSorted(input.targetPaths),
    borrowedArtifactKinds: uniqueSorted(
      input.borrowedArtifactKinds,
    ),
    borrowedConcepts: uniqueSorted(input.borrowedConcepts),
    adaptationNotes: input.adaptationNotes,
    adoptionStatus: input.adoptionStatus,
    implementationEvidence: freezeEvidence(
      input.implementationEvidence,
    ),
    sourceRevision: input.sourceRevision,
    authority: NO_REFERENCE_AUTHORITY,
  } as const;

  return Object.freeze({
    ...withoutHash,
    mappingHash: hash(withoutHash),
  });
}

export class ReferenceProvenanceRegistry {
  private readonly references = new Map<string, ReferenceRecord>();
  private readonly mappings = new Map<
    string,
    ReferenceImplementationMapping
  >();
  private readonly sourceVerifications = new Map<
    string,
    ReferenceSourceVerification
  >();
  private readonly providerContracts = new Map<
    string,
    ProviderContractSnapshot
  >();
  private readonly artifactPins = new Map<
    string,
    ReferenceArtifactPin
  >();

  registerReference(input: RegisterReferenceInput): ReferenceRecord {
    if (this.references.has(input.referenceId)) {
      throw new Error('REF_PROV_REFERENCE_ALREADY_REGISTERED');
    }
    const record = buildReferenceRecord(input);
    this.references.set(record.referenceId, record);
    return record;
  }

  registerSourceVerification(
    input: RegisterSourceVerificationInput,
  ): ReferenceSourceVerification {
    if (this.sourceVerifications.has(input.verificationId)) {
      throw new Error(
        'REF_PROV_SOURCE_VERIFICATION_ALREADY_REGISTERED',
      );
    }
    const reference = this.references.get(input.referenceId);
    if (!reference) {
      throw new Error('REF_PROV_REFERENCE_NOT_REGISTERED');
    }
    const verification = buildReferenceSourceVerification(
      input,
      reference,
    );
    this.sourceVerifications.set(
      verification.verificationId,
      verification,
    );
    return verification;
  }

  registerProviderContract(
    input: RegisterProviderContractInput,
  ): ProviderContractSnapshot {
    if (this.providerContracts.has(input.contractId)) {
      throw new Error(
        'REF_PROV_PROVIDER_CONTRACT_ALREADY_REGISTERED',
      );
    }
    if (!this.references.has(input.referenceId)) {
      throw new Error('REF_PROV_REFERENCE_NOT_REGISTERED');
    }
    const contract = buildProviderContractSnapshot(input);
    this.providerContracts.set(contract.contractId, contract);
    return contract;
  }

  registerArtifactPin(
    input: RegisterArtifactPinInput,
  ): ReferenceArtifactPin {
    if (this.artifactPins.has(input.pinId)) {
      throw new Error('REF_PROV_ARTIFACT_PIN_ALREADY_REGISTERED');
    }
    if (!this.references.has(input.referenceId)) {
      throw new Error('REF_PROV_REFERENCE_NOT_REGISTERED');
    }
    const pin = buildReferenceArtifactPin(input);
    this.artifactPins.set(pin.pinId, pin);
    return pin;
  }

  registerMapping(
    input: RegisterMappingInput,
  ): ReferenceImplementationMapping {
    if (this.mappings.has(input.mappingId)) {
      throw new Error('REF_PROV_MAPPING_ALREADY_REGISTERED');
    }
    const reference = this.references.get(input.referenceId);
    if (!reference) {
      throw new Error('REF_PROV_REFERENCE_NOT_REGISTERED');
    }
    const mapping = buildReferenceMapping(
      input,
      reference,
      this.latestSourceVerification(input.referenceId),
    );
    this.mappings.set(mapping.mappingId, mapping);
    return mapping;
  }

  getReference(referenceId: string): ReferenceRecord | undefined {
    return this.references.get(referenceId);
  }

  getMapping(
    mappingId: string,
  ): ReferenceImplementationMapping | undefined {
    return this.mappings.get(mappingId);
  }

  getProviderContract(
    contractId: string,
  ): ProviderContractSnapshot | undefined {
    return this.providerContracts.get(contractId);
  }

  getArtifactPin(
    pinId: string,
  ): ReferenceArtifactPin | undefined {
    return this.artifactPins.get(pinId);
  }

  getSourceVerificationById(
    verificationId: string,
  ): ReferenceSourceVerification | undefined {
    return this.sourceVerifications.get(verificationId);
  }

  sourceVerificationsForReference(
    referenceId: string,
  ): readonly ReferenceSourceVerification[] {
    return Object.freeze(
      this.listSourceVerifications().filter(
        (verification) =>
          verification.referenceId === referenceId,
      ),
    );
  }

  latestSourceVerification(
    referenceId: string,
  ): ReferenceSourceVerification | undefined {
    return this.sourceVerificationsForReference(referenceId)
      .slice()
      .sort(
        (a, b) =>
          Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt) ||
          b.verificationId.localeCompare(a.verificationId),
      )[0];
  }

  listReferences(): readonly ReferenceRecord[] {
    return Object.freeze(
      [...this.references.values()].sort((a, b) =>
        a.referenceId.localeCompare(b.referenceId),
      ),
    );
  }

  listMappings(): readonly ReferenceImplementationMapping[] {
    return Object.freeze(
      [...this.mappings.values()].sort((a, b) =>
        a.mappingId.localeCompare(b.mappingId),
      ),
    );
  }

  listSourceVerifications():
    readonly ReferenceSourceVerification[] {
    return Object.freeze(
      [...this.sourceVerifications.values()].sort((a, b) =>
        a.verificationId.localeCompare(b.verificationId),
      ),
    );
  }

  listProviderContracts():
    readonly ProviderContractSnapshot[] {
    return Object.freeze(
      [...this.providerContracts.values()].sort((a, b) =>
        a.contractId.localeCompare(b.contractId),
      ),
    );
  }

  listArtifactPins(): readonly ReferenceArtifactPin[] {
    return Object.freeze(
      [...this.artifactPins.values()].sort((a, b) =>
        a.pinId.localeCompare(b.pinId),
      ),
    );
  }

  mappingsForReference(
    referenceId: string,
  ): readonly ReferenceImplementationMapping[] {
    return Object.freeze(
      this.listMappings().filter(
        (mapping) => mapping.referenceId === referenceId,
      ),
    );
  }

  unresolvedReferences(): readonly ReferenceRecord[] {
    return Object.freeze(
      this.listReferences().filter((record) =>
        ['HANDOFF_ONLY', 'UNVERIFIED'].includes(
          record.traceabilityStatus,
        ),
      ),
    );
  }

  assertIntegrity(): void {
    for (const reference of this.references.values()) {
      if (
        reference.supersededByReferenceId &&
        !this.references.has(reference.supersededByReferenceId)
      ) {
        throw new Error(
          'REF_PROV_SUPERSESSION_REFERENCE_NOT_REGISTERED',
        );
      }
    }

    for (const verification of this.sourceVerifications.values()) {
      const reference = this.references.get(
        verification.referenceId,
      );
      if (!reference) {
        throw new Error('REF_PROV_SOURCE_VERIFICATION_ORPHANED');
      }
      assertSourceVerificationInput(verification, reference);
    }

    for (const contract of this.providerContracts.values()) {
      if (!this.references.has(contract.referenceId)) {
        throw new Error('REF_PROV_PROVIDER_CONTRACT_ORPHANED');
      }
      buildProviderContractSnapshot(contract);
    }

    for (const pin of this.artifactPins.values()) {
      if (!this.references.has(pin.referenceId)) {
        throw new Error('REF_PROV_ARTIFACT_PIN_ORPHANED');
      }
      buildReferenceArtifactPin(pin);
    }

    for (const mapping of this.mappings.values()) {
      const reference = this.references.get(mapping.referenceId);
      if (!reference) {
        throw new Error('REF_PROV_MAPPING_ORPHANED');
      }
      assertMappingInput(
        mapping,
        reference,
        this.latestSourceVerification(mapping.referenceId),
      );
    }

    for (const start of this.references.values()) {
      const visited = new Set<string>();
      let current: ReferenceRecord | undefined = start;
      while (current?.supersededByReferenceId) {
        if (visited.has(current.referenceId)) {
          throw new Error('REF_PROV_SUPERSESSION_CYCLE');
        }
        visited.add(current.referenceId);
        current = this.references.get(
          current.supersededByReferenceId,
        );
      }
    }
  }

  snapshot(generatedAt: string): ReferenceRegistrySnapshot {
    if (Number.isNaN(Date.parse(generatedAt))) {
      throw new Error('REF_PROV_SNAPSHOT_TIME_INVALID');
    }
    this.assertIntegrity();
    const referenceIds = this.listReferences().map(
      (record) => record.referenceId,
    );
    const mappingIds = this.listMappings().map(
      (mapping) => mapping.mappingId,
    );
    const sourceVerificationIds =
      this.listSourceVerifications().map(
        (verification) => verification.verificationId,
      );
    const providerContractIds = this.listProviderContracts().map(
      (contract) => contract.contractId,
    );
    const artifactPinIds = this.listArtifactPins().map(
      (pin) => pin.pinId,
    );
    const registryHash = hash({
      schemaVersion: REFERENCE_PROVENANCE_SCHEMA_VERSION,
      sourceVerificationSchemaVersion:
        REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION,
      referenceHashes: this.listReferences().map(
        (record) => record.recordHash,
      ),
      mappingHashes: this.listMappings().map(
        (mapping) => mapping.mappingHash,
      ),
      sourceVerificationHashes:
        this.listSourceVerifications().map(
          (verification) => verification.verificationHash,
        ),
      providerContractHashes: this.listProviderContracts().map(
        (contract) => contract.recordHash,
      ),
      artifactPinHashes: this.listArtifactPins().map(
        (pin) => pin.pinHash,
      ),
    });

    return Object.freeze({
      schemaVersion: REFERENCE_PROVENANCE_SCHEMA_VERSION,
      sourceVerificationSchemaVersion:
        REFERENCE_SOURCE_VERIFICATION_SCHEMA_VERSION,
      referenceIds: Object.freeze(referenceIds),
      mappingIds: Object.freeze(mappingIds),
      sourceVerificationIds: Object.freeze(sourceVerificationIds),
      providerContractIds: Object.freeze(providerContractIds),
      artifactPinIds: Object.freeze(artifactPinIds),
      generatedAt,
      registryHash,
      authority: NO_REFERENCE_AUTHORITY,
    });
  }
}

export { createInitialReferenceProvenanceRegistry, INITIAL_REFERENCE_IDS } from './seed-registry.js';

export type {
  ReferenceCoverageStatus,
  ReferenceSubsystemHint,
  SubsystemReferenceCoverage,
  ReferenceCoverageReport,
} from './coverage.js';
export {
  REFERENCE_COVERAGE_SCHEMA_VERSION,
  DEFAULT_REFERENCE_SUBSYSTEM_HINTS,
  buildReferenceCoverageReport,
} from './coverage.js';

export type {
  ReferenceSourceVerificationReport,
} from './source-verification-report.js';
export {
  SOURCE_VERIFICATION_REPORT_SCHEMA_VERSION,
  buildReferenceSourceVerificationReport,
} from './source-verification-report.js';

export type {
  ProviderArtifactCoverageReport,
} from './provider-artifact-report.js';
export {
  PROVIDER_ARTIFACT_REPORT_SCHEMA_VERSION,
  buildProviderArtifactCoverageReport,
  unresolvedArtifactPins,
} from './provider-artifact-report.js';

export type {
  ArtifactRuntimeDescriptor,
  ArtifactCompatibilityManifestInput,
  ArtifactCompatibilityManifest,
  ArtifactLicenseReviewReceipt,
  ArtifactAdmissionRequest,
  ArtifactAdmissionLicenseBasis,
  ArtifactAdmissionReceipt,
  RuntimeArtifactAttestationRequest,
  RuntimeArtifactAttestation,
} from './artifact-admission.js';
export {
  ARTIFACT_ADMISSION_SCHEMA_VERSION,
  buildArtifactCompatibilityManifest,
  ArtifactAdmissionGate,
} from './artifact-admission.js';

export type {
  ArtifactAdmissionReadinessStatus,
  ArtifactAdmissionReadinessRow,
  ArtifactAdmissionReadinessReport,
} from './artifact-admission-readiness.js';
export {
  ARTIFACT_ADMISSION_READINESS_SCHEMA_VERSION,
  buildArtifactAdmissionReadinessReport,
} from './artifact-admission-readiness.js';

export type {
  ArtifactAdmissionLedger,
  ArtifactDeploymentRequirement,
  ArtifactDeploymentReceipt,
} from './artifact-deployment.js';
export {
  ARTIFACT_DEPLOYMENT_SCHEMA_VERSION,
  enforceArtifactDeployment,
  InMemoryArtifactAdmissionLedger,
} from './artifact-deployment.js';

export type {
  ArtifactLedgerSqlResult,
  ArtifactLedgerSqlClient,
  PostgresArtifactAdmissionLedgerOptions,
} from './postgres-artifact-admission-ledger.js';
export {
  PostgresArtifactAdmissionLedger,
} from './postgres-artifact-admission-ledger.js';

export type {
  ArtifactRevocationTarget,
  ArtifactRevocationReceipt,
  DeploymentSessionState,
  DeploymentSession,
  DeploymentSessionEvent,
  DeploymentSessionLedger,
} from './deployment-session.js';
export {
  ARTIFACT_DEPLOYMENT_SESSION_SCHEMA_VERSION,
  createArtifactRevocation,
  startDeploymentSession,
  heartbeatDeploymentSession,
  assertDeploymentSessionUsable,
  InMemoryDeploymentSessionLedger,
} from './deployment-session.js';

export type {
  RevocationDistributionSnapshot,
  RevocationDistributionSource,
  RuntimeLeaseGuardOptions,
} from './runtime-lease.js';
export {
  RUNTIME_LEASE_SCHEMA_VERSION,
  createRevocationDistributionSnapshot,
  verifyRevocationDistributionSnapshot,
  RuntimeLeaseGuard,
  InMemoryRevocationDistributionSource,
  HttpRevocationDistributionSource,
} from './runtime-lease.js';
export type {
  RevocationSnapshotFetch,
} from './runtime-lease.js';
export {
  PostgresDeploymentSessionLedger,
} from './postgres-deployment-session-ledger.js';

import { createHash } from 'node:crypto';

export const REFERENCE_PROVENANCE_SCHEMA_VERSION =
  'REF-PROV-01' as const;

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

export type ReferenceRegistrySnapshot = Readonly<{
  schemaVersion: typeof REFERENCE_PROVENANCE_SCHEMA_VERSION;
  referenceIds: readonly string[];
  mappingIds: readonly string[];
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

  if (
    input.borrowedArtifactKinds.includes('CODE') &&
    reference.licenseStatus !== 'VERIFIED'
  ) {
    throw new Error('REF_PROV_CODE_DERIVATION_LICENSE_NOT_VERIFIED');
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
): ReferenceImplementationMapping {
  if (input.referenceId !== reference.referenceId) {
    throw new Error('REF_PROV_MAPPING_REFERENCE_MISMATCH');
  }
  assertMappingInput(input, reference);

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

  registerReference(input: RegisterReferenceInput): ReferenceRecord {
    if (this.references.has(input.referenceId)) {
      throw new Error('REF_PROV_REFERENCE_ALREADY_REGISTERED');
    }
    const record = buildReferenceRecord(input);
    this.references.set(record.referenceId, record);
    return record;
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
    const mapping = buildReferenceMapping(input, reference);
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

    for (const mapping of this.mappings.values()) {
      const reference = this.references.get(mapping.referenceId);
      if (!reference) {
        throw new Error('REF_PROV_MAPPING_ORPHANED');
      }
      assertMappingInput(mapping, reference);
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
    const registryHash = hash({
      schemaVersion: REFERENCE_PROVENANCE_SCHEMA_VERSION,
      referenceHashes: this.listReferences().map(
        (record) => record.recordHash,
      ),
      mappingHashes: this.listMappings().map(
        (mapping) => mapping.mappingHash,
      ),
    });

    return Object.freeze({
      schemaVersion: REFERENCE_PROVENANCE_SCHEMA_VERSION,
      referenceIds: Object.freeze(referenceIds),
      mappingIds: Object.freeze(mappingIds),
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

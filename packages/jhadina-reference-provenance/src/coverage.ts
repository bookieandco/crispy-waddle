import type {
  ReferenceImplementationMapping,
  ReferenceProvenanceRegistry,
  ReferenceRecord,
} from './index.js';

export const REFERENCE_COVERAGE_SCHEMA_VERSION =
  'REF-PROV-02' as const;

export type ReferenceCoverageStatus =
  | 'TRACEABLE'
  | 'PARTIAL'
  | 'DISCOVERY_REQUIRED';

export type ReferenceSubsystemHint = Readonly<{
  referenceId: string;
  subsystem: string;
  rationale: string;
}>;

export type SubsystemReferenceCoverage = Readonly<{
  subsystem: string;
  assignedReferenceIds: readonly string[];
  implementedMappingIds: readonly string[];
  nonImplementedMappingIds: readonly string[];
  unresolvedReferenceIds: readonly string[];
  unknownLicenseReferenceIds: readonly string[];
  traceableReferenceCount: number;
  assignedReferenceCount: number;
  coverageRatio: number;
  status: ReferenceCoverageStatus;
}>;

export type ReferenceCoverageReport = Readonly<{
  schemaVersion: typeof REFERENCE_COVERAGE_SCHEMA_VERSION;
  subsystemCoverage: readonly SubsystemReferenceCoverage[];
  unassignedReferenceIds: readonly string[];
  unresolvedReferenceIds: readonly string[];
  totalReferences: number;
  totalMappings: number;
}>;

export const DEFAULT_REFERENCE_SUBSYSTEM_HINTS:
  readonly ReferenceSubsystemHint[] = Object.freeze([
    {
      referenceId: 'github:maariia-saez/MDP-Adaptive-GA',
      subsystem: 'Sports',
      rationale: 'Sports handoff algorithm reference.',
    },
    {
      referenceId: 'github:yinzhangyue/SelfAware',
      subsystem: 'Sports',
      rationale: 'Sports handoff self-awareness architecture reference.',
    },
    {
      referenceId: 'github:RC-Dynamics/Coach-RL',
      subsystem: 'Sports',
      rationale: 'Sports handoff reinforcement-learning reference.',
    },
    {
      referenceId:
        'github:Verified-Intelligence/alpha-beta-CROWN',
      subsystem: 'Sports',
      rationale: 'Sports handoff formal verification reference.',
    },
    {
      referenceId: 'github:pump-fun/pump-public-docs',
      subsystem: 'SHARK',
      rationale: 'SHARK handoff Pump bonding/migration reference.',
    },
    {
      referenceId: 'github:keidev-sol/Meteora-Rug-Bot',
      subsystem: 'SHARK',
      rationale: 'SHARK handoff adversarial liquidity reference.',
    },
    {
      referenceId:
        'github:baronguyen001/wallet-cluster-detector',
      subsystem: 'SHARK',
      rationale: 'SHARK handoff wallet clustering reference.',
    },
    {
      referenceId: 'github:assafelovic/gpt-researcher',
      subsystem: 'Knowledge',
      rationale: 'Knowledge handoff research-agent reference.',
    },
    {
      referenceId: 'github:dzhng/deep-research',
      subsystem: 'Knowledge',
      rationale: 'Knowledge handoff deep-research reference.',
    },
    {
      referenceId: 'github:XecureLogic/policy-gate',
      subsystem: 'Knowledge',
      rationale: 'Knowledge handoff policy-gate reference.',
    },
  ]);

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

function unresolved(reference: ReferenceRecord): boolean {
  return (
    reference.traceabilityStatus === 'HANDOFF_ONLY' ||
    reference.traceabilityStatus === 'UNVERIFIED'
  );
}

function traceable(reference: ReferenceRecord): boolean {
  return (
    reference.traceabilityStatus === 'REPO_TRACEABLE' ||
    reference.traceabilityStatus === 'EXTERNALLY_VERIFIED'
  );
}

function mappingsBySubsystem(
  mappings: readonly ReferenceImplementationMapping[],
): Map<string, readonly ReferenceImplementationMapping[]> {
  const grouped = new Map<string, ReferenceImplementationMapping[]>();
  for (const mapping of mappings) {
    const current = grouped.get(mapping.subsystem) ?? [];
    current.push(mapping);
    grouped.set(mapping.subsystem, current);
  }
  return new Map(
    [...grouped.entries()].map(([subsystem, values]) => [
      subsystem,
      Object.freeze(
        values.sort((a, b) =>
          a.mappingId.localeCompare(b.mappingId),
        ),
      ),
    ]),
  );
}

function hintsBySubsystem(
  hints: readonly ReferenceSubsystemHint[],
): Map<string, readonly ReferenceSubsystemHint[]> {
  const grouped = new Map<string, ReferenceSubsystemHint[]>();
  for (const hint of hints) {
    const current = grouped.get(hint.subsystem) ?? [];
    current.push(hint);
    grouped.set(hint.subsystem, current);
  }
  return new Map(
    [...grouped.entries()].map(([subsystem, values]) => [
      subsystem,
      Object.freeze(
        values.sort((a, b) =>
          a.referenceId.localeCompare(b.referenceId),
        ),
      ),
    ]),
  );
}

export function buildReferenceCoverageReport(
  registry: ReferenceProvenanceRegistry,
  hints: readonly ReferenceSubsystemHint[] =
    DEFAULT_REFERENCE_SUBSYSTEM_HINTS,
): ReferenceCoverageReport {
  registry.assertIntegrity();
  const references = registry.listReferences();
  const mappings = registry.listMappings();
  const referenceById = new Map(
    references.map((reference) => [
      reference.referenceId,
      reference,
    ]),
  );

  for (const hint of hints) {
    if (!referenceById.has(hint.referenceId)) {
      throw new Error('REF_PROV_COVERAGE_HINT_UNKNOWN_REFERENCE');
    }
    if (!hint.subsystem.trim() || !hint.rationale.trim()) {
      throw new Error('REF_PROV_COVERAGE_HINT_INVALID');
    }
  }

  const mappingGroups = mappingsBySubsystem(mappings);
  const hintGroups = hintsBySubsystem(hints);
  const subsystemNames = uniqueSorted([
    ...mappingGroups.keys(),
    ...hintGroups.keys(),
  ]);

  const assigned = new Set<string>();
  const subsystemCoverage =
    subsystemNames.map<SubsystemReferenceCoverage>(
      (subsystem) => {
        const subsystemMappings =
          mappingGroups.get(subsystem) ?? [];
        const subsystemHints = hintGroups.get(subsystem) ?? [];
        const assignedReferenceIds = uniqueSorted([
          ...subsystemMappings.map(
            (mapping) => mapping.referenceId,
          ),
          ...subsystemHints.map((hint) => hint.referenceId),
        ]);

        for (const referenceId of assignedReferenceIds) {
          assigned.add(referenceId);
        }

        const assignedReferences = assignedReferenceIds.map(
          (referenceId) => {
            const reference = referenceById.get(referenceId);
            if (!reference) {
              throw new Error(
                'REF_PROV_COVERAGE_REFERENCE_NOT_FOUND',
              );
            }
            return reference;
          },
        );

        const unresolvedReferenceIds = uniqueSorted(
          assignedReferences
            .filter(unresolved)
            .map((reference) => reference.referenceId),
        );
        const unknownLicenseReferenceIds = uniqueSorted(
          assignedReferences
            .filter(
              (reference) =>
                reference.licenseStatus === 'UNKNOWN' ||
                reference.licenseStatus ===
                  'DECLARED_UNVERIFIED',
            )
            .map((reference) => reference.referenceId),
        );
        const implementedMappingIds = uniqueSorted(
          subsystemMappings
            .filter(
              (mapping) =>
                mapping.adoptionStatus === 'IMPLEMENTED',
            )
            .map((mapping) => mapping.mappingId),
        );
        const nonImplementedMappingIds = uniqueSorted(
          subsystemMappings
            .filter(
              (mapping) =>
                mapping.adoptionStatus !== 'IMPLEMENTED',
            )
            .map((mapping) => mapping.mappingId),
        );
        const traceableReferenceCount =
          assignedReferences.filter(traceable).length;
        const assignedReferenceCount =
          assignedReferences.length;
        const coverageRatio =
          assignedReferenceCount === 0
            ? 0
            : traceableReferenceCount /
              assignedReferenceCount;

        let status: ReferenceCoverageStatus = 'TRACEABLE';
        if (
          unresolvedReferenceIds.length > 0 &&
          traceableReferenceCount === 0
        ) {
          status = 'DISCOVERY_REQUIRED';
        } else if (
          unresolvedReferenceIds.length > 0 ||
          unknownLicenseReferenceIds.length > 0
        ) {
          status = 'PARTIAL';
        }

        return Object.freeze({
          subsystem,
          assignedReferenceIds,
          implementedMappingIds,
          nonImplementedMappingIds,
          unresolvedReferenceIds,
          unknownLicenseReferenceIds,
          traceableReferenceCount,
          assignedReferenceCount,
          coverageRatio,
          status,
        });
      },
    );

  const unassignedReferenceIds = uniqueSorted(
    references
      .filter((reference) => !assigned.has(reference.referenceId))
      .map((reference) => reference.referenceId),
  );
  const unresolvedReferenceIds = uniqueSorted(
    references
      .filter(unresolved)
      .map((reference) => reference.referenceId),
  );

  return Object.freeze({
    schemaVersion: REFERENCE_COVERAGE_SCHEMA_VERSION,
    subsystemCoverage: Object.freeze(subsystemCoverage),
    unassignedReferenceIds,
    unresolvedReferenceIds,
    totalReferences: references.length,
    totalMappings: mappings.length,
  });
}

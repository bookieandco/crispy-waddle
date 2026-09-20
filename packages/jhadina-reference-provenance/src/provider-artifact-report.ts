import type {
  ProviderContractSnapshot,
  ReferenceArtifactPin,
  ReferenceProvenanceRegistry,
} from './index.js';

export const PROVIDER_ARTIFACT_REPORT_SCHEMA_VERSION =
  'REF-PROV-04' as const;

export type ProviderArtifactCoverageReport = Readonly<{
  schemaVersion: typeof PROVIDER_ARTIFACT_REPORT_SCHEMA_VERSION;
  contractedProviderReferenceIds: readonly string[];
  uncontractedProviderReferenceIds: readonly string[];
  providerContractIds: readonly string[];
  pinnedArtifactPinIds: readonly string[];
  unresolvedArtifactPinIds: readonly string[];
  contractDigestById: Readonly<Record<string, string>>;
  totalProviderReferences: number;
  totalProviderContracts: number;
  totalArtifactPins: number;
}>;

function uniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values)].sort((a, b) => a.localeCompare(b)),
  );
}

export function buildProviderArtifactCoverageReport(
  registry: ReferenceProvenanceRegistry,
): ProviderArtifactCoverageReport {
  registry.assertIntegrity();

  const providerReferenceIds = uniqueSorted(
    registry
      .listReferences()
      .filter((reference) =>
        reference.roles.includes('API_PROVIDER'),
      )
      .map((reference) => reference.referenceId),
  );

  const contracts = registry.listProviderContracts();
  const contractedProviderReferenceIds = uniqueSorted(
    contracts.map((contract) => contract.referenceId),
  );
  const contractedSet = new Set(contractedProviderReferenceIds);

  const uncontractedProviderReferenceIds = uniqueSorted(
    providerReferenceIds.filter(
      (referenceId) => !contractedSet.has(referenceId),
    ),
  );

  const pins = registry.listArtifactPins();
  const pinnedArtifactPinIds = uniqueSorted(
    pins
      .filter((pin) => pin.status === 'PINNED')
      .map((pin) => pin.pinId),
  );
  const unresolvedArtifactPinIds = uniqueSorted(
    pins
      .filter((pin) => pin.status === 'REQUIRED_UNRESOLVED')
      .map((pin) => pin.pinId),
  );

  const contractDigestById = Object.freeze(
    Object.fromEntries(
      [...contracts]
        .sort((a, b) => a.contractId.localeCompare(b.contractId))
        .map((contract: ProviderContractSnapshot) => [
          contract.contractId,
          contract.contractDigest,
        ]),
    ),
  );

  return Object.freeze({
    schemaVersion: PROVIDER_ARTIFACT_REPORT_SCHEMA_VERSION,
    contractedProviderReferenceIds,
    uncontractedProviderReferenceIds,
    providerContractIds: Object.freeze(
      contracts.map((contract) => contract.contractId),
    ),
    pinnedArtifactPinIds,
    unresolvedArtifactPinIds,
    contractDigestById,
    totalProviderReferences: providerReferenceIds.length,
    totalProviderContracts: contracts.length,
    totalArtifactPins: pins.length,
  });
}

export function unresolvedArtifactPins(
  registry: ReferenceProvenanceRegistry,
): readonly ReferenceArtifactPin[] {
  return Object.freeze(
    registry
      .listArtifactPins()
      .filter((pin) => pin.status === 'REQUIRED_UNRESOLVED'),
  );
}

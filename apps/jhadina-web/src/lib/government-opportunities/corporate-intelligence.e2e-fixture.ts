import type { CorporateIntelligenceRepository } from "./corporate-intelligence";

export const OCE_6_36_FIXTURE = {
  canonicalKey: "us:tx:fixture:oce-6-36",
  legalName: "OCE 6 36 Fixture Services LLC",
  jurisdiction: "us_tx",
  entityNumber: "FIXTURE-OCE-6-36",
  status: "active",
  source: "test-fixture",
  sourceReference: "oce-6-36-fixture",
} as const;

/**
 * Contract-level smoke test for the persistence boundary.
 * Run against an injected repository implementation in CI/integration tests.
 */
export async function runCorporateIntelligenceSmokeTest(
  repository: CorporateIntelligenceRepository,
) {
  const first = await repository.upsertEntity(OCE_6_36_FIXTURE);
  const second = await repository.upsertEntity(OCE_6_36_FIXTURE);

  if (first.id !== second.id) {
    throw new Error("OCE-6.36 entity deduplication failed");
  }

  const evidence = await repository.upsertEvidence({
    entityId: first.id,
    source: "test-fixture",
    sourceReference: "oce-6-36-fixture",
    evidenceType: "corporate_record",
    fingerprint: "oce-6-36-fixture-v1",
  });

  const duplicateEvidence = await repository.upsertEvidence({
    entityId: first.id,
    source: "test-fixture",
    sourceReference: "oce-6-36-fixture",
    evidenceType: "corporate_record",
    fingerprint: "oce-6-36-fixture-v1",
  });

  if (evidence.id !== duplicateEvidence.id) {
    throw new Error("OCE-6.36 evidence deduplication failed");
  }

  return { entityId: first.id, evidenceId: evidence.id };
}

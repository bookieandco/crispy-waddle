import type {
  ArtifactAdmissionReceipt,
  ArtifactRuntimeDescriptor,
  RuntimeArtifactAttestation,
} from './artifact-admission.js';

export const ARTIFACT_DEPLOYMENT_SCHEMA_VERSION =
  'REF-PROV-06' as const;

export interface ArtifactAdmissionLedger {
  appendAdmission(receipt: ArtifactAdmissionReceipt): Promise<void>;
  getAdmission(
    admissionId: string,
  ): Promise<ArtifactAdmissionReceipt | undefined>;
  appendAttestation(
    attestation: RuntimeArtifactAttestation,
  ): Promise<void>;
  getAttestation(
    attestationId: string,
  ): Promise<RuntimeArtifactAttestation | undefined>;
  latestAttestationForRuntime(
    runtimeInstanceId: string,
    artifactId: string,
  ): Promise<RuntimeArtifactAttestation | undefined>;
}

export type ArtifactDeploymentRequirement = Readonly<{
  deploymentId: string;
  subsystem: string;
  runtimeInstanceId: string;
  runtime: ArtifactRuntimeDescriptor;
  artifactId: string;
  pinId: string;
  admissionId: string;
  attestationId: string;
}>;

export type ArtifactDeploymentReceipt = Readonly<{
  schemaVersion: typeof ARTIFACT_DEPLOYMENT_SCHEMA_VERSION;
  deploymentId: string;
  subsystem: string;
  runtimeInstanceId: string;
  artifactId: string;
  pinId: string;
  admissionId: string;
  admissionReceiptHash: string;
  attestationId: string;
  attestationHash: string;
  artifactDigest: string;
  verifiedAt: string;
}>;

function runtimeEqual(
  a: ArtifactRuntimeDescriptor,
  b: ArtifactRuntimeDescriptor,
): boolean {
  return (
    a.runtimeName === b.runtimeName &&
    a.runtimeVersion === b.runtimeVersion &&
    a.platform === b.platform &&
    a.architecture === b.architecture &&
    a.accelerator === b.accelerator
  );
}

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

export async function enforceArtifactDeployment(
  ledger: ArtifactAdmissionLedger,
  requirement: ArtifactDeploymentRequirement,
  verifiedAt: string,
): Promise<ArtifactDeploymentReceipt> {
  assertNonEmpty(
    requirement.deploymentId,
    'REF_PROV_06_DEPLOYMENT_ID_REQUIRED',
  );
  assertNonEmpty(
    requirement.subsystem,
    'REF_PROV_06_SUBSYSTEM_REQUIRED',
  );
  assertNonEmpty(
    requirement.runtimeInstanceId,
    'REF_PROV_06_RUNTIME_INSTANCE_REQUIRED',
  );
  if (Number.isNaN(Date.parse(verifiedAt))) {
    throw new Error('REF_PROV_06_VERIFIED_AT_INVALID');
  }

  const admission = await ledger.getAdmission(
    requirement.admissionId,
  );
  if (!admission) {
    throw new Error('REF_PROV_06_ADMISSION_NOT_DURABLE');
  }
  if (
    admission.artifactId !== requirement.artifactId ||
    admission.pinId !== requirement.pinId
  ) {
    throw new Error('REF_PROV_06_ADMISSION_BINDING_MISMATCH');
  }
  if (!runtimeEqual(admission.runtime, requirement.runtime)) {
    throw new Error('REF_PROV_06_ADMISSION_RUNTIME_MISMATCH');
  }

  const attestation = await ledger.getAttestation(
    requirement.attestationId,
  );
  if (!attestation) {
    throw new Error('REF_PROV_06_ATTESTATION_NOT_DURABLE');
  }
  if (
    attestation.admissionId !== admission.admissionId ||
    attestation.admissionReceiptHash !== admission.receiptHash ||
    attestation.pinId !== admission.pinId ||
    attestation.artifactId !== admission.artifactId ||
    attestation.artifactDigest !== admission.artifactDigest
  ) {
    throw new Error('REF_PROV_06_ATTESTATION_BINDING_MISMATCH');
  }
  if (
    attestation.runtimeInstanceId !== requirement.runtimeInstanceId ||
    !runtimeEqual(attestation.runtime, requirement.runtime)
  ) {
    throw new Error('REF_PROV_06_ATTESTATION_RUNTIME_MISMATCH');
  }
  if (Date.parse(attestation.loadedAt) > Date.parse(verifiedAt)) {
    throw new Error('REF_PROV_06_ATTESTATION_FROM_FUTURE');
  }

  return Object.freeze({
    schemaVersion: ARTIFACT_DEPLOYMENT_SCHEMA_VERSION,
    deploymentId: requirement.deploymentId,
    subsystem: requirement.subsystem,
    runtimeInstanceId: requirement.runtimeInstanceId,
    artifactId: requirement.artifactId,
    pinId: requirement.pinId,
    admissionId: admission.admissionId,
    admissionReceiptHash: admission.receiptHash,
    attestationId: attestation.attestationId,
    attestationHash: attestation.attestationHash,
    artifactDigest: admission.artifactDigest,
    verifiedAt,
  });
}

export class InMemoryArtifactAdmissionLedger
  implements ArtifactAdmissionLedger
{
  private readonly admissions = new Map<
    string,
    ArtifactAdmissionReceipt
  >();
  private readonly attestations = new Map<
    string,
    RuntimeArtifactAttestation
  >();

  async appendAdmission(
    receipt: ArtifactAdmissionReceipt,
  ): Promise<void> {
    const existing = this.admissions.get(receipt.admissionId);
    if (existing) {
      if (existing.receiptHash !== receipt.receiptHash) {
        throw new Error('REF_PROV_06_ADMISSION_IMMUTABLE');
      }
      return;
    }
    this.admissions.set(receipt.admissionId, receipt);
  }

  async getAdmission(
    admissionId: string,
  ): Promise<ArtifactAdmissionReceipt | undefined> {
    return this.admissions.get(admissionId);
  }

  async appendAttestation(
    attestation: RuntimeArtifactAttestation,
  ): Promise<void> {
    const admission = this.admissions.get(attestation.admissionId);
    if (
      !admission ||
      admission.receiptHash !== attestation.admissionReceiptHash
    ) {
      throw new Error(
        'REF_PROV_06_ATTESTATION_REQUIRES_DURABLE_ADMISSION',
      );
    }
    const existing = this.attestations.get(attestation.attestationId);
    if (existing) {
      if (existing.attestationHash !== attestation.attestationHash) {
        throw new Error('REF_PROV_06_ATTESTATION_IMMUTABLE');
      }
      return;
    }
    this.attestations.set(attestation.attestationId, attestation);
  }

  async getAttestation(
    attestationId: string,
  ): Promise<RuntimeArtifactAttestation | undefined> {
    return this.attestations.get(attestationId);
  }

  async latestAttestationForRuntime(
    runtimeInstanceId: string,
    artifactId: string,
  ): Promise<RuntimeArtifactAttestation | undefined> {
    return [...this.attestations.values()]
      .filter(
        (item) =>
          item.runtimeInstanceId === runtimeInstanceId &&
          item.artifactId === artifactId,
      )
      .sort(
        (a, b) =>
          Date.parse(b.loadedAt) - Date.parse(a.loadedAt) ||
          b.attestationId.localeCompare(a.attestationId),
      )[0];
  }
}

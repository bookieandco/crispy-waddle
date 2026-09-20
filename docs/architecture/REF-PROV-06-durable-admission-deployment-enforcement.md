# REF-PROV-06 — Durable Admission Ledger + Deployment Enforcement

## Objective

REF-PROV-05 proved that exact artifact bytes can be admitted and attested.

REF-PROV-06 makes those proofs durable and turns them into a composition
precondition:

```text
ArtifactAdmissionReceipt
  -> append-only durable ledger
RuntimeArtifactAttestation
  -> append-only durable ledger
Deployment requirement
  -> durable proof verification
  -> subsystem composition
```

An in-memory admission from an earlier process is not sufficient for production
composition.

## Durable ledger

`ArtifactAdmissionLedger` stores:

- admission receipts by admission ID;
- runtime attestations by attestation ID;
- latest attestation for a runtime instance + artifact.

The ledger is append-only. Reusing an identifier with a different receipt or
attestation hash fails closed.

`PostgresArtifactAdmissionLedger` provides the production persistence
adapter.

Migration:

```text
packages/jhadina-reference-provenance/migrations/
  001_artifact_admission_ledger.sql
```

creates:

- `reference_artifact_admissions`;
- `reference_artifact_attestations`;
- runtime/artifact lookup indexes;
- foreign-key lineage from attestation to admission;
- UPDATE/DELETE rejection triggers.

## Deployment enforcement

`enforceArtifactDeployment()` requires exact durable agreement across:

- deployment ID/subsystem;
- admission ID;
- admission receipt hash;
- artifact ID;
- pin ID;
- artifact digest;
- attestation ID/hash;
- runtime instance ID;
- runtime name/version/platform/architecture/accelerator;
- verification timestamp.

Missing admission, missing attestation, cross-runtime reuse, artifact
substitution, pin substitution, or receipt mismatch rejects composition.

The returned `ArtifactDeploymentReceipt` is evidence that deployment proof
was checked. It does not grant execution or policy authority.

## Director / ComfyUI

The canonical Director provider factory is now asynchronous because deployment
proof is a durable lookup.

Before a ComfyUI provider/model registry can be constructed it requires:

- an ArtifactAdmissionLedger;
- a REF-PROV-06 deployment requirement;
- subsystem = director;
- artifactId = comfyui:runtime-model-bundle;
- matching durable admission + attestation.

Catalog metadata and environment configuration alone can no longer construct
the production Director ComfyUI runtime.

This intentionally means current production composition remains blocked until
REF-PROV-04's unresolved ComfyUI model bundle is replaced by a real pinned
artifact and REF-PROV-05 admission/attestation is performed.

## SAM2 tracking worker

The Python SAM2 worker boundary now requires an `ArtifactDeploymentProof`
before inference.

It requires:

- artifactId = sam2:runtime-checkpoint;
- pinId = artifact:sam2:checkpoint;
- runtime instance ID;
- admission ID/hash;
- attestation ID/hash;
- SHA-256 artifact digest.

The host receives the proof at composition time and passes it to every
inference call. Requests cannot supply or replace this proof.

The Python worker does not independently query the TypeScript/Postgres ledger.
The deployment/host layer is responsible for supplying the already verified
durable proof. This keeps the inference worker isolated from governance and
database authority.

## Current blocker status

SAM2 and the ComfyUI model bundle remain REQUIRED_UNRESOLVED in REF-PROV.

Therefore this phase installs enforcement without pretending those deployments
are currently admissible.

VoiceFixer, NeuralNote and ACE-Step also remain unresolved. Their concrete
runtime worker composition points are not yet present in the repository, so
REF-PROV-06 does not invent fake loaders merely to attach a gate.

When those workers are implemented, they must use the same durable deployment
contract.

## Certification

The isolated Reference Provenance Certification workflow now runs:

```text
frozen install
-> REF-PROV type-check
-> all REF-PROV tests
-> REF-PROV-05 admission certification
-> REF-PROV-06 durable deployment certification
-> REF-PROV build
```

Director factory tests additionally prove that provider construction fails
without durable artifact deployment proof.

## Acceptance criteria

1. admissions are durably append-only;
2. attestations require a durable matching admission;
3. same-ID mutation fails closed;
4. Postgres schema preserves admission -> attestation lineage;
5. deployment requires exact durable admission;
6. deployment requires exact durable runtime attestation;
7. cross-runtime proof reuse fails;
8. artifact/pin substitution fails;
9. Director cannot compose ComfyUI without the model-bundle proof;
10. SAM2 cannot infer without its deployment proof;
11. unresolved model artifacts remain blocked rather than fabricated;
12. isolated REF-PROV certification includes the new enforcement tests.

## Next

REF-PROV-07 — Deployment Session Lifecycle + Revocation

Add deployment-session identity, startup/heartbeat/shutdown receipts, artifact
revocation/supersession handling, and fail-closed runtime invalidation when an
admission or artifact pin is withdrawn.

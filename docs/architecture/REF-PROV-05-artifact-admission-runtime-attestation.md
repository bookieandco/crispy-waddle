# REF-PROV-05 — Artifact Admission + Runtime Attestation

## Objective

REF-PROV-04 answered:

- which provider contract does Jhadina expect?
- which exact artifact bytes are approved for consideration?

REF-PROV-05 answers the next production question:

> May these exact bytes enter this exact runtime, and can the runtime later
> prove that those are the bytes it actually loaded?

The admission chain is:

```text
source verification
  -> artifact pin
  -> compatibility manifest
  -> license admission
  -> provider-contract binding
  -> admission receipt
  -> runtime load
  -> runtime attestation
```

None of these records grant policy or execution authority.

## Compatibility manifest

A compatibility manifest binds one pinned artifact to:

- one REF-PROV artifact pin;
- one artifact identity;
- an exact allowlist of runtime descriptors;
- required provider-contract IDs;
- creation timestamp;
- evidence;
- deterministic manifest hash.

Runtime descriptors currently bind:

- runtime name;
- runtime version;
- platform;
- architecture;
- optional accelerator.

Compatibility is exact rather than fuzzy. A new CUDA/runtime/platform version
must be admitted deliberately rather than inheriting compatibility from a
similar string.

A manifest cannot be created for a REQUIRED_UNRESOLVED artifact.

## Admission requirements

ArtifactAdmissionGate.admit() requires all of the following:

1. registered artifact pin;
2. pin status PINNED;
3. actual bytes whose SHA-256 equals the pin digest;
4. byte length match when the pin specifies length;
5. reproducible source verification;
6. pin/source revision lineage match when a source revision is pinned;
7. compatibility-manifest binding;
8. exact supported runtime match;
9. every required provider contract active and registered;
10. acceptable license basis;
11. unique admission ID.

Failure occurs before an admission receipt is recorded.

## License admission

### Permissive verified source

A source with:

```text
licenseFinding = VERIFIED
licenseReusePolicy = PERMISSIVE
```

may use PERMISSIVE_VERIFIED as its admission basis.

### Review-required source

COPYLEFT_REVIEW_REQUIRED and CUSTOM_REVIEW_REQUIRED do not auto-admit.

They require an ArtifactLicenseReviewReceipt bound to:

- reference ID;
- source-verification ID;
- RUNTIME_USE scope;
- ALLOW decision;
- reviewer ID;
- review timestamp;
- review evidence.

The review must predate admission.

The receipt does not grant execution authority. It proves only that the
licensing gate required by REF-PROV was explicitly satisfied.

### No-license / unverified source

NO_LICENSE, NOT_APPLICABLE and unverified license states are not runtime
artifact admission paths.

They fail closed.

## Admission receipt

A successful ArtifactAdmissionReceipt binds:

- admission ID;
- pin/reference/artifact IDs;
- artifact SHA-256;
- artifact pin hash;
- source-verification ID/hash;
- source revision;
- compatibility-manifest ID/hash;
- exact runtime descriptor;
- active provider-contract IDs;
- provider-contract digests;
- license admission basis;
- optional review receipt ID;
- complete REF-PROV registry hash at admission time;
- admission timestamp;
- deterministic receipt hash.

This makes the decision replayable against the registry state that existed at
admission time.

## Runtime attestation

Admission is not proof that the runtime actually loaded the admitted bytes.

ArtifactAdmissionGate.attest() therefore requires:

- a previously registered admission receipt;
- unique attestation ID;
- runtime instance ID;
- exact runtime descriptor match;
- observed loaded-artifact digest;
- load timestamp not earlier than admission.

The RuntimeArtifactAttestation binds:

- admission receipt hash;
- artifact identity/digest;
- runtime instance;
- runtime descriptor;
- load timestamp;
- deterministic attestation hash.

A different digest or runtime cannot reuse the receipt.

## Replay boundaries

Admission IDs and attestation IDs are single-use in the admission gate.

Reusing either ID fails closed.

This prevents a later artifact load from being silently represented as an
older attested event.

## Readiness report

buildArtifactAdmissionReadinessReport() classifies every registered artifact
pin as one of:

- READY_FOR_COMPATIBILITY_MANIFEST;
- REQUIRES_LICENSE_REVIEW;
- BLOCKED_UNRESOLVED_PIN;
- BLOCKED_SOURCE_VERIFICATION;
- BLOCKED_LICENSE.

The current REF-PROV-04 model artifacts remain
BLOCKED_UNRESOLVED_PIN because no exact production model/checkpoint bytes have
been supplied:

- SAM2;
- ComfyUI runtime model bundle;
- VoiceFixer;
- NeuralNote;
- ACE-Step.

That is intentional. REF-PROV-05 creates the admission machinery without
inventing deployable artifacts.

## Isolated certification

The monorepo Launch Gate is currently blocked by unrelated Director Core
compile failures.

REF-PROV-05 adds:

```text
.github/workflows/reference-provenance-certification.yml
```

This gate runs independently:

```text
frozen install
  -> @jhadina/reference-provenance type-check
  -> full REF-PROV tests
  -> focused REF-PROV-05 admission tests
  -> package build
```

It uses read-only repository permissions and no secrets.

## Runtime integration boundary

The current repository does not contain a canonical production model-file
loader that directly opens SAM2/VoiceFixer/NeuralNote/ACE-Step checkpoint
bytes.

Therefore REF-PROV-05 does not pretend such a loader is already governed.

The required future composition rule is:

> A concrete model/binary loader must receive a valid admission receipt and
> emit a runtime attestation for the loaded bytes before exposing the loaded
> artifact to the subsystem.

Transport adapters such as ComfyUI remain separate from the model bundle they
may host.

## Acceptance criteria

REF-PROV-05 is complete when:

1. unresolved artifacts cannot receive compatibility manifests;
2. artifact bytes must match the registered SHA-256;
3. source lineage must be reproducible;
4. pin/source revision mismatch fails closed;
5. compatibility is bound to exact runtime identity;
6. provider-contract requirements are bound into admission;
7. permissive licensing can auto-satisfy the licensing gate;
8. copyleft/custom licensing requires explicit review;
9. no-license artifacts cannot be admitted;
10. admission receipt binds registry, source, pin, contracts, manifest and runtime;
11. runtime attestation proves the observed loaded digest;
12. admission/attestation IDs reject replay;
13. current unresolved model artifacts remain machine-readable blockers;
14. an isolated REF-PROV certification workflow exists;
15. admission and attestation records retain zero runtime/policy/factual/execution authority.

## Next

REF-PROV-06 — Durable Admission Ledger + Deployment Enforcement

Persist admission receipts and runtime attestations, bind them to deployment
identity, and require verified attestation at subsystem composition boundaries.

Likely first integrations:

- Director/ComfyUI model bundle composition;
- tracking/SAM2 worker deployment;
- Music restoration model workers.

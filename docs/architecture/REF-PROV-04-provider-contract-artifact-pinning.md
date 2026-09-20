# REF-PROV-04 — Provider Contract + Artifact Digest Pinning

## Objective

REF-PROV-04 closes a different class of provenance risk:

> A provider can be correctly identified and licensed while the runtime wire
> contract silently changes underneath Jhadina.

The phase therefore adds two governed records:

1. provider contract snapshots;
2. artifact digest pins.

Neither record grants runtime, factual, policy, model or execution authority.

## Provider contract snapshot

A ProviderContractSnapshot captures the exact interface Jhadina expects:

- provider/reference identity;
- protocol;
- canonical provider locator;
- versioning strategy;
- pinned version value;
- endpoint/operation set;
- required request headers;
- required request fields;
- required response fields;
- verification evidence;
- deterministic contract digest.

Supported version strategies:

- HEADER;
- PATH;
- PROTOCOL;
- UPSTREAM_REVISION;
- PACKAGE_VERSION;
- CONTRACT_DIGEST.

This allows versioned APIs and intentionally unversioned APIs to be governed
without pretending they use the same versioning scheme.

## Runtime compatibility

assertProviderContractCompatible() recomputes the canonical contract-shape
digest.

Any change to provider identity, protocol, version strategy/value, endpoint,
method, required headers, request fields or response fields causes
REF_PROV_PROVIDER_CONTRACT_DRIFT.

Field ordering is normalized, so meaningless ordering changes do not create
false drift.

## Source-conformance tests

REF-PROV-04 verifies the actual adapter source against the registered contract.

The suite covers:

- Plaid;
- Stripe;
- Anthropic;
- Shodan + InternetDB;
- DexScreener;
- CoinGecko;
- Helius;
- SAM.gov;
- ComfyUI;
- Reticulum;
- Supabase.

Changing a provider endpoint/header/version without updating provenance now
breaks conformance.

## Direct provider repairs

### Plaid

Money Core now sends:

Plaid-Version: 2020-09-14

rather than inheriting a dashboard/account default.

### Stripe

Commerce now sends:

Stripe-Version: 2026-08-26.dahlia

rather than inheriting the Stripe account default.

The Stripe version is explicit because the adapter directly implements Stripe
REST request/response shapes instead of delegating version pinning to an SDK.

## Contracted provider set

All current registry references carrying API_PROVIDER are covered.

- Plaid — header version 2020-09-14
- Stripe — header version 2026-08-26.dahlia
- Anthropic — header version 2023-06-01
- Shodan — unversioned contract digest
- Shodan InternetDB — unversioned contract digest
- DexScreener — path v1
- CoinGecko Pro — path v3
- Helius — JSON-RPC 2.0 + getTransfersByAddress
- SAM.gov Opportunities — path v2
- ComfyUI — pinned upstream revision
- Reticulum bridge — pinned upstream revision
- Supabase — installed @supabase/supabase-js 2.116.0

The REF-PROV-04 coverage report requires zero uncontracted provider
references.

## Artifact pins

A ReferenceArtifactPin identifies exact runtime artifacts independently from
their source repository.

A PINNED artifact requires:

- canonical locator;
- SHA-256 digest;
- optional byte length;
- verification timestamp;
- evidence.

verifyArtifactBytes() fails closed on digest or length mismatch.

## No fabricated model hashes

Current repository state does not identify exact production checkpoint/model
files for several model-backed references.

They are therefore recorded as REQUIRED_UNRESOLVED:

- SAM2 runtime checkpoint;
- ComfyUI runtime model bundle;
- VoiceFixer model weights;
- NeuralNote runtime model;
- ACE-Step runtime model.

An unresolved artifact cannot claim a digest, byte length, or verification
timestamp.

This turns missing artifact identity into explicit production debt instead of
allowing placeholder hashes to become accidental truth.

## Provider documentation verification

The pinned wire values were checked against provider documentation during this
phase.

Plaid documents explicit request-version selection through the Plaid-Version
header and documents 2020-09-14. Stripe documents explicit Stripe-Version
selection and listed 2026-08-26.dahlia as its current API version at
verification time. Anthropic examples continue to use
anthropic-version: 2023-06-01. DexScreener documents token-pairs/v1.
SAM.gov documents Opportunities Public API v2. Helius documents JSON-RPC 2.0
and getTransfersByAddress.

## Acceptance criteria

REF-PROV-04 is complete when:

1. every current API/provider reference has a registered contract snapshot;
2. contract digests are deterministic;
3. version/header/path/protocol drift fails closed;
4. Plaid sends an explicit API version;
5. Stripe sends an explicit API version;
6. source-conformance tests bind registry contracts to adapter source;
7. artifact pins require SHA-256 when pinned;
8. unresolved artifacts cannot claim fake digests;
9. model/checkpoint debt is machine-readable;
10. registry snapshots include contract and artifact identities;
11. all contract/artifact records retain zero authority.

## Next

REF-PROV-05 — Artifact Admission + Runtime Attestation

Connect deployment artifacts to the registry:

download/load -> SHA-256 -> source/license verification -> compatibility
manifest -> admission receipt -> runtime identity

A model or binary should not enter a production runtime merely because its
name matches a reference.

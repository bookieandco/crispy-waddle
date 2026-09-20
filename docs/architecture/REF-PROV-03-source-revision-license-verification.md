# REF-PROV-03 — Source Revision + License Verification

## Objective

REF-PROV-01 established the reference registry.

REF-PROV-02 expanded repository-wide coverage.

REF-PROV-03 makes external-source identity reproducible:

```text
reference
  -> canonical upstream
  -> immutable revision/version
  -> source digest
  -> license evidence
  -> reuse classification
```

The phase deliberately keeps this separate from implementation provenance.

A repository can be proven to exist and have a permissive license while the
claim that Jhadina actually borrowed from it remains unproven.

## Source verification record

`ReferenceSourceVerification` records:

- verification ID;
- reference ID;
- canonical upstream locator;
- source verification status;
- immutable source revision;
- source digest;
- verification timestamp;
- license finding;
- license expression;
- license evidence locator;
- license reuse policy;
- evidence;
- deterministic verification hash;
- zero runtime/policy/execution/factual authority.

Git repositories use:

`sourceDigest = git-commit-sha1:<40-char commit SHA>`

The commit itself is the immutable source-content identity used by this phase.

## Verification history

Verification records are append-only by verification ID.

A reference may have multiple verification events over time.

This matters because:

- upstream revisions move;
- licenses can change;
- repositories can be archived or transferred;
- an old permissive state must not override a newer restrictive state.

New code-reuse mapping checks consult the latest verification event.

## License findings

### VERIFIED

A concrete license file was inspected at the pinned revision.

### NO_LICENSE_FILE

The upstream repository was pinned, but no root license evidence or GitHub
license declaration was available during verification.

No code reuse is admitted.

### AMBIGUOUS

License evidence exists but cannot safely be reduced to one reuse rule.

### NOT_APPLICABLE

Used for sources where code-licensing analysis is not relevant.

## Reuse policy

### PERMISSIVE

A verified permissive license such as MIT, Apache-2.0 or BSD-3-Clause.

This can satisfy the REF-PROV code-reuse license gate, but it still does not
prove that Jhadina actually copied/adapted code.

### COPYLEFT_REVIEW_REQUIRED

GPL/LGPL-family sources require an explicit compatibility/reuse review before a
mapping may claim borrowed `CODE`.

REF-PROV does not make that legal/packaging decision automatically.

### CUSTOM_REVIEW_REQUIRED

Custom or restricted licenses require explicit review.

Reticulum is in this class because the verified license includes additional
use restrictions and is not treated as ordinary MIT.

### NO_LICENSE

No license evidence was found. Code reuse fails closed.

## Verified upstream batch

Pinned in this phase:

- Godot Engine — MIT
- Turbulenz Engine — MIT
- Reticulum — custom Reticulum License / review required
- ComfyUI — GPL-3.0 / review required
- SAM2 — Apache-2.0
- Supabase — Apache-2.0
- VoiceFixer — MIT
- NeuralNote — Apache-2.0
- AnalogTapeModel / CHOW Tape Model reference — GPL-3.0 / review required
- DawDreamer — GPL-3.0 / review required
- FFmpeg — LGPL-2.1+ default with optional GPL components / review required
- MDP-Adaptive-GA — MIT
- SelfAware — Apache-2.0
- Coach-RL — no license file found
- alpha-beta-CROWN — BSD-3-Clause
- pump-public-docs — no license file found
- Meteora-Rug-Bot — no license file found
- wallet-cluster-detector — MIT
- GPT Researcher — Apache-2.0
- deep-research — MIT
- policy-gate — Apache-2.0

All are pinned to exact commit SHAs in the machine-readable seed.

## Critical provenance distinction

Several handoff-only repositories now have verified upstream identity and
license metadata.

That does **not** upgrade their Jhadina implementation provenance.

For example:

```text
MDP-Adaptive-GA source:
  upstream identity = verified
  revision = pinned
  license = MIT

Jhadina relationship:
  traceabilityStatus = HANDOFF_ONLY
```

The same rule applies to SelfAware, wallet-cluster-detector, GPT Researcher,
deep-research, policy-gate, Meteora-Rug-Bot and other handoff references.

Upstream truth and derivation truth are different evidence questions.

## Code reuse gate hardening

Before REF-PROV-03, a generic `licenseStatus = VERIFIED` was enough for a
future `borrowedArtifactKinds: ['CODE']` mapping.

That is no longer sufficient when a source-verification record exists.

The latest source verification must say:

```text
licenseFinding = VERIFIED
licenseReusePolicy = PERMISSIVE
```

Otherwise code derivation fails closed.

This prevents:

- GPL code being silently treated as unrestricted;
- custom Reticulum-license code being treated as MIT;
- no-license repositories being copied because they are public;
- an old permissive verification overriding a newer restrictive one.

## Verification report

`buildReferenceSourceVerificationReport()` emits:

- pinned reference IDs;
- license-verified IDs;
- permissive-reuse IDs;
- review-required IDs;
- no-license IDs;
- source-unverified IDs;
- unpinned API-contract IDs;
- references whose upstream is verified but whose Jhadina provenance is still
  unresolved.

This makes two debt queues visible at once:

1. **source verification debt**;
2. **implementation provenance debt**.

## Remaining debt

Not all REF-PROV-02 entries are safely resolvable from names alone.

Still unresolved or intentionally unpinned include:

- Sony singer-identity model family;
- ACE-Step exact upstream/version;
- MuseScore license-path classification;
- Justice catalog upstream identities;
- vendor API contract revisions for Plaid, Stripe, Anthropic, Shodan,
  DexScreener, CoinGecko, Helius and SAM.gov.

These remain debt instead of being guessed.

## Authority firewall

Source verification grants no:

- factual runtime authority;
- policy authority;
- execution authority;
- model authority;
- personality authority.

It answers only: **what source/version/license did we verify?**

## Next

**REF-PROV-04 — Provider Contract + Artifact Digest Pinning**

Pin versioned API contracts where possible and add artifact-level digests for
downloaded models/data/tooling:

`provider/version -> contract snapshot -> content digest -> compatibility
tests -> change detection`

This should cover APIs and model artifacts that cannot be represented fully by
a Git commit alone.

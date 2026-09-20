# REF-PROV-03 — Source Revision + License Verification

## Objective

REF-PROV-01 established canonical reference records and mapping rules.

REF-PROV-02 expanded the inventory and made subsystem coverage debt visible.

REF-PROV-03 makes external-source identity reproducible:

```text
reference
  -> exact upstream
  -> immutable revision/version
  -> source digest
  -> license evidence
  -> source-verification receipt
```

The phase deliberately keeps this separate from:

```text
source exists
  != Jhadina used it
  != Jhadina copied code from it
  != source is factually correct
  != source grants runtime authority
```

## Source verification record

`ReferenceSourceVerification` records:

- stable verification ID;
- canonical reference ID;
- source status;
- source kind;
- exact upstream locator;
- immutable revision;
- source digest;
- license verification;
- timestamp;
- evidence locators;
- deterministic verification hash;
- zero authority.

For Git repositories, a `VERIFIED` record requires an immutable Git commit.

The source digest is:

`git-commit:<exact SHA>`

This avoids pretending a mutable branch name such as `main` is a reproducible
source revision.

## License verification

A verified license requires:

1. a concrete license expression;
2. a license evidence locator;
3. for Git sources, the evidence locator must contain the exact verified
   revision.

This prevents a current branch license from being silently applied to an older
or different source revision.

Unknown stays unknown.

REF-PROV-03 does not simplify complex or non-standard upstream licensing merely
to improve coverage numbers.

## Verified upstreams in this phase

### Product/runtime references

Pinned upstreams include:

- Godot Engine;
- Turbulenz Engine;
- Reticulum;
- ComfyUI;
- SAM2;
- Supabase.

### Music restoration references

Pinned upstreams include:

- VoiceFixer → `haoheliu/voicefixer`;
- NeuralNote → `DamRsn/NeuralNote`;
- CHOW Tape Model → `jatinchowdhury18/AnalogTapeModel`;
- DawDreamer → `DBraun/DawDreamer`;
- MuseScore → `musescore/MuseScore`;
- FFmpeg → `FFmpeg/FFmpeg`.

The Sony singer-identity family and ACE-Step are not guessed into a repository
identity in this phase.

### Handoff references

REF-PROV-03 also verifies the external existence and revision of the named
handoff repositories where possible:

Sports:
- MDP-Adaptive-GA;
- SelfAware;
- Coach-RL;
- alpha-beta-CROWN.

SHARK:
- pump-public-docs;
- Meteora-Rug-Bot;
- wallet-cluster-detector.

Knowledge:
- GPT Researcher;
- deep-research;
- policy-gate.

This resolves **source identity**, not the Jhadina implementation relationship.

For example:

```text
Meteora-Rug-Bot upstream = VERIFIED
Meteora-Rug-Bot -> Jhadina SHARK derivation = HANDOFF_ONLY
```

No implementation mapping is manufactured.

## License results

This phase verifies revision-pinned license evidence for sources whose upstream
license can be represented cleanly, including examples using:

- MIT;
- Apache-2.0;
- GPL-3.0.

It intentionally leaves license state unknown for sources where the repository
has no declared license or GitHub reports a non-standard/complex licensing
state.

Examples intentionally not simplified include:

- Reticulum;
- MuseScore;
- FFmpeg;
- Coach-RL;
- alpha-beta-CROWN;
- pump-public-docs;
- Meteora-Rug-Bot.

FFmpeg is especially important: a single blanket license expression would be
misleading because effective licensing depends on build configuration.

## Canonical record upgrades

Where source identity and license are verified, the canonical
`ReferenceRecord` now also carries:

- exact GitHub locator;
- `sourceRevision`;
- `licenseStatus: VERIFIED`;
- license expression;
- revision-pinned license evidence.

Handoff records keep `traceabilityStatus: HANDOFF_ONLY` even when their
upstream repository and license are verified.

That distinction is intentional.

## Coverage semantics

REF-PROV-02 coverage can now consume source verification as an optional license
lookup.

A verified source license can clear **license debt**.

It cannot clear **relationship debt**.

Therefore Sports and Knowledge remain `DISCOVERY_REQUIRED` until actual
source-to-implementation evidence exists in the canonical repository.

## Authority firewall

Every source verification has:

```text
runtimeAuthority   = NONE
policyAuthority    = NONE
executionAuthority = NONE
factualAuthority   = NONE
```

Pinning a source does not make its claims true and does not authorize execution.

## Acceptance criteria

REF-PROV-03 is complete when:

1. verified Git sources use immutable commit revisions;
2. Git source digests bind to the same commit;
3. verified license evidence is revision-pinned;
4. canonical records are upgraded where proof exists;
5. ambiguous/complex licenses remain unknown;
6. handoff upstream verification does not promote implementation traceability;
7. coverage can use verified license evidence without clearing relationship debt;
8. no source verification receives factual/policy/runtime/execution authority.

## Next

**REF-PROV-04 — Mapping Evidence Promotion**

Use exact repository history, commits, PRs and architecture artifacts to resolve
the remaining relationship debt:

`verified upstream -> exact Jhadina implementation evidence -> mapping
promotion or explicit rejection`

The priority queue is Sports, SHARK and Knowledge because their upstream
identities are now pinned while their implementation relationships remain
unverified.

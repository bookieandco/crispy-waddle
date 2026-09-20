# REF-PROV-01 — Reference Provenance Registry

## Objective

Jhadina has accumulated a large number of external repositories, APIs, papers,
datasets and architectural inspirations across subsystem build threads.

Before REF-PROV-01, those references were not governed uniformly.

Some were explicitly linked in repository documentation. Some became live
provider integrations. Some existed only in handoff notes. In several audits,
a prior handoff claimed a reference had influenced a subsystem while current
`main` contained no durable source-to-implementation mapping.

REF-PROV-01 creates one canonical answer to:

> What external reference was considered, where did it come from, what did
> Jhadina borrow from it, where is that adaptation implemented, what evidence
> proves the relationship, and how confident are we that the claim is real?

It deliberately does **not** answer whether an external source is factually
correct or whether an action should be authorized.

## Package

`@jhadina/reference-provenance`

Location:

`packages/jhadina-reference-provenance`

Schema version:

`REF-PROV-01`

## Core records

### ReferenceRecord

A source record contains:

- stable `referenceId`;
- canonical name;
- source kind;
- reference roles;
- canonical locator;
- optional source revision;
- discovery source;
- traceability status;
- license status and evidence when verified;
- evidence proving why the reference is in the registry;
- optional supersession link;
- deterministic record hash.

### ReferenceImplementationMapping

A mapping answers what happened after discovery:

- reference ID;
- subsystem;
- concrete target paths;
- borrowed artifact kinds;
- borrowed concepts;
- adaptation notes;
- adoption status;
- implementation evidence;
- optional source revision;
- deterministic mapping hash.

This separates **“we looked at it”** from **“we implemented something from it.”**

## Traceability states

`REPO_TRACEABLE`

The repository itself contains durable evidence for the reference claim.

`EXTERNALLY_VERIFIED`

The reference was independently verified, but the current repository does not
yet carry the strongest in-repo trace.

`HANDOFF_ONLY`

A handoff/user build history named the reference, but current main does not
prove the implementation relationship.

`UNVERIFIED`

A candidate reference exists but has not been verified.

`SUPERSEDED`

A newer reference replaces it.

`REJECTED`

The reference was explicitly rejected.

## Fail-closed implementation claims

An `IMPLEMENTED` mapping cannot be registered from a `HANDOFF_ONLY` or
`UNVERIFIED` reference.

It must have:

- a reference whose traceability is `REPO_TRACEABLE` or
  `EXTERNALLY_VERIFIED`;
- implementation evidence that includes a repo path, commit or pull request.

This prevents future audits from turning conversational memory into a false
implementation claim.

## License boundary

REF-PROV-01 does not guess licenses.

A reference marked `VERIFIED` for licensing must carry both:

- a license expression;
- a locator proving where that license was verified.

Unknown remains `UNKNOWN`.

Most importantly, any mapping that claims borrowed `CODE` fails closed unless
the source license is verified.

Conceptual inspiration, API integration and interface-shape learning remain
distinct from code copying.

## Authority firewall

Every reference, mapping and registry snapshot has:

```text
runtimeAuthority   = NONE
policyAuthority    = NONE
executionAuthority = NONE
factualAuthority   = NONE
```

An external project can teach Jhadina a pattern.

It cannot:

- authorize a Money trade;
- bypass Action Core;
- mutate Jhadina personality/policy;
- become factual evidence merely because it appears in this registry;
- elevate model output into canonical reality.

Runtime evidence systems must still perform their own source validation,
point-in-time checks and provenance handling.

## Initial audit results

REF-PROV-01 seeds three currently traceable relationships.

### PupsonStuff → Godot Engine

`apps/pupsonstuff/.pupsonstuff-engine-plan.md` explicitly lists Godot as a
reference and says the storefront remains Next.js/Three.js.

Registry status:

- reference: `REPO_TRACEABLE`;
- mapping: `PLANNED`;
- borrowed artifact: `IDEA_ONLY`;
- no code-derivation claim.

### PupsonStuff → Turbulenz Engine

The same plan explicitly lists Turbulenz.

Registry status:

- reference: `REPO_TRACEABLE`;
- mapping: `PLANNED`;
- borrowed artifact: `IDEA_ONLY`;
- no code-derivation claim.

### SHARK → DexScreener

Current main contains a concrete DexScreener ingestion/discovery boundary.

The code itself states DexScreener is candidate discovery and not a historical
reserve/LP-control oracle.

Registry status:

- reference: `REPO_TRACEABLE`;
- mapping: `IMPLEMENTED`;
- borrowed artifact: `INTERFACE_SHAPE`;
- runtime provider evidence remains separate from reference provenance.

## Handoff debt captured explicitly

The initial seed also records known handoff references that were not traceable
on current `crispy-waddle/main` at this audit point, including examples from
Sports, SHARK and Knowledge research.

They are registered as `HANDOFF_ONLY`, not `IMPLEMENTED`.

Examples include:

- MDP-Adaptive-GA;
- SelfAware;
- Coach-RL;
- alpha-beta-CROWN;
- pump-public-docs;
- Meteora-Rug-Bot;
- wallet-cluster-detector;
- GPT Researcher;
- deep-research;
- policy-gate.

This is intentional coverage debt.

The registry now gives later audits a deterministic queue: verify the source,
find exact code/docs/commit evidence, create the mapping, or mark the reference
rejected/superseded.

## Important distinction: provider provenance vs design provenance

DexScreener illustrates the split.

Reference provenance says:

> Jhadina integrates the DexScreener API at these code paths.

Runtime evidence provenance says:

> This specific market observation came from DexScreener at this timestamp and
> passed these normalization/quality checks.

REF-PROV-01 does not replace evidence envelopes, `EvidenceRef`,
`sourceManifest`, `provenanceHash`, or other subsystem runtime provenance.

It connects *design/build lineage*.

## Deterministic snapshots

`ReferenceProvenanceRegistry.snapshot()` returns a deterministic registry hash
derived from sorted reference and mapping hashes.

The snapshot timestamp is metadata and is intentionally excluded from the
content digest.

This makes registry state suitable for audit receipts, release manifests and
future certification gates.

## Acceptance criteria

REF-PROV-01 is complete when:

1. one cross-cutting registry package exists;
2. source records and implementation mappings are separate;
3. repository traceability requires repository evidence;
4. handoff-only references cannot claim `IMPLEMENTED`;
5. code derivation requires verified licensing;
6. supersession cannot point to missing sources or form cycles;
7. records and mappings have deterministic hashes;
8. registry snapshots have deterministic content hashes;
9. reference metadata has zero runtime/policy/execution/factual authority;
10. currently traceable Godot/Turbulenz/DexScreener relationships are seeded;
11. known untraceable handoff references are preserved as explicit audit debt.

## Next

**REF-PROV-02 — Repository-wide Reference Inventory**

Scan subsystem docs, source comments, provider integrations and retained handoff
references into the registry, then emit coverage debt by subsystem:

`discovered reference → verification → license classification → exact source
revision → implementation mapping → evidence → accepted/rejected/superseded`

That phase should expand coverage without weakening the REF-PROV-01 fail-closed
rules.

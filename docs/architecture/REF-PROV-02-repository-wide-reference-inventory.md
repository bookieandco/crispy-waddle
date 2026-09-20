# REF-PROV-02 — Repository-wide Reference Inventory

## Objective

Expand REF-PROV-01 from a small canonical registry into a repository-wide
inventory of external provider, model, architecture and research references.

The central rule remains:

> A reference relationship is not implementation authority, factual authority
> or execution authority.

REF-PROV-02 adds breadth and measurable coverage debt without weakening the
fail-closed rules introduced in REF-PROV-01.

## Inventory classes

The audit found four materially different classes.

### 1. Implemented provider boundaries

Current repository code contains concrete integrations for:

- Plaid account reads;
- Stripe payment API shapes;
- Anthropic Messages API;
- Shodan / InternetDB reads;
- CoinGecko historical market data;
- Helius historical RPC data;
- SAM.gov opportunity search;
- Reticulum communication transport;
- ComfyUI generation transport;
- Supabase persistence/auth/audit infrastructure.

These are recorded as provider/interface mappings, not code derivation.

### 2. Adapted model boundaries

The tracking service contains a bounded SAM2 engine contract.

Its output is explicitly model-produced and unapproved.

REF-PROV therefore records SAM2 as an `ADAPTED` model boundary rather than
claiming bundled upstream code or autonomous truth.

### 3. Design/reference catalogs

Music restoration notes explicitly map:

- VoiceFixer;
- Sony singer-identity models;
- NeuralNote;
- CHOW Tape Model;
- DawDreamer;
- FFmpeg audio mixer;
- ACE-Step;
- MuseScore.

These remain `EVALUATED` or `PLANNED` idea-only mappings unless repository
evidence later proves a concrete runtime adapter.

The Justice work queue likewise names statedecoded, citation-regexes and statedb
as a static discovery/reference catalog. REF-PROV records that relationship
without pretending they are live legal-data providers.

### 4. Handoff-only debt

References inherited from prior build handoffs remain unresolved when current
repository evidence does not prove the relationship.

Examples:

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

REF-PROV-02 assigns these to subsystem coverage debt **without creating fake
implementation mappings**.

## Coverage report

`buildReferenceCoverageReport()` emits one row per subsystem with:

- assigned reference IDs;
- implemented mapping IDs;
- non-implemented mapping IDs;
- unresolved reference IDs;
- unknown-license reference IDs;
- traceable-reference count;
- assigned-reference count;
- traceability ratio;
- coverage status.

Statuses:

### TRACEABLE

All assigned references are repo-traceable or externally verified and there is
no unresolved/unknown-license debt.

### PARTIAL

Some relationships are traceable, but unresolved provenance or license debt
remains.

### DISCOVERY_REQUIRED

The subsystem has assigned references but none of those references are yet
traceable.

## Why license debt remains visible

Provider APIs can be `NOT_APPLICABLE` for the source-code derivation check.

Named external repositories, libraries and models remain `UNKNOWN` until a
license is actually verified.

REF-PROV does not infer a license from project popularity, package names or
memory.

This is especially important before any future mapping can claim
`borrowedArtifactKinds: ['CODE']`.

## Current subsystem picture

The expanded seed gives direct traceability to provider integrations in Money,
Commerce, Intelligence, SHARK, Opportunity, Media/Director and Platform.

Music and Justice now have explicit design/source catalogs, but license and
runtime-adapter verification remains debt.

Sports remains discovery-required in this repository because its named
references live in handoff history and the canonical sports implementation is
separate. The registry does not use that fact to manufacture a
`crispy-waddle` mapping.

SHARK is partial: DexScreener, CoinGecko and Helius are traceable provider
boundaries, while named handoff repositories such as Meteora-Rug-Bot and
wallet-cluster-detector are still unverified as source provenance.

Knowledge is discovery-required for the named handoff research repositories
until durable current-repo mappings are found or added.

## Evidence vs provenance

Provider provenance says:

> this subsystem integrates this external service/model at these paths.

Runtime evidence says:

> this specific observation came from this provider at this time and passed
> these checks.

The two must never be collapsed.

REF-PROV-02 therefore does not replace subsystem evidence envelopes, source
manifests, observation timestamps, content hashes or authority gates.

## Acceptance criteria

REF-PROV-02 is complete when:

1. major live external provider boundaries are represented;
2. model/design references are distinguished from live provider integrations;
3. Music and Justice static reference catalogs are captured without code claims;
4. handoff-only references remain unresolved rather than promoted;
5. unresolved handoff references can still be assigned to subsystem coverage;
6. deterministic coverage reporting exists;
7. unknown-license debt remains visible;
8. no reference record or coverage status grants runtime/factual/policy/execution authority.

## Next

**REF-PROV-03 — Source Revision + License Verification**

For each repository/library/model reference with unknown licensing or an
unresolved canonical locator:

`resolve upstream → pin revision/version → verify license evidence → record
source digest → upgrade or reject mapping`

Provider/API references should additionally capture documentation/version
anchors where the external contract is versioned.

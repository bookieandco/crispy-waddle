# Ad Creative / Director / Experiment Audit — 2026-09-22

## Goal

Turn a product, creative idea, reference media and market evidence into:
1. original platform-specific ad concepts;
2. Director-produced assets with locked product/style identity;
3. controlled creative variants;
4. statistically/economically evaluated experiments;
5. first-party learning that improves future briefs without silently rewriting creative truth.

## Existing strengths

Growth already had:
- competitor-ad observations separated from inferred patterns;
- research-backed Meta concepts with explicit product truth;
- creative evidence ranking;
- paid-social diagnostics;
- binary creative A/B testing with minimum exposure/conversion gates;
- significance, minimum relative lift and contribution-economics checks;
- attribution/evidence health gates before first-party learning;
- Social Content Projects and governed publication.

Director already had:
- Social -> Director production briefs;
- generation/review/provenance lineage;
- product/character continuity primitives;
- multimodal QC and deterministic media review.

## Gaps closed in this batch

### Product Identity Bible
`commercial-creative-lab.ts`

A product ad can now bind:
- canonical product/variant identity;
- owned/approved front/back/side/detail/in-use references;
- exact label close-ups as text authority;
- dimensions/proportions;
- immutable visual traits;
- product-claim evidence;
- rights evidence.

A visually attractive generation fails QC when packaging geometry or label text drifts.

### Product-sheet bootstrap
`product-reference-bootstrap.ts`

One owned product reference can seed:
- normalized hero/front/back/left/right/top/bottom/detail/in-use views;
- exact-label closeups;
- geometry evidence;
- best-of-N selection.

Identity, geometry and label accuracy are scored separately; generic quality cannot compensate for identity drift.

### Visual Style Bible
`commercial-creative-lab.ts`

A lookbook/style block can be represented as:
- reference assets + hashes;
- lighting rules;
- palette rules;
- lens/camera rules;
- texture rules;
- forbidden drift.

This keeps a campaign visually coherent without turning one style into a global Jhadina aesthetic.

### Platform creative profiles
`platform-ad-creative.ts`

Platform/placement differences are now configuration/evidence rather than universal assumptions:
- allowed aspect ratios;
- runtime range;
- hook deadline;
- safe-area refs;
- platform-native notes;
- source refs;
- observation/expiry dates.

Time-bounded profiles fail closed when stale.

### Ad multiplier / creative variants
`commercial-creative-lab.ts`

Director can multiply an approved creative along explicit axes:
- product variant;
- character;
- hook;
- opening shot;
- CTA;
- platform format;
- visual treatment.

Replacement evidence and rights are required. Single-axis experiment plans may not silently combine unrelated changes.

### Exact Director artifact lineage
`ad-creative-lineage.ts`

Every experiment variant carries:
- Content Project ID;
- concept ID;
- platform;
- product/style identity refs;
- declared mutation axis/ref;
- fixed-dimension refs;
- Director project ID;
- Director artifact ID;
- artifact SHA-256;
- optional stage/review refs;
- evidence refs.

An isolated experiment fails if a fixed creative dimension changes.

Multiple treatment tests automatically use pairwise binary experiments with alpha divided across treatments.

### Social -> Director -> Social lineage
The Social production brief now optionally carries:
- product identity;
- style identity;
- platform creative profile;
- experiment variant ID;
- mutation axis;
- fixed-dimension refs.

The approved Director receipt echoes those fields, and Social asset evidence records them.

### Commercial creative QC
Director evaluates:
- product identity;
- label accuracy;
- style continuity;
- story clarity;
- hook clarity;
- claim/benefit support;
- visual artifacts.

A cinematic ad is not accepted merely for looking cinematic.

## Creative principles from the supplied ad workflows

### Concept first
Creative concept is upstream of generation.

AI may expand, visualize, test and iterate a concept, but a generic model response is not treated as validated creative strategy.

### Platform context matters
A single ad treatment is not assumed to be appropriate across all placements.

Profiles are evidence-backed and updateable rather than hard-coded as permanent platform laws.

### Hooks / comedy / trends
Scroll-stoppers, humor, trend remixes, demonstrations and story are creative techniques/hypotheses.

They are not encoded as guaranteed virality rules.

### Competitor inspiration
Competitor observations may support pattern hypotheses.

Jhadina must not copy competitor layouts, copy, logos, frames or protected media unless rights permit reuse.

### Product consistency
Product geometry and exact labels are authoritative constraints.

For close-ups, exact label reference assets are stronger evidence than a general product prompt.

### Ad multiplier
A successful structure can produce controlled derivatives, but each derivative preserves lineage and rights.

For causal A/B learning, one meaningful variable changes at a time.

## A/B Testing with Machine Learning reference

Reference:
`sayakpaul/A-B-testing-with-Machine-Learning`

Useful contribution:
- Python implementation of an A/B/ML tutorial;
- useful reminder that experiment data can be analyzed with downstream ML/covariates.

Disposition:
- concept/reference only;
- no LICENSE file was found in the repository during this audit;
- no code was copied into Jhadina.

Jhadina's existing experiment layer is stronger for production use because it keeps randomized experiment assignment as the causal evidence source, while ML/covariate rows remain advisory.

## Canonical flow

```
product truth + owned product refs
+ brand POV
+ customer/organic/competitor evidence
+ human creative concept
        |
        v
Growth research-backed concept
        |
        +--> PlatformCreativeProfile
        +--> Product Identity Bible
        +--> Visual Style Bible
        |
        v
Social Content Project
        |
        v
Director production brief
(product/style/profile/experiment identity locked)
        |
        v
generate / edit / review
        |
        v
approved Director artifact + SHA + review
        |
        v
Social asset
        |
        v
governed publication
        |
        v
impressions / clicks / conversions / spend / contribution
        |
        v
evidence-health gate
        |
        v
A/B assessment
        |
        v
first-party creative evidence
        |
        v
next brief: preserve validated signals, test one meaningful change
```

## Invariants

- Creative research never authorizes spend or publishing.
- Competitor patterns are hypotheses, not proof.
- Product/style identity is explicit and hash/evidence backed.
- Director artifact identity survives into experiment evidence.
- A/B tests cannot call multi-variable creative drift a clean single-axis result.
- Statistical lift alone is not enough; contribution economics must also pass.
- Unhealthy attribution data cannot become creative learning.
- Learning informs future proposals; it does not directly mutate canonical Director project truth.

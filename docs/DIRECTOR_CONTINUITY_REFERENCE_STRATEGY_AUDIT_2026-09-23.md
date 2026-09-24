# Director Character & World Continuity Strategy Audit — 2026-09-23

## Source-derived problem

AI story generation can preserve a character in one shot and still drift across angle changes, wardrobe changes, style changes, dialogue, environments, or large camera moves.

The supplied workflows demonstrate several practical controls:

- build a reusable character sheet instead of re-describing the face every shot;
- use one high-detail face close-up as the canonical face source;
- keep full-body panels useful for body/silhouette/wardrobe while avoiding competing face detail;
- lock character voice with a reusable voice reference;
- use environment references as explicit ingredients instead of asking the model to rediscover the world;
- generate/extract multiple environment angles into a reusable view pack;
- animate storyboard panels in small batches rather than overloading one generation;
- use first + last frame anchors for large continuous motion;
- chain approved prior shots when exact composition/world continuity matters;
- treat wardrobe and art-style changes as separate approved character variants/sheets.

## Architecture added

`continuity-reference-strategy.ts` adds a Director-owned strategy layer above the existing Cast Bible, Voice Identity, reference manifests, storyboard boards and provider adapters.

### CharacterIdentitySheet

A sheet now separates:

- canonical high-detail face identity;
- faceless front/back body anchors;
- wardrobe/style variant lineage;
- locked identity traits;
- silhouette traits;
- color traits;
- neutral-background / neutral-lighting evidence.

The validation rule is intentionally strict: only one panel may provide the canonical face. Body panels that also contain a competing face fail validation.

Non-base wardrobe/style sheets require a parent sheet. Style sheets require silhouette and color carry traits because photoreal facial detail may no longer survive a stylization.

### EnvironmentViewPack

Environment continuity is represented as a canonical environment plus approved views.

Views may be:

- authored;
- burst-extracted;
- chained.

Derived views must point back to parent assets and carry evidence. When many camera angles are requested, Director requires a burst-extracted view pack rather than assuming the generator will independently reconstruct every direction.

### VoiceContinuityReference

Voice continuity may use:

- an audio sample;
- a provider voice identity;
- a black-video wrapper whose useful payload is audio.

Generation routing now distinguishes video used as **voice transport** from video used as **visual/motion control**. A black-screen MP4 tagged as audio therefore does not force video-to-video capability.

### Large-motion continuity

For large camera/character movement, the strategy requires:

- first-frame anchor;
- last-frame anchor;
- single-continuous-shot intent.

This lets providers interpolate the authored transition while Director preserves the endpoints.

### Storyboard continuity batches

Storyboard reference frames are split into batches of at most four panels. The batch limit is a Director contract rather than an implicit prompt convention.

### Chained-reference fallback

When exact composition control or prior-shot continuity is requested, Director includes approved prior-shot references as explicit composition parents instead of re-creating the next shot from text alone.

## Runtime path

```
Cast / Voice / Environment references
  -> planContinuityStrategy()
  -> ContinuityStrategyPlan
  -> ordered GenerationReferenceManifest
  -> TakeRequest.continuityStrategy
  -> [CONTINUITY STRATEGY] prompt section
  -> [REFERENCE MANIFEST] prompt section
  -> GenerationPlanAdapter
  -> provider references with preserved semantic roles
  -> continuity QC
```

A caller does not need to manually duplicate the strategy's manifest into `TakeRequest.referenceManifest`; take compilation and provider submission derive it automatically.

## Character bootstrap change

When both a close-up and a body reference exist, `planCharacterReferenceBootstrap` now prefers the close-up as the canonical upload. A full-body source remains a fallback when no close-up is available.

## QC authority

`evaluateContinuityQc` scores evidence for:

- face identity;
- body silhouette;
- wardrobe;
- style;
- voice;
- environment;
- first-frame match;
- last-frame match.

Vision/audio models provide observations. Director remains the deterministic admission authority.

## Invariants

1. Locked recurring characters are never re-invented from text alone.
2. Character face, body silhouette, wardrobe and style are separate continuity dimensions.
3. Wardrobe/style changes create approved variants rather than mutating the identity prompt.
4. Voice references remain voice references even when transported in a video container.
5. Environment continuity is evidence-backed across angles.
6. Large motion requires endpoint anchors.
7. Storyboard continuity batches contain no more than four panels.
8. Chained references preserve provenance rather than silently inheriting random prior generations.
9. Providers execute continuity controls; they never become the canonical identity authority.

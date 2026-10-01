# Music Restoration Competitor Convergence — 2026-10-01

## Decision

Use two repositories with one production authority:

- `bookieandco/music-restoration-intelligence` = research, benchmark corpus, competitor capability evidence, experiment results.
- `bookieandco/crispy-waddle` = canonical production runtime, policy, persistence, DSP execution, QC, export, certification.

Production must not directly fetch arbitrary private-repository audio during restoration. Benchmark sources are ingested through the normal authenticated Music Restoration ingest path so SHA-256, artifact lineage, ownership scope, storage, and receipts remain canonical.

## First benchmark

`MUSIC-RESTORE.AB-001 — No Good`

Research locator:

`repo:bookieandco/music-restoration-intelligence@d282ec4994a821e02c0b3a93082630aea549114e:No good.mp3`

The production SHA-256 is intentionally pending until the actual bytes pass through canonical ingest.

## What current production already has

- immutable/hash-bound source artifacts;
- durable restoration cases and versions;
- Demucs separation;
- measured source/stem perception;
- conservative same-source vocal repair;
- vocal identity preservation QC;
- instrument donor assessment and reconstruction;
- residual-source blending and bounded fades;
- mastering metrics/types for LUFS, LRA, peaks, crest factor, stereo correlation, spectral centroid/bands;
- DAW/stem export;
- fail-closed FINAL certification;
- damage vocabulary that already names click/crackle/pop/hum/hiss/spectral-hole/excess-reverb/wow/flutter/phase/timing defects;
- adapter capability vocabulary that already names dehum, spectral-repair, timebase, phase, tape-simulation, and reconstruction.

## Verified convergence gaps

### Contract/runtime mismatches

1. `spectral-repair` exists in the Music Core operation/capability vocabulary but is not an admitted worker executor.
2. `dehum` exists as a restoration capability but no production worker executor is bound.
3. `timebase` / wow / flutter exist in the evidence vocabulary but no production detection/correction adapter is bound.

### Missing specialized analysis/execution

- learned spectral noise-print denoise instead of only a bounded noise-floor value;
- click vs pop vs thump vs crackle vs digital-discontinuity classification;
- time-frequency damage masks;
- contextual donor search + before/after weighting for local spectral replacement;
- de-reverb / discrete echo-reflection analysis;
- band-limit detection + bandwidth/spectral recovery;
- selectable Mid/Side repair;
- stem-sensitivity / attribution control with recombination/null-error certification;
- drifting tonal-ridge tracking for tape/timebase evidence;
- tape hiss / rumble / analog-transfer source-recovery path.

### Missing evaluation/QC depth

- genre/reference tonal-balance envelopes;
- band-limited crest factor;
- pairwise + cumulative masking graph;
- platform/codec/mono/small-speaker translation simulation;
- automatic loudness-matched blind A/B aliases;
- delta audition;
- formal meter-vs-listener disagreement memory.

### Missing vocal intelligence

- reference-vocal target profile;
- pre-compression phrase/word leveling analysis;
- non-tonal event classification so breaths/sibilance/mouth events do not incorrectly drive level decisions;
- harmonic/F0-relative EQ evidence.

## Milestone order

### MUSIC-RESTORE-CONVERGENCE.0 — Runtime commissioning

Keep the existing RunPod commissioning blocker separate and fail closed.

Exit requires the existing Music Restoration health path to become production-ready and one real case to traverse ingest → separation → perception → governed repair/reconstruction → durable QC/version receipt.

This remains a deployment prerequisite for a real end-to-end `No Good` certification, but it does not block unit-level implementation of the stages below.

### MUSIC-RESTORE-CONVERGENCE.1 — Benchmark contracts

Add typed production contracts for:

- benchmark case;
- external render provenance;
- blind alias;
- objective metric snapshot;
- subjective listening result;
- delta artifact;
- benchmark conclusion.

Do not create a live runtime dependency on the research repo.

### MUSIC-RESTORE-CONVERGENCE.2 — Objective A/B harness

Implement:

- time alignment;
- loudness/gain matching;
- deterministic blind aliases;
- whole-track + region-loop manifests;
- delta render generation;
- LUFS/LRA/true-peak/crest;
- stereo correlation/width/phase;
- transient and spectral drift;
- existing vocal-preservation reuse.

No automatic "winner" from one metric.

### MUSIC-RESTORE-CONVERGENCE.3 — Deterministic repair gap closure

Implement the missing worker operations first:

1. learned noise-print analysis + conservative denoise candidate;
2. dehum fundamental/harmonic detector + bounded executor;
3. true local spectral-repair executor with contextual donor evidence;
4. impulse taxonomy and specialized click/crackle policy.

Prefer deterministic/same-source repair before neural reconstruction.

### MUSIC-RESTORE-CONVERGENCE.4 — Spatial/source-recovery repair

Implement:

- Mid/Side-selective repair;
- excess-reverb / echo-reflection analysis;
- de-reverb candidate path;
- band-limit detection;
- spectral/bandwidth recovery as `SOURCE-RECOVERY`, never authenticated original content.

Receipts must mark reconstructed high-frequency material as reconstructed.

### MUSIC-RESTORE-CONVERGENCE.5 — Analog tape/timebase

Implement analysis first:

- stationary vs drifting hum;
- tonal-ridge tracking;
- wow/flutter/timebase confidence;
- rumble;
- tape hiss;
- azimuth/channel-delay evidence where measurable.

Only correct timebase after multiple evidence channels corroborate it. A drifting hum line alone is not sufficient authority.

### MUSIC-RESTORE-CONVERGENCE.6 — Stem attribution integrity

Add:

- adjustable attribution/sensitivity evidence;
- ambiguous-energy accounting;
- stem recombination render;
- null/residual error measurement;
- leakage matrix.

Changing sensitivity must redistribute evidence, not silently delete program material.

### MUSIC-RESTORE-CONVERGENCE.7 — Vocal intelligence

Add:

- same-source/session/reference vocal profile;
- phrase/word level map;
- breath/sibilance/mouth-event classifier;
- harmonic-follow/F0-relative spectral evidence;
- reference-distance QC.

Creative harmony/persona generation remains in production/creative tooling, outside archival restoration.

### MUSIC-RESTORE-CONVERGENCE.8 — Mix/translation QC

Add:

- tonal-balance envelopes;
- band-limited low-end crest factor;
- pairwise/cumulative masking graph;
- translation renders: mono, phone/small-speaker bandwidth, lossy codec, streaming-normalized;
- post-restoration finishing evaluation without allowing mastering to hide restoration damage.

### MUSIC-RESTORE-CONVERGENCE.9 — No Good real canary

The real-song path is split into evidence, render and promotion authority rather than
letting a pre-render QC assertion certify its own output.

1. the exact private benchmark workflow is authenticated with GitHub OIDC using
   repository id, owner id, `main` ref, workflow file and dedicated audience;
2. `No good.mp3` is extracted from the pinned research commit, SHA-256 hashed by
   the workflow, and uploaded only through a short-lived signed private Storage URL;
3. production re-downloads the staged bytes and independently verifies size +
   SHA-256 before canonical ingest;
4. the canonical `atwood-bookie` owner is resolved server-side and must be unique;
   the workflow cannot claim or supply a user id;
5. canonical ingest, four-stem separation, source/stem perception, source-recovery,
   stem integrity, vocal intelligence and translation QC run before repair selection;
6. the automatic canary may trial only strongly evidenced stationary mains-family
   hum or strongly evidenced band limitation. Ambiguous defects abstain;
7. trial rendering uses `render-only` authority. It can create an immutable output
   artifact for measurement but can never create a restoration version;
8. source and rendered output are re-analyzed. Promotion is reconstructed only from
   measured post-render QC. Translation regressions, geometry changes, missing repair
   effect or provenance violations block promotion;
9. spectral recovery remains explicitly `source-recovery` + `reconstructed`; it is
   never represented as authenticated original program material;
10. the staging object is deleted on every execution exit;
11. human review remains a separate authenticated step and FINAL remains false until
    the reviewed output satisfies the existing FINAL certification contract;
12. externally produced competitor renders are then ingested with exact provenance,
    blind/level/time aligned, delta-auditioned and scored with objective and subjective
    evidence kept separate.

An honest `abstained` canary is evidence that the source did not meet the automatic
repair threshold; it is not converted into a fake repair merely to satisfy a checklist.

### MUSIC-RESTORE-CONVERGENCE.FINAL — Promotion/certification

A capability is production-complete only when:

- analysis identifies a real defect with evidence;
- the worker actually executes the admitted operation;
- output is immutable and hash-bound;
- QC checks relevant conservation dimensions;
- failure/abstention paths are tested;
- a real fixture proves the path;
- benchmark results are recorded without rewriting history;
- FINAL certification remains fail closed.

## Diagnostic router

The target router is explicit rather than "AI enhance":

```text
localized glitch/spectral hole -> spectral repair
stationary broadband noise    -> learned denoise
hum/buzz                      -> dehum
click/pop/thump/crackle       -> impulse repair
excess reverb                 -> de-reverb candidate
discrete speech reflection    -> echo/reflection path
band-limited source           -> spectral recovery
wow/flutter/time drift        -> timebase analysis/correction
damaged vocal                 -> vocal restoration
damaged instrument event      -> donor/reconstruction path
no proven defect              -> preserve/no-op
```

## Benchmark principle

Objective measurements and listening preference remain separate evidence streams.

If Jhadina improves a metric but listeners prefer the competitor, record the metric blind spot.
If listeners prefer a more destructive render, record that preference without relabeling the destructive change as authentic restoration.
If no repair beats the source, preservation/no-op wins the process decision.

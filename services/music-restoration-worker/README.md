# Music Restoration Worker

Private compute runtime for `MUSIC-RESTORE.1` through `.4`.

This worker is deliberately narrower than Music Core. It does not choose a repair, approve a repair, mutate provenance, or decide that output quality is acceptable. Music Core owns those decisions. The worker only:

- probes an immutable source with FFprobe;
- separates a source into vocals / drums / bass / other with pinned Demucs;
- derives tempo, beat, conservative downbeat/section, transient, spectral and vocal observations with librosa;
- executes an allow-listed deterministic repair operation after an authorization id is supplied, including learned denoise, bounded dehum, and localized spectral repair;
- returns hash-bound runtime receipts and named output artifacts.

## Security boundary

Set:

- `MUSIC_RESTORATION_WORKER_TOKEN` — optional static bearer fallback for local/manual deployments. Production Jhadina uses pinned Vercel OIDC instead.
- `MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES` — comma-separated HTTPS host suffixes allowed for signed source URLs. Default: `.supabase.co`.
- `MUSIC_RESTORATION_OUTPUT_DIR` — persistent scratch/output directory. Default: `/data/music-restoration`.
- `MUSIC_RESTORATION_DEMUCS_MODEL` — admitted Demucs model. Default: `htdemucs`.
- `MUSIC_RESTORATION_DEMUCS_DEVICE` — `auto`, `cpu`, or `cuda`. RunPod commissioning uses `cuda` and health fails closed if CUDA is unavailable.

Source URLs are staged by a network-only module. The staged file must match the requested SHA-256 before it reaches FFmpeg, Demucs, or librosa. Compute code itself has no source-download logic.

## Endpoints

- `GET /health/live`
- `GET /health`
- `POST /v1/probe`
- `POST /v1/separate`
- `POST /v1/perceive`
- `POST /v1/analyze/source-recovery`
- `POST /v1/analyze/stem-integrity`
- `POST /v1/analyze/vocal-intelligence`
- `POST /v1/analyze/mix-translation`
- `POST /v1/execute`
- `GET /v1/jobs/{job-token}/artifact/{name}`

The artifact route only serves `vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`, or `output.wav` from the worker-managed job directories.

## MUSIC-RESTORE.6 vocal restoration

`POST /v1/vocal/restore` performs conservative **same-source localized vocal
correction** on a persisted vocal stem. It does not synthesize a singer or
replace a vocal with a generated voice.

Each requested region:

- is bounded and non-overlapping;
- uses only `denoise`, `declick`, `declip`, conservative EQ, or conservative gain;
- retains an optional small amount of the untouched source for room/bleed continuity;
- crossfades the corrected copy back into the exact original timeline;
- preserves source duration, sample rate and channel count.

After rendering, the worker compares source and output regions using voicing,
median F0, F0-spread/vibrato proxy, spectral centroid, RMS and harmonicity.
Outputs that exceed conservative drift limits are returned with
`preservation.passed=false` and Music Core refuses durable admission.

Phrase/word/syllable/phoneme context can be carried in the governed request for
provenance and future coarticulation-aware repair, but those labels are
supporting evidence only. They do not authorize processing or override the
audio-derived preservation checks.

VoiceFixer remains a separately governed reference/provider candidate. Its
model artifact is still blocked by the repository artifact-admission ledger,
so this runtime does not pretend VoiceFixer is deployed.

## Restoration rules

- Demucs stems are derived evidence, never canonical source truth.
- The downbeat grid is a low-confidence 4-beat phase heuristic and must remain evidence, not authority.
- Vocal F0/activity is generated only when the artifact is explicitly identified as a vocal stem.
- The executor accepts only: `copy`, `gain`, `eq`, `declick`, `declip`, `denoise`, `dehum`, `spectral-repair`, `mid-side-repair`, `dereverb`, `spectral-recovery`.
- Learned denoise may derive its noise floor from an explicitly declared source region; low-confidence noise profiles fail closed.
- Dehum can learn a mains-family fundamental and harmonics from an explicitly declared source region before rendering bounded notches.
- Spectral repair is a local time-frequency interpolation using only declared before/after source context; it is reconstruction evidence, not proof of original missing samples.
- Arbitrary FFmpeg filter graphs are not accepted from callers.
- Output is PCM24 WAV and is independently re-hashed again by Music Core before durable registration.

## RunPod commissioning

Music restoration now runs as a **localhost-only sidecar** on the existing
Director GPU Pod. It is started automatically by
`scripts/director-hunyuan-runpod-bootstrap.sh`.

Runtime layout:

- public `8091` — Director Hunyuan plus the allow-listed
  `/music-restoration/*` proxy;
- public `8092` — Director speaker QC when enabled;
- private `127.0.0.1:8093` — Music restoration sidecar.

Production Jhadina calls:

```text
https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration
```

Canonical RunPod production authenticates with the same short-lived production
Vercel OIDC identity used by Hunyuan. The Hunyuan proxy forwards that
authorization to the localhost-only Music sidecar, so replacement Pods do not
need either `MUSIC_RESTORATION_WORKER_TOKEN` or
`DIRECTOR_HUNYUAN_WORKER_TOKEN`.

The worker still accepts a dedicated static bearer token for manual/private
deployments, and Jhadina's runtime client can reuse a legacy shared Hunyuan token
when one is explicitly configured. Those are fallback paths, not requirements
for canonical production.

The Music bootstrap reuses the RunPod CUDA/PyTorch base through a
`--system-site-packages` virtualenv, stores outputs under
`/workspace/jhadina/music-restoration-output`, stores the Torch/Demucs cache
under `/workspace/jhadina/models/torch`, verifies CUDA, warms the admitted
Demucs model, and binds only to localhost.


### Existing Pod one-command commissioning

For an older already-running Pod that still uses a static Hunyuan bearer token,
the lightweight commissioning script remains available as a legacy migration
helper:

```bash
bash scripts/music-restoration-runpod-commission.sh
```

The script reads the currently running Hunyuan process environment from
`/proc/<pid>/environ` **in memory**, reuses the legacy Hunyuan bearer token for
the localhost Music sidecar when present, pulls current `main`, installs the
updated Hunyuan proxy dependency, starts/replaces the sidecar, then restarts
Hunyuan with the same captured environment. It does not print or persist those
captured secret values. New canonical replacement Pods use Vercel OIDC instead.


## MUSIC-RESTORE-CONVERGENCE.4-.5

`POST /v1/analyze/source-recovery` derives evidence for spatial/source-recovery
and analog-transfer decisions without authorizing an edit. It reports:

- abrupt band limitation and a measured cutoff/confidence;
- reverb-like tail persistence plus discrete echo-delay evidence;
- stationary versus drifting hum;
- a tonal ridge for program material and hum/program relative-drift correlation;
- wow/flutter modulation evidence and a separate timebase confidence;
- rumble, hiss, channel-delay/azimuth and Mid/Side energy observations.

Timebase correction is deliberately **not** admitted in this batch. The receipt
sets `timebaseCorrectionEligible` only when independent hum and program-tone
tracks move together with sufficient confidence; a drifting hum ridge alone
cannot authorize correction.

Three bounded execution paths are admitted:

- `mid-side-repair` — stereo-only, selectable Mid or Side, with an allow-listed
  inner gain/EQ/denoise/dehum correction;
- `dereverb` — conservative decay-tail suppression gated by prior analysis
  confidence and bounded reduction;
- `spectral-recovery` — deterministic harmonic high-band synthesis gated by a
  measured band-limit cutoff.

Spectral recovery is **SOURCE-RECOVERY**. Its receipt marks
`reconstructedHighFrequency=true`, `sourceRecovery=true`, and
`authenticatedOriginalContent=false`. Music Core rejects the result unless the
candidate itself is classified as `source-recovery` with `reconstructed`
provenance.


## MUSIC-RESTORE-CONVERGENCE.6-.8

These endpoints are **analysis/QC only**. They do not authorize or persist an
audio edit.

### Stem attribution integrity

`POST /v1/analyze/stem-integrity` re-sums the supplied stems against the
canonical mix and reports:

- null/residual recombination error;
- sensitivity-dependent ambiguous-energy ratio;
- attribution shares that are normalized back to 100% at every sensitivity;
- pairwise leakage/correlation evidence;
- an explicit `recombinedRenderMeasured=true` receipt.

Sensitivity changes ambiguity evidence only. It never silently discards or
creates stem energy.

### Vocal intelligence

`POST /v1/analyze/vocal-intelligence` derives:

- same-source/session/reference vocal profile measurements;
- phrase-level RMS/gain-map evidence;
- breath, sibilance, and mouth-event preservation cues;
- F0/voicing, harmonicity, and harmonic-follow evidence;
- reference-distance evidence.

An `external-style` reference is always marked
`externalReferenceCannotOverrideIdentity=true`. These measurements can guide a
candidate but cannot redefine the singer.

### Mix / translation QC

`POST /v1/analyze/mix-translation` derives:

- normalized tonal-balance band energy;
- full-range and low-band crest factor;
- pairwise + cumulative stem masking evidence when stems are supplied;
- ephemeral translation simulations for mono, phone bandwidth, small-speaker
  bandwidth, 128 kbps lossy encode/decode, and streaming-normalized playback.

Translation renders are temporary QC fixtures. They never replace the
restoration artifact, and mastering is not allowed to hide a restoration
regression.

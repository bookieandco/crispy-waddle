# Jhadina Music Restoration — canonical completion handoff
*Source reconciliation: 2026-10-07; update evidence with each exact branch SHA.*

## User's required functional outcome

Inside Jhadina's existing Music Restoration Studio, the owner uploads an old recording or chooses an existing case. It authenticates and preserves the exact original bytes and reconstructs **all acoustically recoverable stems**, including an editable synchronized hierarchy: lead voice, ad-libs, doubles, background and harmony parts, drums and individual kick/snare/hi-hat/cymbals/toms, bass, guitar, keys and other instruments. "Unknown" and a residual are first-class outcomes; **never falsely imply every named sound is isolatable in every mix**. An unrepairable guitar, drum or other instrument can be matched against the authentic instrument fingerprint and candidate clean phrases, preferably from the same performance; if none is acceptable, offer separately labeled reconstructed/creative alternatives after explicit user review. The user must audition, co-direct, save multiple versions and export isolated DAW stems, not only a fixed master. Store approved archives in Google Drive/DVC; do not let storage become the compute or transactional authority. Allow local CPU for cheap jobs, authorized cloud GPU only when needed.

## Canonical boundaries and prior-work links

- **Canonical production**: [bookieandco/crispy-waddle](https://github.com/bookieandco/crispy-waddle), package Music Core, private music worker, authenticated Jhadina Web and Restoration Studio. Maintain separate restoration/correction/reconstruction/creative production classes.
- **Research/benchmarks**: [bookieandco/music-restoration-intelligence](https://github.com/bookieandco/music-restoration-intelligence). Its archive of DrumSep, Ultimate Vocal Remover, Spleeter, Stemify, fingerprinting and audio tool ZIPs is *reference material*, not deployed code or provider approval.
- **Existing Homebase Google Drive work**: draft [PR #1139](https://github.com/bookieandco/crispy-waddle/pull/1139) contains scoped DVC assets, Restic, and a personal My Drive/Colab synthetic test. ChatGPT's OAuth and iPhone operator are **not** machine credentials, persistent database, or GPU.
- **Music Restoration legacy**: [PRs #824](https://github.com/bookieandco/crispy-waddle/pull/824), [#825](https://github.com/bookieandco/crispy-waddle/pull/825) instrument reconstruction, [#828](https://github.com/bookieandco/crispy-waddle/pull/828) Studio/DAW, [#829](https://github.com/bookieandco/crispy-waddle/pull/829) certification; convergence [#897](https://github.com/bookieandco/crispy-waddle/pull/897), [#899](https://github.com/bookieandco/crispy-waddle/pull/899), [#900](https://github.com/bookieandco/crispy-waddle/pull/900), [#901](https://github.com/bookieandco/crispy-waddle/pull/901), and production No Good canary [#903](https://github.com/bookieandco/crispy-waddle/pull/903). Do not rebuild their machinery.
- **Benchmarks**: exact private research locator \`bookieandco/music-restoration-intelligence@d282ec4994a821e02c0b3a93082630aea549114e:No good.mp3\`; Party Nites, Butterfly Effect and Bubblegum cases need explicit rights/actual audio baseline verification. The connected Drive **No good.wav is zero bytes**, not a benchmark. Research PR #3 remains a review/commissioning gate.
- **Transcript folds**: RX spectral noise print, clicks, tape wow/flutter, Mid/Side, de-reverb, conservatively selective Music Rebalance; Nectar learned vocal-level/tone controls; Neutron masking; Ozone 11/12 stem-aware finishing, LUFS and loudness translation. EQing an existing stem is **not** separating new sub-stems. Preserve full-mix identity, ambience and transient envelope. Never use imagined original notes to label synthesized sound as recovered.
- **Previously tested research**: Party Nites historical analysis of kick/snare masking and instrument fingerprint quality is useful as benchmark design, but the research README can overdescribe executable code currently absent from its default branch.

## Actual implemented vs proposed/blocked

| Subsystem | Source reality | Production proof |
|---|---|---|
| Immutable source + ownership | Exists on production main | Run real ingest |
| Demucs 4 stems + preservation/QC | Worker exists on production main | Run real song |
| Stem hierarchies / ad-lib taxonomy | Typed data and tests | Ad-lib actual audio model not integrated |
| Deep drum 5+residual | Worker contract and optional CPU CLI on feature branch | Model install + real audio/invariance proof missing |
| Guitar/piano six-stem | Opt-in model flag on feature branch | No model/environment/audio acceptance yet |
| Instrument fingerprint + approved timed replacement | Existing Music Core worker + review service | No automatic family classifier, no donor search API, no full musical QC |
| Same-performance donor ranking | Reviewed identity/provenance score code on feature branch | Needs actual measured donor corpus, region extraction + UI |
| DAW export | Existing REAPER project and Logic import guide; 250 MiB web bundle cap | Nested large multitrack export + listening proof missing |
| Google Drive archived music | Feature branch reuses PR #1139 non-sensitive DVC | Separate machine OAuth/remote-only readback not observed |
| Durable taste/learning | In-memory music perception store | Durable backed learning and human-rated outcomes needed |
| Production worker | RunPod old pod id \`xn73vwwekavcc6\` was reported missing in October 7 recovery. Avoid hard-coded stale proxy. | A safe explicitly authorized worker and healthy production preflight are prerequisites |
| FINAL | Fail-closed certification source exists | Real file, receipt, QC, owner approval and restore proof missing |

## One ordered release program (not competing restoration systems)

**Order of authority:** \`MUSIC-DRIVE.1-.8\` source foundations → \`MUSIC-DEEPSTEMS.1-.10\` → \`MUSIC-RESTORE-HARDEN.1-.9\` → audited \`MUSIC-RESTORE.FINAL\`. Repair live production blockers when they gate a later canary; do not fabricate completion labels.

### MUSIC-DRIVE.1 → .8

1. **.1 DAW manifest/asset source contract**: consume Music Studio's track/version/source identity and hashes.
2. **.2 Local SHA-256 + constraints**: reject empty/duplicate/bad-path/cross-version/symlink inputs.
3. **.3 Owner clearance and classification**: rights attestation, owner approval ID, PUBLIC/CLEARED_NON_SENSITIVE only, no private source by default.
4. **.4 Immutable local staging**: copy source/stem bytes without overwrite, private receipts.
5. **.5 Reuse Google Homebase DVC adapter**: same exact folder/OAuth, no parallel credentials or database.
6. **.6 Controlled push**: live flag + machine authorization + existing DVC approvals; record **command success**, not fabricated remote proof.
7. **.7 Remote-only restore proof**: absent local file, DVC pull and independent byte hash; no destructive DVC cache prune on production.
8. **.8 Studio integration and real archive canary**: select restored case/stems, export big bundles, approved archival status, restore from real Drive and receipt. **Live blocked** by machine OAuth and clearance.

### MUSIC-DEEPSTEMS.1 → .10

1. **.1 Canonical nested stem graph**: root/source → parent stem → sub-stem → event, immutable parent ID, model and hash.
2. **.2 Multi-model registry and quality admission**: keep original Demucs 4; admit six-source \`htdemucs_6s\` behind feature flag and measured review; version/model/license evidence.
3. **.3 Drum decomposition**: after Demucs drums, CPU DrumSep \`cukas/drumsep\` kick/snare/hi-hat/cymbals/toms and float residual, preserving stereo/length; optionally benchmark Hybrid Demucs \`inagoy/drumsep\` separately, never confuse the implementations.
4. **.4 Vocal decomposition**: real extracted lead, doubles, ad-libs, harmonies and backing voices with a separate vocal attribution model, speaker/source evidence and unresolved residual. Existing vocal-layer labels are **not** rendered audio. Candidate models need review/permission and benchmarks.
5. **.5 Instrument separation**: guitar/piano and grouped keys, strings, other instruments with clearly labeled model uncertainty and lineage. Acoustic vs electric guitar requires additional instrument-family evidence.
6. **.6 Audio event/perception**: kicks/snares, notes, phrases, vocal ad-lib regions; preserve source-clock sample alignment and evidence.
7. **.7 Child-to-parent conservation**: sum/float residual, null/phase/leakage, shared event onsets, absence/noise/bleed scoring and no fake constant model confidence.
8. **.8 Studio, MIDI, DAW export**: nested editable tracks, preview/solo/mute, aligned lossless WAVs, markers and where reliable MIDI; chunked/worker exports for large sources.
9. **.9 Drive archive**: approved sources/stems/receipts via the existing DVC route and private encrypted media authority only after separately commissioned.
10. **.10 Real-song proof**: No Good, Party Nites, known multitrack where rights/audio verified; blind A/B and failure labels; not green before listening proof.

### MUSIC-RESTORE-HARDEN.1 → .9

1. **.1 P0 production health/SWLC recovery**: fresh exact main/PR CI, \`/api/health\`, deployment SHA/durable memory, Supabase storage/Auth/RLS and stale RunPod endpoint. Preserve current provider authority.
2. **.2 Existing safe runtime selection**: available trusted existing local/RunPod executor; if missing, a **new billable GPU needs explicit owner approval** and spend limits. Never silently create one.
3. **.3 Auth/compute worker commissioning**: OIDC or scoped private credential; FFmpeg/librosa/Demucs/approved DrumSep and optional GPU/CUDA; measured health receipts, per-model availability and cost.
4. **.4 Real \`No Good\` A/B**: pinned MP3 actual bytes, exact source hash/size, source/stems/perception, bounded repairs, benchmark QC, delta listening, human review and reproducible receipts. Research PR #3 draft gated until proved.
5. **.5 Instrument diagnosis + donor discovery**: **detect/verify** instrument family (especially acoustic/electric guitar), detect repairable vs truly unrecoverable passages; rank authorized, measured same-performance/same-song/session donor audio using existing fingerprint similarity. Model/classification text alone never proves identity.
6. **.6 Sound replacement/reconstruction**: reuse existing \`decideInstrumentReplacement\`/assess/reconstruct, segment-level pitch/tempo/time/phase/gain/ambience match, matched notes/chords, preserving performance identity; candidate A/B; if no suitable authentic donor, abstain or offer **labeled synthesis** with explicit approval; no silent voice identity replacement.
7. **.7 Durable human listening and experiment learning**: case-linked approvals/preference memory, objective vs subjective disagreement, measured postmortem, backed store and repeat-case adaptation; no in-memory-only final.
8. **.8 Director/Music Juggernaut + operator path**: one-shot owner intake, licensed source/output as controlled asset for Director, reels, visualizer, release planning, no automatic public post, automated paid execution or edit of original without approval. Studio upload → separated stem review → repair/replace preview → DAW export must be navigable.
9. **.9 \`MUSIC-RESTORE.FINAL\`**: provenance and rights, upload, calibrated identity diagnosis, layered stems, donor/synthesis distinction, repair-or-preserve, blind listening, outputs and archives all pass, with immutable receipts and rollback. FINAL blocked until **real** end-to-end owner-accepted song test and restore proof.

## Guitar "unrepairable" example (must be genuinely functional)

1. Isolate original song; distinguish guitar from other instruments; if source is ambiguous, request targeted owner review rather than hallucinating classification.
2. Detect localized dropout/clip/band damage or a wrong note; evaluate conservative spectral repair/no-op first.
3. Search clean matching guitar sections of same song/performance, then another authorized take/session; compare **measured** centroid/spread/ratios/transients/harmonicity/dynamics with song tempo/note/chord and stereo environment, retain their receipts.
4. If a candidate passes and owner hears/approves it, render only damaged segment using existing authorized reconstruction runtime; double-check phase/timing and preservation with repaired-only delta, stem/full mix and source comparison.
5. No valid donor: preserve original and mark unrecoverable, or (separately, clearly labeled) propose a creative reconstruction or synthesized guitar. Never market new performance as original preserved sound.

## Final release gate—what "I can use it" means

Owner can access authenticated Music Restoration Studio on production and **upload a real song**, see actual model availability, split parent and recoverable child stems, listen to a broken passage, choose preserve/repair/replacement, audition source/candidate/delta/full mix, approve a bounded revision, export playable verified DAW tracks, and fetch a previously stored version back from approved Drive. All actions must be owner-scoped, hash-proven, finite-cost, reversible, and tested on actual user-owned audio; unreliable sub-stems must abstain honestly.

**Current blockers:** SWLC production health, missing old RunPod pod, approval for any billable replacement GPU, external host Google OAuth, actual model weights and real-song acceptance, ability to perform large transfers safely. Passing unit/contract CI is not production certification.

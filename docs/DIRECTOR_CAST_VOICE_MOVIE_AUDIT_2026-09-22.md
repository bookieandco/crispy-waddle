# Director Cast / Voice / Whole-Movie Continuity Audit — 2026-09-22

## Goal

Support a full movie with recurring characters who remain recognizably the same across:
- scenes;
- wardrobe changes;
- lighting/camera changes;
- age/damage/hair/makeup variants;
- regenerated shots;
- multilingual dialogue;
- unique voices;
- lip-sync/viseme retiming;
- Foley, score and final mix.

## What already existed before this audit

The repo already had meaningful continuity infrastructure:

- `CharacterBehaviorDNA.characterId` with archetype, movement, speech/social behavior and cross-scene continuity.
- Director `ContinuityLock` includes `character`, `wardrobe`, `performance`, `audio`, camera/lens/lighting/composition/color/location.
- `TakeRequest` carries stable `takeId`, `referenceCharacterIds`, `referenceAssetIds` and continuity locks.
- Generation plan adapter converts `referenceCharacterIds` into character reference controls.
- Shotlist `Entity` provides stable IDs and `lockedTraits`; `ReferenceAsset` links approved visual references to the entity.
- Character replacement accepts approved character tracks, replacement identity assets and `continuityRef`.
- Studio rig/physics operate on stable `characterAssetId`.
- Studio voice sync supports lip/phoneme/viseme timing and optional `characterTrackId` + `continuityRef`.
- Existing generation catalog contains a character-LoRA template for identity consistency.

These are strong primitives, but they were request/runtime scoped rather than a complete persisted cast registry.

## Critical gap found

There was no durable Supabase `director_character_*` or `director_voice_*` schema.

Therefore the repo could ask generators to preserve character identity, but it could not yet guarantee that Scene 3 and Scene 47 resolve through the same canonical:
- visual identity;
- approved outfit/appearance variant;
- behavior DNA;
- rig;
- voice identity;
- multilingual voice variant;
- consent/rights record.

## Landed from this audit

### `cast-bible.ts`

Adds one canonical Director-owned character identity:
- project + stable `characterId`;
- immutable `continuityRef`;
- base appearance + approved wardrobe/age/damage/hair/makeup/environment variants;
- approved reference assets + digests;
- behavior DNA/rig refs;
- locked physical traits;
- canonical voice identity reference.

A wardrobe change is a variant of the same character, not a new identity.

### `voice-identity.ts`

Adds provider-neutral voice identity:
- one canonical voice per character;
- owned/consented/designed/preset source;
- consent ref;
- multiple reference samples and transcripts;
- exact audio hashes + rights refs;
- multiple provider bindings;
- multiple language variants;
- accent policy per language;
- pronunciation lexicon refs;
- provider selection without changing speaker identity.

### `movie-audio-bible.ts`

Adds movie-scale score continuity:
- reusable themes/motifs;
- stems;
- instrumentation;
- scene cue bindings;
- cue intensity;
- dialogue-priority flag;
- loudness targets for dialogue/music/Foley and final peak.

Existing Foley generation and mix-safety contracts remain the per-event/per-layer execution path.

### Persistence migration

`20260922223000_director_cast_voice_audio_bibles.sql`

Adds repo-side schema for:
- characters;
- approved appearance variants;
- voice identities;
- voice reference samples;
- provider bindings;
- language variants;
- score themes;
- scene score cues.

Not applied live during this audit. It is gated on CI/schema review.

## Voice reference audit

### Voicebox — strong workflow/provider reference

Useful concepts:
- durable voice profiles;
- multiple samples per profile;
- language tags;
- original generation preserved;
- regenerated takes/versions;
- source lineage;
- long-form chunking;
- multi-voice Stories timeline;
- REST + MCP integration.

Repo license: MIT.

Recommended use:
- profile-management UX/reference;
- optional local voice provider/orchestrator;
- do not make Voicebox profile IDs the canonical Director identity.

### Qwen3-TTS — strong multilingual cloning provider

Verified capabilities:
- 10 major languages;
- voice cloning from reference audio + optional transcript;
- reusable clone prompt/speaker representation;
- CustomVoice;
- Voice Design;
- natural-language delivery control.

Repo license: Apache-2.0.

Recommended use:
- primary high-quality local multilingual provider for its supported languages;
- bind its reference/speaker representation to a Director `VoiceProviderBinding`.

### VoxCPM2 — especially strong movie-dubbing candidate

Verified repo claims:
- 30 languages;
- controllable cloning;
- reference audio + transcript “ultimate” cloning mode;
- context-aware prosody;
- 48 kHz output;
- Apache-2.0 code/weights described as commercial-ready.

Recommended use:
- broad multilingual fallback/primary dubbing provider;
- especially useful where Qwen3-TTS language coverage is insufficient.

### Amphion — strong research/evaluation/conversion layer

Useful capabilities:
- TTS;
- voice conversion;
- accent conversion;
- timbre/style separation;
- speech/singing editing;
- evaluation metrics.

Repo license: MIT, but individual model/checkpoint/dataset licenses must still be checked separately.

Recommended use:
- voice/accent/style conversion;
- speaker-consistency evaluation;
- optional singing/music-character workflows.

### voice-pro — workflow reference, not core dependency

Useful ideas:
- multilingual cloning;
- translation/dubbing UI;
- subtitle/transcription workflows;
- multiple TTS backends.

Repo license: GPL-3.0.

Recommended use:
- reference or isolated optional adapter;
- avoid importing GPL code into permissively licensed Director core unless that licensing choice is intentional.

## Whole-movie target architecture

```
Movie Project
  -> Cast Bible
      -> Character ID
      -> locked base appearance
      -> approved wardrobe/appearance variants
      -> behavior DNA
      -> rig
      -> Voice Identity
          -> reference samples + rights/consent
          -> language variants
          -> Qwen / VoxCPM / Voicebox / Amphion provider bindings
  -> Script / Scenes
  -> Storyboard / Shotlist
  -> Generate multiple takes
  -> Jhadina multimodal observation
  -> Director best-take selection
  -> Workstation multitrack edit
  -> dialogue generation / ADR / multilingual dub
  -> lip/phoneme/viseme sync
  -> Foley event plan + generated/recorded Foley
  -> Movie Audio Bible score cues + stems
  -> final mix
  -> render
  -> rendered-frame/audio inspection
  -> QC/review
  -> final approval
```

## Key invariant

**Character identity belongs to Director, not to any image/video/TTS provider.**

Changing:
- outfit;
- language;
- accent;
- delivery;
- camera;
- environment;
- model/provider;
- regenerated shot;

must not create a new character or speaker identity.

Provider IDs are implementations attached to the canonical character/voice record.

## Remaining work

1. Apply and certify the cast/voice/audio persistence migration.
2. Build Director cast repository + project-authority checks.
3. Make every generated take resolve `characterId -> appearanceVariant -> approved refs`.
4. Add voice provider adapters for Qwen3-TTS and VoxCPM2 first.
5. Persist exact voice artifacts, hashes, transcripts, seed/settings and lineage.
6. Add speaker-consistency QC across scenes/languages.
7. Add multilingual translation/adaptation contract so translated dialogue preserves meaning and timing.
8. Feed generated dialogue into existing phoneme/viseme sync.
9. Integrate score themes/cues with Music Core/stems.
10. Add scene-level ADR/regeneration in Workstation so one bad line/shot can be repaired without rerendering the movie.
11. Add final whole-film continuity report: character appearance, wardrobe, voice, language, lip sync, Foley, score, loudness and visual continuity.

## Conclusion

The repo was not starting from zero. It already had character DNA, continuity locks, references, replacement continuity, rig continuity and voice-sync timing. The missing layer was the persistent **Cast Bible + Voice Bible + Audio Bible** that turns those pieces into feature-film continuity.

That layer is now represented in Director core and a repo migration, pending CI/schema certification.


### VibeVoiceFusion — strong multi-speaker orchestration reference, license admission pending

Verified repository capabilities:
- persistent projects and speaker reference samples;
- multi-speaker dialogue editor and narration mode;
- voice cloning from uploaded samples;
- batch generation of 2–20 seeded variations;
- LoRA fine-tuning and selectable LoRA weight;
- queue-based generation/training task management;
- REST API and CLI;
- FP8 plus CPU/GPU layer offloading for consumer GPUs;
- bilingual English/Chinese workflow support.

Director placement:
- good optional local dialogue/ADR provider for scenes with multiple characters;
- good candidate for producing alternate reads that Director can score and select;
- LoRA stays an implementation detail behind a Director `VoiceProviderBinding`;
- VibeVoice project/speaker/session IDs must never replace canonical Director `characterId` or `voiceIdentityId`;
- every output still requires speaker-similarity, intelligibility, prosody, pronunciation, clipping, timing and provenance QC.

Licensing caveat:
- the README displays an MIT badge;
- GitHub repository metadata currently reports `license: null`;
- a root `LICENSE` file was not retrievable during this audit.

Accordingly, Director registers VibeVoiceFusion as `reference-only` with an **UNVERIFIED** license state. It must not enter automatic commercial routing until licensing is explicitly verified.

Recommended future adapter:

```
Director Voice Identity
-> language/provider binding
-> VibeVoiceFusion project/speaker materialization
-> dialogue session
-> N seeded generations
-> ingest WAV candidates
-> Director voice QC/ranking
-> selected dialogue artifact
-> phoneme/viseme sync
-> Workstation dialogue track
```

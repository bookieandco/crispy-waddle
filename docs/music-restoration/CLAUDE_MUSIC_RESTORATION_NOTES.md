# Jhadina Music Restoration — Claude / Transcript Notes

## Purpose

This document preserves the music-restoration architecture developed through the user/Claude audit and implementation workflow. These notes are **evidence and design input**, not autonomous authority. Implementation must still pass repository review, tests, policy, provenance, and QC.

## Core objective

Restore damaged historical recordings while preserving the identity and character of the original performance. The system must be able to reason at song, section, phrase, stem, instrument, event, phoneme, and sample levels.

## Canonical pipeline

`Source Audio → Ingest/Fingerprint → Restoration Case → Calibration → Perception → Damage Assessment → Evidence Retrieval → Restoration Plan → Candidate Generation → Policy Gate → Execution Adapter → Post-Analysis → QC → Conservation Gate → Restoration Version → Export`

## Fundamental principles

1. Never overwrite the canonical source.
2. Analysis is not modification.
3. Evidence is not authority.
4. A restoration plan is not audio execution.
5. Candidate generation must include preservation/no-op.
6. Prefer the least-generative repair that satisfies the objective.
7. Same-recording and same-performance evidence outrank external or generated material.
8. Neural reconstruction is reconstructed material unless separately established as authentic recovery.
9. Restoration, production, and physical simulation are separate operation classes.
10. Every material change is reversible, versioned, attributable, and auditable.
11. Low-confidence or high-risk repairs must abstain or require review.
12. Changes outside a declared damage region require explicit propagation authorization.

## Operation classes

```text
RESTORATION
├── ANALYSIS
├── CORRECTION
├── RECONSTRUCTION
└── SOURCE-RECOVERY

PRODUCTION
├── PITCH-EDIT
├── CREATIVE-FX
├── MIX
└── MASTERING

SIMULATION
├── TAPE-MODEL
├── ROOM-MODEL
└── TRANSFER-MODEL
```

Creative pitch correction, rhythmic gating, compression, saturation, and mastering must never masquerade as archival restoration merely because the result sounds better.

## Evidence hierarchy

```text
Exact original recording region
        ↓
Same physical event / same performance
        ↓
Alternate microphone / multitrack evidence
        ↓
Nearby healthy event from same recording
        ↓
Alternate transfer / same session
        ↓
Same singer/instrument/context
        ↓
Deterministic DSP reconstruction
        ↓
Context-conditioned neural reconstruction
        ↓
Synthetic/external material
```

## Event-level reconstruction

A musical event should carry identity, timing, pitch, velocity, articulation, spectral/transient/decay signatures, stereo/phase/room/bleed context, source region, confidence, and provenance.

Replacement is not simply sample substitution. The Event Reinsertion Engine must account for sample position, musical position, envelope, gain, velocity, phase, stereo position, room, bleed, and neighboring context.

## Vocal restoration

Vocal reconstruction is hierarchical:

`Song → Section → Phrase → Word → Syllable → Phoneme → Audio Region`

Preserve singer identity, phonetic identity, F0 trajectory, vibrato, formants, dynamics, breath, consonants, room, bleed, stereo identity, and natural microtiming.

Lyrics are supporting evidence only; audio evidence remains authoritative.

Phonemes and consonants must not be treated as disposable noise. Coarticulation means a damaged phoneme can depend on its neighboring phonemes and cannot always be reconstructed independently.

## Coarticulation

Model:

`Phoneme(t) + PreviousPhoneme + NextPhoneme + SyllablePosition + WordPosition + PitchContext + DynamicContext + SingerIdentity`

Use separate core and transition regions and preserve C→V, V→C, and C→C transitions. Use the smallest sufficient context and abstain when transition identity cannot be recovered confidently.

## Noise restoration

Noise classification is not noise removal. Noise hypotheses must describe type, time range, channels, frequency range, stationarity, severity, confidence, and evidence.

Preserve historical noise character unless evidence establishes degradation. Protect cymbal decay, vocal consonants, ambience, reverb tails, and musical transients.

Candidate denoising should include no-processing and multiple methods where appropriate.

## Tape and transfer restoration

Separate physical transfer defects from musical performance. Model wow/flutter, timebase, azimuth, channel delay, frequency-dependent transfer effects, tape stretch, bias-related evidence, and generation loss.

Physical tape models can generate hypotheses and controlled tests; they cannot prove what happened historically.

## Stereo / phase / room / bleed

Treat phase, polarity, group delay, stereo geometry, room field, and microphone bleed as evidence-bearing properties of the recording rather than defects to automatically eliminate.

Bleed may be intentional historical character. Separation creates a derivative estimate, not canonical source truth.

## External reference mapping

- VoiceFixer → specialized vocal/speech restoration candidate.
- Sony singer-identity models → singer identity evidence and retrieval features.
- NeuralNote → audio-to-symbolic evidence; transcription is not truth.
- CHOW Tape Model → tape simulation / transfer hypothesis generation.
- DawDreamer → controlled programmatic DAW rendering and plugin graph execution.
- FFmpeg audio mixer → low-level reassembly/mixing adapter.
- DSP theory / wavelet denoising references → deterministic analysis and candidate DSP foundations.
- ACE-Step → high-risk generative reconstruction fallback, never default archival recovery.
- MuseScore → symbolic musical structure/reference, not an audio restoration authority.
- Instrument-identification research → instrument perception evidence, not repair authority.

## QC model

Do not reduce restoration to a single quality score. Evaluate technical integrity, noise change, artifact change, spectral integrity, dynamic integrity, transient integrity, stereo/phase integrity, loudness integrity, musical integrity, and authenticity/conservation.

A candidate should not pass merely because it sounds cleaner or scores better on a generic quality metric.

## Current implementation location

The canonical implementation home is:

`packages/music-core`

The restoration-engine foundation currently contains typed restoration plans/candidates/QC/gating, candidate generation/ranking, and the adapter registry. External repositories remain bounded adapters or references.

## Required future layers

```text
perception/
reconstruction/
dsp/
adapters/
simulation/
execution/
qc/
provenance/
export/
```

The next major implementation requirement is an Evidence Engine and DamageAssessment contract that can explain why a restoration candidate is being proposed before an external execution engine is invoked.

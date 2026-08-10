# Dolby-ready Studio audio

The Studio treats immersive audio as a master/delivery pipeline, not simply a loud stereo export.

## Master

- Preserve original multitrack sources and timing.
- Prefer 48 kHz PCM for video masters; retain higher-rate sources until final delivery when appropriate.
- Keep 24-bit PCM masters where the downstream workflow supports them.
- Preserve channel/object metadata and speaker positions for Atmos sessions.
- Generate a conventional stereo/downmix deliverable alongside immersive masters.

## Atmos deliverables

The Studio should retain an ADM BWF master (or IMF IAB where required) as the authoritative immersive deliverable. A licensed Dolby encoder/delivery tool is required when the target distribution format is Dolby Digital Plus JOC, Dolby AC-4, Dolby TrueHD, or another Dolby delivery codec.

## QC

Before final delivery, verify:

- sample rate and bit depth
- duration and start/end timecode
- video/audio sync
- true-peak ceiling according to the target delivery specification
- integrated loudness according to the target delivery specification
- channel/object count and metadata integrity
- 5.1/5.1.x downmix compatibility
- stereo fold-down availability
- no unintended clipping, missing channels, discontinuities, or silent gaps

Delivery thresholds are profile-driven because Dolby requirements vary by service, platform, and content type.

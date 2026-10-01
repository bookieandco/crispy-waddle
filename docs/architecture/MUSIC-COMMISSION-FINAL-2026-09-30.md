# MUSIC-COMMISSION.FINAL — Atwood Bookie

Status: source implementation for the real Atwood Bookie commissioning path.

## Canonical identity

- Artist: **Atwood Bookie**
- Owner/business identity: **Bookie & Co**
- Canonical hub: **https://solo.to/bookieandco**
- Artist key: `atwood-bookie`

The owner/business identity is deliberately not treated as the performing-artist name.

## Commission sequence

| Stage | Contract |
| --- | --- |
| MUSIC-COMMISSION.1 | Canonical artist identity + duplicate-resistant artist key |
| MUSIC-COMMISSION.2 | Provenance-aware hub/platform-link resolver |
| MUSIC-COMMISSION.3 | Public catalog warehouse seed + durable release/song ingest |
| MUSIC-COMMISSION.4 | Section intelligence; missing timings are queued, never fabricated |
| MUSIC-COMMISSION.5 | Quality-filtered social baseline |
| MUSIC-COMMISSION.6 | Zero-spend internal SEARCH experiment planning + Director-ready creative lineage |
| MUSIC-COMMISSION.7 | Consented fan + city evidence projection |
| MUSIC-COMMISSION.8 | Rights + approved-budget attack gate |
| MUSIC-COMMISSION.9 | Synthetic shadow ATTACK failure/success canary; never written as live evidence |
| MUSIC-COMMISSION.FINAL | Closed-loop Music + Director certification with zero publication authority |

## Public catalog seed

The commissioning seed is deliberately a **verified discovery seed, not a claim of a complete discography**. It uses public release pages for Atwood Bookie and stores those URLs as provenance. Current seed evidence includes Apple Music and Amazon Music release pages for:

- Chairman of the Trap 4
- Ghetto Eloquence
- The Flats at Five Mile Creek
- Sip Slow
- Side Effects
- otr
- Ass Naked
- Tried
- ik
- New Feelin
- ok aight (feat. Cizzle)
- garfieldtracc
- She Started It
- Trains Planes
- goals
- Chairman of the Trap 5
- Ah Ahh Ahh
- Boo Hefner Spring 2022

Tracks are only pre-seeded where a public source exposed the track names. Unknown track listings stay unknown.

## Safety / authority boundary

Commissioning may create internal state, catalog records, experiment plans, analysis queues, and certification receipts.

It does **not**:
- publish publicly;
- spend money;
- increase budgets;
- contact fans as the artist;
- book venues;
- sign contracts;
- grant rights;
- manufacture social proof;
- fabricate section timestamps, fan counts, city demand, rights ownership, or conversion economics.

SEARCH remains the runtime default until replicated, quality-filtered evidence earns ATTACK and all rights/budget/readiness gates pass.

## Final certification meaning

`MUSIC-COMMISSION.FINAL` certifies the closed-loop implementation and its fail-closed behavior. It does not claim that every external provider is connected or that live campaign evidence exists. Live provider readiness is reported separately and missing evidence remains visible rather than being synthesized.


## Music → Director production

Music Juggernaut and Director share a canonical production contract rather than passing an unstructured prompt.

Supported first-class deliverables:

- `lyric_video`: canonical master audio + real timed lyric cues; lyric text/timing is never invented.
- `teaser_pack`: multiple vertical short-form variants cut from verified song-section or timed-lyric ranges.
- `music_video`: scene-based master video with optional artist-reference performance and music lip sync; by default it also creates six linked 9:16 derivative shorts when verified timing ranges exist.
- `visualizer`: master-audio-driven visual treatment when performance/lip sync is not required.

The source-derived workflow is:

`song audio → audio/section intelligence → style references → creative brief → storyboard → scenes/takes → optional performance rehearsal → optional vocal-stem lip sync → edit → derivative shorts → media QC → review → delivery`.

Style frames, artist references, vocal stems, lyrics, source song ranges and Director job IDs remain lineage-bound. A generic video provider is not eligible for a music job unless it explicitly declares music-source capability; timed-lyrics and music-lip-sync jobs require those provider capabilities as well.

The music-aware runtime adapter is configured with `DIRECTOR_MUSIC_VIDEO_PROVIDER_*`. Missing runtime configuration blocks provider execution instead of silently routing the song to an incompatible provider. No Music→Director bridge grants public publishing or paid-generation authority.

## Private royalty evidence

Owner-supplied streaming/royalty snapshots are stored only in owner-scoped RLS tables. The source tree contains normalization and reconciliation logic, not the user's dollar amounts. Service totals tolerate cent-level line rounding, while repeated/variant song labels are grouped for analytics without assuming they are the same recording.

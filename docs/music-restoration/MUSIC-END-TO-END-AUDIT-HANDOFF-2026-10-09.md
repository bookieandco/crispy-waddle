# Jhadina Music — End-to-End Audit + Completion Handoff
**Audit date:** 2026-10-09  
**Canonical production repository:** `bookieandco/crispy-waddle`  
**Canonical research / benchmark repository:** `bookieandco/music-restoration-intelligence`  
**Purpose:** Reconcile the music-related chats, transcript-derived requirements, GitHub references, open PRs/issues, current source reality, and all previously named build sequences into one completion plan. This document does **not** replace existing specialized handoffs; it establishes their execution order and final acceptance boundary.

> **Top-level status:** the music architecture is broad and substantially implemented, but it is **not production-final**. The immediate problem is now convergence/reconciliation, not lack of ideas. Do not merge stale feature branches wholesale, do not create a second Music pipeline, and do not treat source CI as live-audio certification.

---

## 1. Canonical product outcome

The completed Jhadina Music system is one connected loop:

```
authorized source/catalog
→ restoration + deep stems + perception
→ editable DAW/session + versions
→ artist/song/section intelligence
→ Artist World + audience intent + creative memory
→ Director music/video/commercial production
→ weekly owner-approved Social/paid/owned-audience campaign
→ provider observations + qualified fan yield
→ streams / direct fans / buyers / royalties / live demand
→ kill / iterate / scale-next-test
→ Jhadina cross-portfolio learning
→ next song / next creative / next market decision
```

For Atwood Bookie, the canonical identity remains:

- **Artist:** Atwood Bookie
- **Owner / business identity:** Bookie & Co.
- **Canonical public hub:** `https://solo.to/bookieandco`

No subsystem may silently overwrite another subsystem's authority.

---

## 2. Repository authority — keep both repos, do not merge histories

### 2.1 `bookieandco/crispy-waddle` — sole production authority

Owns:

- owner Auth / RLS / durable state
- Music Core
- Music Restoration worker contracts
- Restoration Studio
- DAW/editor
- Director integration
- Music Juggernaut
- Social/Growth bridges
- paid-growth governance
- fan/CRM projection
- rights/royalty state
- scheduler/action authority
- production certification receipts

Current audited `main` SHA:

`9eaafe85395e85cea779946fca5672a3d413a102`

### 2.2 `bookieandco/music-restoration-intelligence` — research / corpus / benchmark authority

Owns:

- benchmark audio/corpus references
- competitor/reference ZIPs
- analysis-engine research
- No Good / Party Nites research fixtures
- benchmark scripts and read-only provenance evidence
- model/tool evaluation notes

It must **not** become a production runtime, credential store, publication authority, or rights authority.

Current audited `main` SHA:

`a62973a73c88543a2cbdf12b6322476145ff8e5b`

Private/owner audio must not be copied into public production code merely to simplify testing.

---

## 3. Exact current source state

### 3.1 Music Restoration / DAW draft PR #1141

PR:

`bookieandco/crispy-waddle#1141`  
**RESTORE-UNIFY.1-.12 — dual-repo music restoration + Drive, deep stems, MIDI, DDSP preflight and hardening**

Current head:

`a5babc6f13d0e13b335541d838a6750db621c77d`

State:

- open
- draft
- still based on the old Google Homebase feature branch instead of current `main`
- current compare to `main`: **diverged; 168 commits ahead / 210 commits behind**

This branch contains important work that must be preserved selectively:

- deep-stem contracts
- DrumSep parent/child residual logic
- reviewed vocal regions
- Basic Pitch MIDI path
- DDSP admission policy
- DAW editor and browser WAV bounce
- laptop stem bounce
- landscape phone/tablet DAW work
- waveform source verification
- VST3/AU slot/companion work
- Director audio handoff
- Google Drive/DVC archival support
- restoration hardening contracts

**Do not merge #1141 wholesale into current main.**

Latest exact-head CI on #1141:

- Music Restoration Hardening Source Contract — success
- Music Deep Stems source contract — success
- Music Drive source contract — success
- Music Juggernaut Final Certification — success
- Director Targeted Tests — success
- Jhadina Launch Gate — success
- Web deploy conformance / type-check — success
- **Media Production Certification — failure**

The current Media failure is concrete, not conceptual:

`services/music-restoration-worker` tests import NumPy, but the Media CI job did not install NumPy before running those tests. Five worker tests failed with:

`ModuleNotFoundError: No module named 'numpy'`

This must be repaired during reconciliation; it is not a reason to discard the deep-stem work.

### 3.2 Research PR #4

`bookieandco/music-restoration-intelligence#4`  
**RESTORE-UNIFY.1-.3 — pinned No Good / Party Nites research bridge and exact-byte verifier**

Current head:

`9a15ab05d5755c0788d64bcf2e46bea5c7c0dedd`

State:

- open
- draft
- exact research workflow still failing
- latest `Music Restoration Research Bridge` run failed with **zero job steps available**

Therefore exact Git-byte/SHA-256 research provenance is **not yet CI-proven**, even though the source contract exists.

### 3.3 Research PR #3

`bookieandco/music-restoration-intelligence#3`  
**RESTORE-INTEL — No Good production canary workflow**

Current head:

`8cec698c917c7f1d8b295029fb6c3b9a1eecd0cc`

State:

- open
- draft
- no successful current workflow proof
- remains gated until production endpoints and owner-authorized runtime are healthy

### 3.4 Music Juggernaut baseline is merged

Important merged PRs:

- #859 — Music Juggernaut production convergence
- #860 — Atwood Bookie commissioning path
- #865 — restoration → Juggernaut measured-section bridge
- #867 — structural perception convergence
- #964 — MUSIC-AUTO.1-.13 autonomous music runtime/recovery

The codebase already has:

- SEARCH / ATTACK
- songs and section heatmaps
- durable experiments/observations
- restoration perception bindings
- Director production bridge
- Social lineage
- leased/resumable autopilot
- failure/reconciliation state
- fan projection
- rights checks
- bounded paid-growth bridge
- city/live planning
- royalty snapshot persistence
- hourly protected scheduler source

Do **not** rebuild these.

### 3.5 Social Juggernaut is highly relevant but currently unmerged

PR:

`bookieandco/crispy-waddle#1136`  
**SOCIAL-JUGGERNAUT.1-.26 — weekly autonomous social growth OS**

Current head:

`7377b6188a1dc3e4796e2890ed93429234428a58`

Its exact head previously passed:

- Social Core Certification
- Growth Production Certification
- Music Juggernaut Final Certification
- Director Targeted Tests
- Opportunity Core CI
- Jhadina Launch Gate

But the branch is now stale relative to current main:

**168 commits ahead / 212 commits behind**

Do not merge it wholesale. Reconcile only the canonical Social/Growth features required by the music loop.

---

## 4. Current production blockers

### 4.1 SWLC/Supabase remains the P0 durable-runtime blocker

Issue:

`#1110 — P0 — SWLC Supabase disk-full recovery blocks production`

Observed failure:

- Postgres disk exhaustion
- WAL/crash recovery loop
- SQLSTATE 57P03
- Auth/PostgREST/database-dependent commissioning unavailable

Required rule:

- continue source-only work while unhealthy
- do not delete production data
- do not replace durable production memory with ephemeral storage
- do not create a new billable production resource without explicit owner approval

### 4.2 Director durable commissioning is also blocked by SWLC

Issue:

`#1099 — SWLC disk-full blocks Director durable commissioning`

Current main combined deployment status at audit time:

- `crispy-waddle-jhadina-web` — success
- `director-hunyuan` — failure
- `director-phantom` — failure

This means Music cannot truthfully claim automatic Director creative production is commissioned merely because the source bridge exists.

### 4.3 Music Restoration runtime remains blocked

Issues:

- `#822 — AUDIT-REPAIR: RunPod MUSIC-RESTORE commissioning / port 8091-8093`
- `#898 — MUSIC-RESTORE-CONVERGENCE: competitor benchmark + DSP gap closure`
- `#1142 — RESTORE-UNIFY.FINAL — two-repo Music Restoration launch acceptance`

Issue #898 truth matrix remains:

- CONVERGENCE.1-.8 — merged
- CONVERGENCE.0 — live runtime still unresolved
- CONVERGENCE.9 — real No Good canary/competitor renders still not production-proven
- CONVERGENCE.FINAL — not certified

No new paid GPU may be silently created to make this green.

---

## 5. Product requirements recovered from music chats

The following are binding product requirements and must not be dropped during reconciliation.

### 5.1 Restoration

- exact source-byte preservation and provenance
- diagnose before altering
- no-op/preservation is a valid result
- repair before reconstruction
- donor-reconstruction and synthesized/creative reconstruction must be labeled differently
- reconstructed spectral material is not authenticated original audio
- explicit owner review before consequential replacement
- objective QC and listening evidence are separate streams
- human FINAL remains required for real-song certification

### 5.2 Deep stems

Need real, sample-aligned hierarchy where acoustically recoverable:

- source
- vocals
  - lead
  - doubles
  - backing
  - harmonies
  - ad-libs
  - spoken/shout/response/effects
  - residual
- drums
  - kick
  - snare
  - hats
  - cymbals
  - toms
  - residual
- bass
- guitar
- keys/piano/synths
- strings / pads / other instruments
- FX / ambience / residual

Typed labels or time masks are not equivalent to actual acoustic separation.

### 5.3 Instrument fingerprint + repair

For a damaged guitar/drum/instrument:

1. verify actual instrument family or abstain;
2. distinguish repairable damage from unrecoverable performance information;
3. search same-song/same-performance/session donor material first;
4. compare measured pitch/chord/tempo/onset/timbre/phase/room/amp evidence;
5. render only the bounded damaged region;
6. listen in solo, delta and full mix;
7. preserve original if no candidate passes;
8. creative MIDI/VST/DDSP replacement is a separate labeled option.

### 5.4 DAW

Laptop:

- Logic Pro-like working model
- full multitrack arrangement/mixer
- editable separated stems and sub-stems
- waveform editing
- EQ/compression/effects
- VST3/AU/native plugin path
- MIDI / virtual instruments
- buses/sends/sidechains
- automation
- long-form bounce/export
- restoration version history

Phone/pad:

- BandLab-like
- **landscape-first**
- large touch targets
- same project/session
- waveform editing
- stem edits
- quick bounce
- review/approve versions
- no fake desktop plugin hosting on iOS

Exports:

- exact alignment
- sample rate/count/channels
- phase/polarity
- full-length and region+handles/event export
- wet/dry/original/restored/reconstructed states
- DAW-neutral manifest
- REAPER / Logic handoff
- hash/provenance receipts

### 5.5 Director integration

Music and Director must share:

- exact audio/stem asset provenance
- beat/structure recognition
- vocal-only aligned segments for lip sync
- music-video treatment and shot planning
- beat-synchronous cuts
- Foley/SFX/B-roll where appropriate
- sample-clock ↔ frame-clock QA
- existing project merge, not accidental replacement project creation
- owner review before final export/publication

### 5.6 Music Juggernaut / Atwood Bookie growth

The desired loop remains:

`CREATE → TEST → DETECT → REPEAT → ATTACK → CAPTURE → RELATE → CONVERT → MONETIZE → PERFORM → LEARN`

Unknown artists must build attraction/connection before direct promotion.

Success must prioritize:

- qualified attention
- music transfer
- repeat listening
- saves/follows that correlate with listening
- directly reachable fans
- buyers/community/advocates
- attributable revenue
- live-market evidence

Views alone are not success.

### 5.7 Artist World / bond content

Jhadina must learn the Atwood Bookie world, not only content formats:

- story
- recurring themes
- worldview
- humor
- cultural references
- visual language
- clothing/aesthetic cues
- locations
- characters
- rituals/symbols
- album/song mythology
- fan language
- lifestyle/identity signals
- nostalgia and cultural memory

The content system should distinguish audience intent such as:

- fan acquisition
- music discovery
- fan depth
- direct capture
- community
- customer/buyer
- creator-peer
- education

The point is to attract listeners/fans/buyers, not accidentally optimize for other creators admiring the technique.

### 5.8 Social and weekly approval

The user requires:

- mostly automatic operation
- owner can add ideas/campaigns
- one **weekly** comprehensive campaign packet/report
- owner approval of the exact week
- exact profile identity/voice per account
- Director creates corresponding content/commercials
- schedule uses learned niche/platform evidence
- profile-specific relevant public engagement/comments
- owner can add specific accounts to monitor/engage with
- Jhadina may also discover relevant accounts
- comments must remain relevant; no mass spam, fake engagement, or deceptive identity behavior
- post-approval material changes require reapproval

### 5.9 Paid media doctrine

Advertising is an **accelerator, not an initiator**.

Paid should not be used to rescue an unproven offer/content concept.

Required evidence before meaningful paid acceleration:

- organic/shared proof
- clear offer/product
- qualified conversions
- winning creative evidence
- owned destination
- consented capture/nurture path where appropriate
- known unit economics / acquisition ceiling
- relevant audience or provider-native broad/lookalike seed strategy
- controlled one-variable experiments

Paid decisions should:

- A/B test
- kill losing treatment
- preserve evidence
- scale only into the **next approved test**
- never automatically expand spend without the approved weekly budget envelope

### 5.10 PESO / owned audience

Music growth must use:

- **Paid**
- **Earned**
- **Shared**
- **Owned**

Owned audience should be grown deliberately:

- email
- SMS
- WhatsApp where consented
- owned web
- direct community / first-listen list

Platform followers are not equivalent to owned audience.

---

## 6. GitHub/reference donor audit — music + current Social transcript references

These references are **idea / research donors unless separately admitted**. Do not import unsafe growth bots or create duplicate runtimes.

### 6.1 Music / restoration / DAW references

Preserve prior assessment of:

- `Guitariz/Guitariz` — workstation/chord/Demucs UX reference; do not duplicate separator runtime
- `magenta/ddsp` — creative timbre resynthesis reference; requires checkpoint/license/training-rights/benchmark admission
- Spotify Basic Pitch — isolated instrument → MIDI creative path
- DrumSep references — benchmark/admitted only after model/license/real-audio QC
- UVR / Demucs / Spleeter / Open-Unmix — separation references; canonical runtime remains Music worker
- DawDreamer — optional trusted laptop/native companion path; not proof of commissioned VST/AU
- Cakewalk mixer/workstation reference — UX inspiration only
- iZotope RX / Nectar / Neutron / Ozone transcript mechanics — restoration/masking/vocal/translation ideas, not executable authority
- Sony diffusion timbre research — research-only until model/rights/hardware admission

### 6.2 Director music-video references

Previously supplied Director references such as OmniHuman, Open-AI-UGC, ai-avatar-system, MuseTalk, LivePortrait, SadTalker and Coqui TTS should remain behind Director provider/model admission and identity/rights controls. They do not become Music publication authority.

### 6.3 Current Social/viral references

The current Social chat supplied many growth/automation references, including:

- `Spikemumotor/kfebskpv`
- `joeahkim/InstaAddict`
- `fckveza/api-sosmedboost`
- `mvanhorn/last30days-skill`
- `Evil0ctal/Douyin_TikTok_Download_API`
- `rayguo01/viral-x`
- `Gingiris/gingiris-launch`
- `vima-tech/moka`
- `shixinzhang/tiktok-viral-hooks`
- `snowfall6686/ki-social-media-post-generator-deutsch`
- `JabulaniUsen/post-it`
- `ronin1770/reel-quick`
- `sergebulaev/linkedin-skills`
- `darkzOGx/youtube-automation-agent`
- `learnhouse/learnhouse`
- `Deyweaver/DeyWeaver`
- `cporter202/automate-for-growth`
- `getopenpost/openpost`
- `jidouqie/redbeacon`
- `stevenflanagan1/social-ai-team`
- `taisly/agent`
- `ravielakshmanan/viral-marketing`
- `lee101/evangeler`
- `mobileshop9991-star/clipwise-public`
- `Ashwin18-Offcl/Marketing-Techniques`
- `Laird777/hayes-creative`
- `priyadarshankinnarimath12/priyadarshankinnarimath12`
- `swadhin-sikder/social-marketing-agency`
- `groniz-artifacts/how-to-promote-saas-on-social-media`
- `monugourab/inditubedb-social-media-marketing-youtube-channels-guide-2026`

The correct disposition is the same as Social PR #1136:

- absorb useful concepts;
- do not adopt unsafe follower farming, fake engagement, cookie/credential scraping, proxy evasion, mass unsolicited engagement, or UI botting;
- do not create another Social scheduler;
- use Social Core/Growth/Director/Action Core.

---

## 7. Important hidden gaps found by the audit

### 7.1 Recursive creative memory still does not drive future briefs

Current `buildMusicCreativePortfolio()` accepts:

- song
- mode
- winning section
- max briefs

It does **not** accept durable learned creative mechanics.

`music-juggernaut-service.ts` loads `learning` rows but does not feed them into creative portfolio generation.

Therefore MUSIC-AUTO.12 can store learning without meaningfully changing future creative strategy.

This is a major unfinished loop.

### 7.2 Music scheduler still stops before Social materialization

In `music-autopilot-service.ts`, when `schedulerMode` is true, approved Director assets stop before Social proposal materialization and set approval required.

Social PR #1136 now contains the stronger weekly immutable approval/delegation model. Music Autopilot should consume that model rather than invent a second approval system.

### 7.3 Scheduled paid growth still requires an injected `paidProposal`

MUSIC-AUTO.8 can evaluate a supplied canonical paid proposal, but the scheduled worker does not autonomously assemble:

`validated outlier + rights + provider account + approved audience + creative + budget + destination + paid-readiness`

Therefore the loop is not yet fully closed.

### 7.4 Royalty “sync” is mostly evidence readback, not provider import

Royalty importer/snapshot/ledger code exists, but the autopilot stage largely reads the latest durable snapshot rather than reliably ingesting new statements/provider data.

### 7.5 Live-market stage is projection-first, not acquisition-first

Music can reason over existing city/live demand, but live provider/source acquisition still needs commissioning.

### 7.6 Distribution is provider-neutral contract source, not fully commissioned DSP delivery

Current distribution code has adapter contracts for destinations, but it is not evidence of live Spotify/Apple/Amazon/Tidal/Deezer distribution.

### 7.7 Service-level Music Autopilot integration coverage is thin

The domain/state-machine tests are meaningful, but `runMusicAutopilot()` itself still needs stronger end-to-end service-level regression coverage across:

- restoration binding
- Director submission/reconciliation
- weekly Social approval continuation
- paid admission
- fan capture
- royalty/live stages
- learning → next brief

### 7.8 Branch divergence is now a release risk

Both #1141 and #1136 contain valuable work but are far behind current main.

A blind merge risks reintroducing stale infrastructure and overwriting newer Money/Director/Homebase fixes.

---

# 8. Canonical build sequence to finish the whole music system

This sequence **wraps and preserves** the old sequence labels; it does not erase them.

---

## MUSIC-RECONCILE.01 → .06 — repair before adding

### .01 — Freeze exact source inventory

Record:

- current main SHA
- #1141 head
- #1136 head
- research #4 head
- research #3 head
- #822 / #898 / #1110 / #1142 state
- migration overlap
- every file unique to stale branches

**Pass:** no required music file is lost or assumed merged.

### .02 — Rebuild Music Restoration integration from current main

Create a fresh branch from current `main`.

Cherry-pick/reapply only the music/DAW/Drive/Director changes from #1141 that are not already present on main.

Do **not** import stale unrelated Google/Homebase history wholesale.

**Pass:** current-main ancestry + required music changes only.

### .03 — Repair Music source CI

Fix the current Media Certification dependency gap so NumPy-backed worker tests actually run.

Run:

- Music Core type-check/tests
- Jhadina Web type-check
- restoration worker tests
- deep-stem source contract
- Drive source contract
- restoration hardening
- Director audio handoff tests
- Launch Gate

**Pass:** exact-head source CI green.

### .04 — Repair research PR #4 exact-byte CI

Diagnose why the research workflow fails before runner steps.

Prove:

- exact Git blob exists
- non-empty file
- independent SHA-256
- expected size
- rights remain explicitly unverified unless separately attested

**Pass:** research exact-byte receipt is machine-verifiable.

### .05 — Reconcile Social #1136 onto current main

Port only canonical Social/Growth pieces needed by music:

- weekly campaign packet/report
- exact weekly child delegation
- profile identity
- niche/platform learning
- learned scheduling
- profile-voice engagement
- owner-curated account registry
- advertising accelerator/PESO admission
- organic demand + owned audience
- viral campaign intelligence
- paid A/B/ready-buyer/lookalike planning

**Pass:** Social/Growth/Director/Music exact-head CI green on current main ancestry.

### .06 — Issue reconciliation receipt

Produce one source truth matrix:

`present on main / ported / intentionally research-only / blocked live / obsolete`

**Pass:** no old feature branch is needed as a hidden source of truth.

---

## MUSIC-RESTORE-LIVE.01 → .09 — real restoration runtime

Preserves:

- MUSIC-DRIVE.1-.8
- MUSIC-DEEPSTEMS.1-.10
- MUSIC-RESTORE-HARDEN.1-.9
- RESTORE-UNIFY.1-.12
- MUSIC-RESTORE-CONVERGENCE.0-.9

### .01 — Recover SWLC durability

Exit #1110 first for database-dependent production work.

**Pass:** direct Postgres works, not in recovery, disk headroom proven, migrations/advisors usable.

### .02 — Commission one trusted existing Music worker

Prefer existing authorized compute.

If no suitable worker exists, stop for explicit owner approval before new billable GPU capacity.

**Pass:**

- Hunyuan/Music health endpoints 200
- authenticated Music health `productionReady:true`
- actual admitted model list
- cost/runtime receipt

### .03 — Real four/six stem baseline

Run rights-cleared real audio through:

- canonical ingest
- 4-stem baseline
- optional 6-stem model
- exact source/stem hashes
- sample/frame alignment
- recombination/null/leakage QC

### .04 — Real deep drums

Run actual drum parent through DrumSep/admitted model:

- kick
- snare
- hats
- cymbals
- toms
- residual

Require child→parent conservation and listening review.

### .05 — Real overlapping vocal separation

Replace manual time-mask-only proof with actual waveform separation for:

- lead
- doubles
- harmonies
- backing
- ad-libs
- residual

Unknown/unresolved remains valid.

### .06 — Instrument-family + donor repair

Commission calibrated family classification and same-performance/session donor ranking.

Require real guitar positive/negative counterexamples and abstention.

### .07 — Repair / reconstruct A/B

For a damaged passage compare:

- preserve/no-op
- conservative restoration
- authentic donor reconstruction
- creative MIDI/VST/DDSP alternative

Keep provenance explicit.

### .08 — Drive/archive proof

Use approved Google Drive/DVC path:

- real approved audio archive
- remote-only restore
- independent SHA-256 match
- no local-source fallback hidden in the restore

### .09 — Restoration real-song certification

At minimum:

- No Good where rights/authorization permits the canary
- Party Nites or another separately rights-cleared case
- one known permissioned multitrack fixture

**Pass:** owner-accepted blind listening + exact receipts + rollback + DAW export.

---

## JHADINA-DAW-FINISH.01 → .10

Preserves existing `JHADINA-DAW.1-.10`.

### .01 — Port current DAW source onto current main

Keep:

- browser quick dry bounce
- laptop stem bounce
- real waveform peaks
- clip move/split/slip/duplicate
- landscape editor
- revision/CAS project saves
- VST/AU slot contracts

### .02 — Actual FX offline bounce

Render audible:

- EQ
- compression
- delay/filter
- approved restoration DSP

Do not claim effect support if export still fails when effects are active.

### .03 — Canonical native plugin host reconciliation

Reuse existing native-plugin-host / IPC / supervisor / VST3 contracts.

Reconcile optional DawDreamer companion.

Add explicit AU path on trusted Mac host.

Require plugin identity hash, authorization, state, sandbox and crash recovery.

### .04 — Mixer completion

Add/finish:

- buses
- sends
- sidechain
- group controls
- latency compensation
- automation
- plugin preset/state recall

### .05 — MIDI / instruments

Complete:

- Basic Pitch review
- piano roll
- MIDI editing
- virtual instrument selection
- VSTi/AU instrument rendering
- MIDI/audio provenance distinction

### .06 — recording / takes / comping

Complete:

- recording
- take lanes
- comping
- crossfades
- punch/region editing
- non-destructive version history

### .07 — long-form export

Prove full-song projects beyond browser memory caps:

- aligned individual stems
- wet/dry mix
- master
- metadata/markers
- DAW manifest
- large multipart exports
- independent readback/null QC

### .08 — cross-device same-project continuity

Phone/pad/laptop use the same durable project.

Prove conflict/recovery and offline/reconnect behavior.

### .09 — physical device certification

Real:

- iPhone landscape
- iPad/tablet landscape
- Mac or trusted desktop
- headphones/speaker output
- Safari/browser file decode
- waveform/gesture ergonomics
- plugin host on desktop

### .10 — DAW.FINAL

Owner can edit a real restored session, use real effects/plugins, save, reopen, export, and round-trip without sample-clock/provenance loss.

---

## DAW-DIRECTOR.01 → .05

Preserves existing `DAW-DIRECTOR.1-.5`.

### .01 — trusted media registration

Register edited stem WAVs into Director with independent hashes.

### .02 — safe existing-project merge

Append to an existing Director timeline with revision fencing.

Never silently create a replacement project.

### .03 — beat/sample/frame alignment

Prove:

- sample clock
- fps mapping
- edit points
- music section markers
- beat grid

### .04 — lip-sync / Foley / B-roll QC

Use approved aligned vocal segment for lip sync.

Share beat/section intelligence for cuts and Foley timing.

### .05 — audio/video roundtrip

Director export returns to Music/DAW with:

- exact audio revision
- soundtrack/stem refs
- video asset refs
- owner review
- no automatic publication

---

## MUSIC-JUGGERNAUT-HARDEN.01 → .08

Do not rebuild MUSIC-AUTO.1-.13.

### .01 — service-level autopilot integration harness

Directly test `runMusicAutopilot()` across its real orchestration boundaries.

### .02 — Artist World Graph

Durably model:

- themes
- stories
- recurring cultural/visual signals
- humor
- locations
- characters
- rituals
- values
- fan language
- song/album mythology

### .03 — audience-intent + qualified-fan model

Classify campaign intent:

- fan acquisition
- music discovery
- depth
- direct capture
- community
- customer
- creator-peer
- education

Measure **Qualified Fan Yield**, not only reach.

### .04 — Bond Creative Engine

Add story/world/emotion/identity mechanics to creative briefs.

### .05 — Recursive Creative Memory v2

This is the critical missing loop.

Change future `buildMusicCreativePortfolio()` inputs so admitted learning can influence:

- hook structure
- duration
- song section
- Artist World signal
- narrative/worldbuilding mechanic
- visual grammar
- edit pacing
- environment
- performance style
- CTA
- audience intent
- platform
- timing

Learning should say **why** a creative won, not only that it won.

### .06 — direct fan attraction/capture

Use existing Growth CRM and consent.

Music attraction offers may include approved:

- first-listen access
- unreleased alternate
- song story/visual chapter
- demo/version
- stems/sample pack where rights allow

Do not create a second CRM.

### .07 — live/royalty acquisition workers

Commission:

- new royalty statement ingestion/reconciliation
- live/city demand acquisition
- performance outcome feedback

### .08 — hardening certification

Require learning to change a subsequent real creative decision.

---

## MUSIC-SOCIAL-LIVE.01 → .08

Use the reconciled Social Juggernaut; do not create Music-specific duplicate publishing.

### .01 — Atwood Bookie profile/account truth

Verify exact accounts, character profile, voice profile and provider capability.

### .02 — Music → weekly campaign compiler

Convert Music creative experiments into the same weekly Social packet used by the rest of Jhadina.

### .03 — Director production jobs

Generate the approved music videos/shorts/commercials through Director.

### .04 — weekly owner approval

Report must show:

- song/section
- Artist World concept
- audience intent
- creative variants
- accounts/platforms
- schedule
- specific owner-curated accounts to monitor
- proposed relevant comment opportunities
- paid tests/budgets
- owned-audience destination
- blockers
- prior kill/scale evidence

### .05 — scheduled continuation after approval

Replace the current Music scheduler stop-at-Social-boundary behavior by consuming the exact approved weekly Social child permits.

No new content/account/budget/comment may be invented after approval.

### .06 — paid accelerator adapter

Automatically assemble **proposal inputs**, not spend authority:

`validated ATTACK outlier + organic conversion proof + rights + budget + provider + ready buyers/lookalike + creative + landing page + owned capture`

Only BOUNDED_PAID_TEST_READY or PAID_ACCELERATION_READY enters the weekly paid packet.

### .07 — provider observations + lineage

Persist:

`song → section → experiment → Director asset → Social post/ad → audience → destination → stream/direct fan/buyer/revenue`

### .08 — weekly learning

Return:

- kill
- iterate
- scale-next-test
- audience-quality changes
- timing/mechanic changes
- Artist World learning

into Music creative memory and broader Jhadina intelligence.

---

## MUSIC-DISTRIBUTION-ROYALTY.01 → .06

### .01 — release readiness contract

Require:

- final master hash
- artwork
- metadata
- rights/splits
- artist/release identity
- explicit owner approval

### .02 — commission real distribution provider adapter(s)

Current provider-neutral contracts are not live DSP proof.

### .03 — release status polling + evidence

Persist submitted/live/failed state and external IDs.

### .04 — royalty statement ingestion

Use the existing importer/ledger; add real current statement flow.

### .05 — song/service reconciliation

Preserve recording identity and statement lineage.

### .06 — economics feedback

Feed royalty and attributable fan/customer economics to Music/Growth/Money intelligence without granting autonomous financial authority.

---

## MUSIC-PRODUCTION-CERT.01 → .06

### .01 — restoration canaries pass

Real owner-reviewed songs, not synthetic-only.

### .02 — DAW physical-device pass

Real mobile + desktop edit/render/export.

### .03 — Director roundtrip pass

Real music/video asset and reviewed export.

### .04 — Atwood Bookie closed-loop campaign canary

One real song:

`catalog → section perception → Artist World creative → Director → weekly approval → publish → observe → fan/stream/business outcome → learning → changed next creative`

### .05 — distribution/royalty/live pass

At least one real evidence-backed release/outcome path is proven through the relevant commissioned provider/source.

### .06 — multi-cycle reliability

Require multiple scheduler cycles with:

- restart/reclaim
- no duplicate side effects
- ambiguous-state reconciliation
- exact receipts
- no approval bypass
- no unbounded spend

Then, and only then:

# MUSIC.PRODUCTION.FINAL

---

## 9. Immediate next coding tranche

The next code should be:

`MUSIC-RECONCILE.01 → .04`

in this order:

1. fresh current-main integration branch and file-level inventory of #1141/#1136;
2. port required music/DAW changes without stale unrelated history;
3. fix #1141 Media CI NumPy/runtime dependency and run exact-head certification;
4. repair research #4 runner/provenance workflow.

Only after this source reconciliation should new model/feature work continue.

This work can proceed **without** paying for a new GPU or Supabase upgrade.

Live commissioning remains gated by SWLC recovery and, if no approved existing compute is available, explicit owner approval for any new billable GPU.

---

## 10. Final acceptance — what “completely built” means

The system is not complete until the owner can, from the actual product:

1. ingest a rights-cleared real song;
2. preserve exact source bytes;
3. split recoverable stems and deep sub-stems;
4. inspect/repair/reconstruct a damaged passage with honest provenance;
5. edit the synchronized session on phone/pad/laptop;
6. use real desktop effects/plugins and export aligned stems/master/MIDI;
7. send the approved audio revision into an existing Director project;
8. produce music-video/social/ad creative using song/beat/Artist World intelligence;
9. review one weekly Atwood Bookie campaign report;
10. approve the exact week once;
11. have scheduled Social/paid actions execute only inside that frozen approval;
12. monitor owner-selected and discovered relevant accounts for contextual profile-voice engagement;
13. capture consented direct fans;
14. measure streams, repeats, direct-fan capture, purchases/revenue and live demand;
15. kill weak experiments and promote winners only into the next bounded test;
16. see the next creative decision materially change because of learned evidence;
17. recover the source/session/archive bytes by hash after restart/restore;
18. inspect complete provenance, approval, provider and QC receipts.

Anything short of that is source-complete, partial, commissioned in one lane, or shadow-certified — not `MUSIC.PRODUCTION.FINAL`.

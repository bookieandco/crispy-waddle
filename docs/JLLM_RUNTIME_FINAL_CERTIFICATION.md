# JLLM-RUNTIME.FINAL — Real-world certification

Date: 2026-09-22

## Certification rule

Source completeness is not the same as real-world certification. A gate is PASS only when the required runtime evidence exists. Environment-dependent gates remain BLOCKED rather than being waived.

## Landed runtime contracts

- Canonical provider-neutral Jhadina voice runtime and voice profile.
- Multilingual provider routing with provider fallback that preserves Jhadina identity.
- Turn-scoped transcript + acoustic-signal separation.
- Existing FFmpeg-compatible recorded-conversation prosody observer.
- Canonical WorkSession contract.
- Canonical subsystem surface verbs: observe/read/analyze/plan/propose/execute.
- Existing Ask Jhadina wake/screen/image/text interface from merged PR #613.
- Existing governed SubsystemDoctor remains the only repair path; it never self-authorizes evolution.

## Real-world gates

| Gate | Requirement | Status |
|---|---|---|
| FINAL.1 | Repository type-check/build/tests for merged JLLM changes | BLOCKED — current Vercel deployment lineage is canceled/failing and no CI run exists for merged #613 |
| FINAL.2 | Open Ask Jhadina in a READY deployment | BLOCKED — latest JLLM deployments are CANCELED |
| FINAL.3 | Wake phrase from real microphone | BLOCKED — requires browser/device microphone runtime |
| FINAL.4 | Multilingual STT using native Whisper service | BLOCKED — provider contract exists; native service not deployed |
| FINAL.5 | Canonical Jhadina TTS across >=2 native providers | BLOCKED — provider contract/profile exists; native provider services not deployed |
| FINAL.6 | Barge-in/streaming interruption | BLOCKED — canonical policy exists; streaming service runtime absent |
| FINAL.7 | “Do you see my screen?” against current shared frame | BLOCKED — interface landed; needs READY browser deployment and permission test |
| FINAL.8 | Image/text artifact reasoning | BLOCKED — source path landed; needs READY deployment/runtime test |
| FINAL.9 | Audio/video/document universal Artifact Core with quarantine | BLOCKED — Security Core boundary exists; durable universal intake not yet deployed |
| FINAL.10 | WorkSession persistence across reload/device | BLOCKED — canonical contract landed; repository/persistence adapter not yet deployed |
| FINAL.11 | Cross-subsystem observe→execute routing | PARTIAL — canonical registry surface landed; subsystem adapters remain incremental |
| FINAL.12 | “Jhadina, fix this” through diagnose→approval→isolated repair→tests→draft PR | PARTIAL — SubsystemDoctor runtime exists; Ask bridge/executor runtime not yet deployed |
| FINAL.13 | Personality/RNC continuity across provider/language swap | SOURCE PASS — model/provider boundary preserves personality; real audio A/B remains blocked |
| FINAL.14 | Privacy/authority invariants | SOURCE PASS — artifacts/signals are evidence only; repair requires approval; uploaded code is not executed |
| FINAL.15 | Production recovery/fallback drill | BLOCKED — requires deployable production lineage |

## Admission decision

**JLLM-RUNTIME.FINAL = NOT CERTIFIED.**

This is an intentional fail-closed result. The remaining blockers require actual runtime infrastructure, device/browser permissions, native speech services, and a healthy deployment. They cannot be truthfully certified from repository source alone.

## Unblock order

1. Repair Vercel/CI so current main produces a READY deployment and executable test evidence.
2. Deploy Jhadina Voice Service with Faster-Whisper/Whisper-Timestamped.
3. Deploy at least two admitted TTS providers behind the canonical voice profile.
4. Add streaming TTS + barge-in.
5. Persist WorkSession and universal quarantined Artifact Core.
6. Bridge Ask Jhadina to governed SubsystemDoctor execution.
7. Run physical microphone/screen/multilingual/provider-failover/repair drills and attach receipts.
8. Change this document to CERTIFIED only when every required real-world gate has evidence.

## Deployment retrigger receipt — 2026-09-22

- PR #615 merged as `12ee3876365d051198c53008e1d53694238d00e1` and removed the root Vercel `ignoreCommand`.
- No deployment for that main SHA was visible immediately after merge, so this documentation-only main change intentionally retriggers the Git integration after the configuration repair.
- Certification remains fail-closed until a deployment for the post-#615 main lineage reaches READY and runtime drills pass.


## Audit/repair disposition — Vercel production trigger

Status: **MARKED FOR AUDIT/REPAIR**.

Evidence captured after PR #616:
- current main: `40208ab39441a87a0e597dd77a56e3ee176ce3a5`
- GitHub combined status: Vercel = failure
- GitHub workflow runs for that main SHA: none
- Vercel deployment inventory contains no deployment for `40208ab...`
- latest visible JLLM deployments are older canceled feature-branch deployments
- a historical deployment `dpl_4Y9uHzmMJLeSvtrGfiHRqpvwACGr` is READY, proving the Vercel project can build this application lineage in principle

Classification:
`VERCEL-GIT-TRIGGER / PROJECT-CONNECTION`, not a JLLM source-certification failure.

Repair owner:
the Vercel/Git integration audit. Verify the project is connected to `bookieandco/crispy-waddle`, production branch is `main`, deployment triggering is enabled, account/usage is not in DEPLOYMENT_DISABLED state, and the GitHub App still has required repository permissions. Do not weaken JLLM runtime gates to compensate.

JLLM may continue source/runtime-contract work while this infrastructure blocker is open, but FINAL.1/2/3/4/5/6/7/8/10/12/15 cannot be promoted to real-world PASS without current executable runtime evidence.


## FINAL.10 persistence commissioning receipt — 2026-09-22

Merged lineage: `a71fc6f6f26020e31221434589a162a53d6741e4` (#618).

The canonical WorkSession migration was applied to the active Jhadina/SWLC Supabase project. Post-apply verification confirmed:
- `public.jhadina_work_sessions` exists;
- RLS is enabled;
- `anon` SELECT = false;
- `authenticated` SELECT = false;
- `service_role` SELECT/INSERT/UPDATE = true;
- a transactional insert → update → read probe preserved the expected goal, subsystem and decision reference and was rolled back afterward.

Supabase security advisors report the expected informational `rls_enabled_no_policy` finding for service-only tables. This is intentional for WorkSession: public client roles have their table privileges revoked and no client RLS policy is admitted.

**FINAL.10 status: INFRASTRUCTURE PASS / APP-RUNTIME BLOCKED.** Durable persistence is commissioned and verified at the database boundary. Cross-reload/device behavior through the web repository adapter still requires a current executable Jhadina deployment, which remains blocked by the separately marked Vercel Git-trigger audit/repair.


## Native voice deployment attempt — 2026-09-22

Merged lineage: `c158188b603004a2a2b7d726183ad9dcfdfd89de` (#621).

A real deployment attempt was made against the connected Railway workspace using a dedicated `Jhadina Voice Runtime` project. Railway rejected project creation with: `Free plan resource provision limit exceeded. Please upgrade to provision more resources!`

This is an external infrastructure-capacity blocker, not a source-runtime pass. No service URL was created and therefore no real microphone/audio transcription drill was performed.

**FINAL.4 status remains SOURCE READY / REAL-AUDIO BLOCKED.** The deployable container, authenticated HTTP boundary, FFmpeg normalization and Faster-Whisper adapter are merged. Certification must remain fail-closed until compute capacity is available and an actual audio sample completes the deployed FFmpeg → Faster-Whisper path.


## FINAL.9 Artifact Scanner source-certification receipt — 2026-09-22

Wave 11 PR: #632.

The durable Artifact Core now has a concrete malware scanner runtime rather than a placeholder provider contract:

- scan requests are bound to the original upload bytes, Artifact Core SHA-256, MIME type, asset ID and byte count;
- the HTTP adapter sends authenticated multipart bytes to a dedicated scanner service rather than granting the scanner Supabase service-role access;
- the scanner streams bytes to ClamAV `clamd` with `INSTREAM`, recomputes SHA-256 while scanning, and rejects size/hash mismatches;
- ClamAV detections return `rejected`;
- scanner outages, malformed responses, transport failures, hash/size mismatches and protocol errors remain fail-closed in `quarantine`;
- UniversalArtifactCore refuses to apply any scanner result whose artifact ID, SHA-256, MIME type or byte count differs from the quarantined record;
- dedicated scanner CI passes, and Core Spine regressions pass with the byte-bound scanner contract.

ClamAV's daemon socket must remain private. Its TCP protocol has no authentication or encryption, so production must use a Unix socket or a private service network; the public boundary is the authenticated Jhadina scanner HTTP service.

**FINAL.9 status: SOURCE-CERTIFIED SCANNER / LIVE DEPLOYMENT + BINARY DRILL BLOCKED.** The remaining proof is operational: deploy ClamAV with current signatures, deploy the scanner service, configure `JHADINA_MEDIA_SCANNER_URL` and `JHADINA_MEDIA_SCANNER_TOKEN`, then prove a benign file reaches `clean` and an EICAR test file reaches `rejected` while scanner outage remains `quarantine`. Railway still cannot admit an additional service under the currently observed workspace resource limit, so this gate is not promoted to real-world PASS.


## FINAL.9 extraction source-certification receipt — 2026-09-22

Wave 12 adds the post-scan representation layer required for clean non-image artifacts to become usable Jhadina context.

Landed source contracts in this wave:
- private `jhadina-artifact-derived` Storage bucket migration;
- authenticated extraction adapter bound to the source artifact ID, SHA-256, MIME type and byte count;
- clean-only extraction persistence under the owning user's derivative path;
- Context Resolver hydration of actual private extracted text rather than placeholder Storage references;
- content-verified admission for PDF, DOCX, XLSX, CSV, JSON, MP3, M4A/MP4, WAV and WebM containers;
- document extraction for PDF/DOCX/XLSX/CSV/JSON/plain text;
- audio/video transcription path through FFmpeg normalization + Faster-Whisper;
- bounded OOXML expansion, spreadsheet-cell and extracted-text limits;
- extraction failure remains fail-closed for reasoning: the source may remain scanner-clean, but `contextReady=false` until a verified derivative exists.

The extractor does not make malware decisions and cannot bypass the scanner. It runs only after Artifact Core returns `clean`. The extractor also recomputes the source SHA-256 before producing a derivative.

**FINAL.9 extraction status: SOURCE READY / DERIVED STORAGE DEPLOYMENT + LIVE FILE DRILLS BLOCKED.** After merge, the private derived bucket migration must be applied to SWLC. Real-world evidence still requires deployed extractor compute and live PDF/DOCX/XLSX/audio/video uploads proving scan → extraction → private derivative → ContextPacket.

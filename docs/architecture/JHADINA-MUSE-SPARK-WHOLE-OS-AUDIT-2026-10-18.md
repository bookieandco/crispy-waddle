# JhadinaOS × Muse Spark — whole-system gap, security and reuse audit
Date: 2026-10-18. Review base: `main@ad5830382d6c209dca63da41c93f2575d6ed2242`. No production or service state modified.

## Scope and evidence discipline
This audit inventories the **current monorepo**, representative source files, canonical handoffs, and recent open/merged GitHub pull requests. It is a *repository/source and handoff audit*, not a claim of line-by-line review of every module or live runtime certification. Current main includes **7 app directories, 46 package directories, 27 service directories, and 225 SQL migration files**; counts refer to entries in those directories, not active deployments or working subsystems.

User-supplied Muse creator transcripts are **third-party demonstrations/claims**, not independent access or quality receipts. Claims about native social integrations, free credits, automatic trading, visual artifacts, browser use and schedules must be independently verified. No personal account data was extracted during this review.

Critical source separation:
- **Official Meta model:** `research.meta.ai/blog/introducing-muse-spark-1-3`, `dev.meta.ai`. It is a legitimate model/API family; no Meta API credentials/terms/sandbox are commissioned here.
- **Untrusted name-sharing GitHub distribution:** `github.com/muse-spark-app/muse-spark`. The README calls itself the "official desktop client"; reviewed `core/llm_engine.py` generates **mock output**, `core/rag_manager.py` is placeholder retrieval/indexing, and `core/voice_studio.py` emits log messages instead of audio. README says "Meta Community License" but LICENSE is MIT. A Windows `.7z` binary is present in releases, **not inspected or executed**. Publisher identity/Meta affiliation not verified. **No binary/vendor install and no code adoption.** This is not a malware finding, but an untrusted distribution classification. Added explicit `REJECTED` entry to canonical ReferenceProvenance and a separate official-model docs reference.
- **Unofficial community skill prompts:** `github.com/aicodedecode/awesome-muse-skills`, reviewed in draft PR #1411. Skill text remains untrusted; never promote prompt content to policy or execution authority.

## Constitutional architecture (preserve)
`Ask / WorkSession -> Context / JANET / intelligence -> Policy / Values / approval -> Action Core -> domain executor -> auditable evidence`, with capability health, scheduler, compute and event bus as support planes, **not authorization**. Primary references: `docs/JHADINA_OS_MAINFRAME.md`, `docs/JHADINA_ONE_RUNTIME_FOUNDATION.md`, `docs/DO_NOT_BUILD.md`, `docs/JHADINA_SECURITY_BASELINE.md`.

**Never build** a second memory, identity, registry, task queue, policy/approval, wallet custody authority, executor, audit ledger or AI runtime as an independent backdoor. Never silently commission commerce, ads, outreach, subscriptions, trading, token creation, production database writes, public publishing, private data sharing or billing.

## Capability and readiness ledger
Readiness is `main source`, `draft/pending`, `external gate`, or `unverified`, *not* a blanket product certification.

| Domain cluster | Existing main/canonical basis | Open or recent donor work | Exact gap to product usefulness |
| --- | --- | --- | --- |
| Core persona, JANET, relationships | `jhadina-core-spine`, `relationship-core`, memory/context and Personality expression | owner Facebook import #1351/#1352 **draft** | Governed memory corrections/forget, durable identity, imported-style consent, two-owner isolation and real iPhone acceptance |
| JLLM & multi-model routing | `jhadina-intelligence-core`, `provider-core`, `knowledge-graph`, Ask routes | #1364 **draft** model registry, private routing, local adapter and perception | Selectively reconcile against main, model execution privacy, trusted local worker, native voice first-audio/cancellation and real artifact evidence |
| WorkSession, orchestration, event recovery | `agent-runtime-core`, `jhadina-core-spine`, `jhadina-event-bus`, `scheduler-core`, `jhadina-capability-registry` | #1411 **draft** checkpoint safety, candidate skills, Sentinel/browser command | Finish exact-head gate, double-claim/replay and interrupted-action drills on deployed storage; user-visible progress, approvals, retries and actual receipts |
| Policy, governance, privacy, safety | `security-core`, `privacy-core`, `jhadina-action-core`, `jhadina-reference-provenance` | #1411 and this audit branch | Independently enforce egress, real identity-bound grants, revocation, tool-input provenance, least-privilege credentials, audit retention; never grant from a model prompt |
| UI, charts, Home feed, phone | `apps/jhadina-web` Ask/Work/activity/approvals, `apps/jhadina-ios`, `apps/jhadina-calendar-kmp` | #1404 Home-feed release and #1391/#1393 governed visual UI **draft** | One uncluttered mobile hub, source-backed cards with explicit stale/blocked, real feeds and consent, physical Safari tests; no raw model HTML |
| Voice, transcription & presence | `services/jhadina-voice`, `services/jhadina-tts-provider`, JLLM voice and expression contracts | #1364 voice recovery and separate voice auditions | Verified canonical voice, actual local/native provider, physical microphone/acoustic tests, hard interruption and identity continuity |
| Live context, uploads, perception | live-context source in Ask, artifact extractor/scanner services and canonical storage | #1364 perception draft; issue #1389 audit | Authenticated clean-only ingestion, safe quarantine, real scanner/extractor deployed probes, file/consent lineage |
| Growth, Meta ads & organic social | `growth-core`, `social-core`, `jhadina-connector-core` plus competitor-ad observations and social content projects | #1328 creator free-first **draft**, #1353/#1357/#1362 merged source-readiness, #1407 personal SEO **draft** | Genuine provider OAuth/API grants, account separation, human rights/opt-outs, observed competitor creative and sourced content calendar; approvals before posts/ads/messages |
| CRM, DMs, email & calendar | `relationship-core`, `planning-core`, work/calendar routes | CRM schema gap in Oct 1 handoff, Social Identity stacked drafts #1206–#1237 | Lead inbox triage with lawful access, minimal PII, owner edits, follow-up deadlines, scoped consent, no unsolicited automated replies |
| Media, Director & production | `director-core`, `shotlist-core`, studio and specialized video/voice workers | #1363 merged source; #1390 **draft** | Asset rights proof, real compute/worker admission, video quality/character continuity, quota/cost guards, QC receipts and durable storage recovery |
| Jhadina Music | `music-core`, `services/music-restoration-worker`, web Music routes | #1408 **draft** selective streaming recovery | Licensed/owner-approved sources, playlists/search/radio/player continuity, private storage/RLS and real iPhone background/audio tests |
| JhadinaTV | `jhadina-tv-core`, `jhadina-entertainment-core`, JTV owner-only playback | JTV private/reconcile and postmerge source merged | Verify actual playback/provider rights, receiver/casting/mobile playback; no fabricated channel availability |
| PupsonStuff & commerce | `apps/pupsonstuff`, `checkout-orchestrator`, `commerce-adapters`, `payment-core`, `order-fulfillment-core`, image workers | #1301/#1302/#1303 merged preview admission; #1160/#1164 merged safety | Private portrait iPhone experience, product flashing/layout, asset rights, real portrait workflow, private preview receipts; no live checkout without separate approval |
| SHARK, Shadow, SniperBot, MemeBot | `shark-intelligence-core`, `money-core`, paper experiment and Cloudflare ingress controls | #1410, #1409, #1376–#1388 **draft**; multiple Cloudflare source gates merged | Source independence, original Shadow outcome repair, nontrading paper truth, storage recovery, market data freshness, 7-day cutoff; never accept claims of profitability, autonomous transfers or launches |
| Money, Capital Lab, wallet/purse | `money-core`, wallet/market routes, payment audit primitives | Purse/Kalshi/Shadow drafts and merged paper-readiness tools | Verified source and owner-scoped balances, ledger/snapshot truth, financial segregation, no live execution without strict separate approval |
| Homebase, cloud workers, storage & cost | `jhadina-compute-core`, `jhadina-gateway`, `scheduler-core`, cloud/portable infrastructure and service worker set | `docs/JHADINA_CLOUD_FINAL_CERTIFICATION.md` source/shadow ready, live blocked | Real host identity, secure isolation, GPU/storage health, cost ceilings, off-host restore, no phantom background execution |
| Government/SAM, OverageOS & logistics opportunity | `opportunity-core`, government opportunities, delivery/route/trip cores | SAM government adapter handoffs and Overage research | Source-verified public data, legal eligibility, duplicate-suppression, owner approval before customer outreach, payment or legal filing |
| SafetyOS, research and self-repair | `jhadina-research-core`, `jhadina-evolution-core`, incident timeline, policy/evidence fabric | JLLM/Doctor, SAFETY and source remediation handoffs | Structured crash->corroboration->isolated patch->exact-head tests->draft PR with incident redaction, signed review and no auto-deploy |
| Sports, gaming & predictions | `gaming-core`, sports API/UI and sports study/weekly paper outcomes | Week001/5-lab source test merges | Frozen pregame predictions, odds/injury source snapshots, prop/market provenance, postgame grading; no wagers based on paper results |
| GEV & Spatial | `spatial-intelligence-core`, physics/video/observer services | #1293/#1300 merged source, `SPATIAL-16` certification hold | Actual verified provider identity and rights, OIDC storage and Reality admission, time/position provenance, device/video/live fail-closed canaries |
| TruckerOS, placement & staffing | `truckeros-core`, `truckeros-agent-orchestration-core`, `placement-core`, `staffing-core`, `apps/truckeros-web`, `apps/staffing-web` | #1330 merged source; #1332 explicitly superseded | Tenant auth, encrypted off-host restore, licensed load sources, private CI, actual iPhone/customer acceptance; booking/ELD/payments off |
| Opportunity, Side Hustle, SAM & Growth business factory | `opportunity-core`, `energy-opportunity-core`, `offer-engine`, `growth-core` | no-rig and side-hustle source merged; Social free-first draft | Revenue receipt rather than projected ROI, provider/eligibility truth, identity, isolation, proof of customer acceptance, opt-in external communication |
| Political / Campaign workspace | civic research/source constraints and campaign routes | #1359/#1397 **draft** | Sourced claims, accessibility and disclosure, civil-democratic safeguards, no unauthorized persuasion blasts, donations or filings |

The `services` tree is rich in named compute workers; directory existence **does not** prove available GPU capacity, installed models, network placement, licensed provider access, latency or billed cost. The `supabase/migrations` tree represents **source proposals**, not installed schema. In particular SWLC has documented PostgreSQL `57P03` recovery failures; never apply fresh SQL until independent project/backup/restore/owner RLS checks succeed.

## Muse creator-transcript use-case fold (unverified demos -> Jhadina capability)
1. **Public customer language & competitor ads:** map to Growth Core source observations and rights-aware brief. Preserve exact quote/link/source/timestamp and scope; don't scrape private groups or other people's DMs without authorization.
2. **Own Instagram analytics and side-by-side benchmarking:** map to Social/Growth; distinguish public visible engagement from private impressions, reaches or conversions.
3. **DM lead triage and reputation alerts:** map to Relationships + consented connectors + WorkSession + approvals. Draft responses; no automatic outbound without valid scoped approval, rate/anti-spam controls and platform terms.
4. **Weekly competitor monitoring and content calendar:** map to Scheduler + Growth + Planning + canonical notification. Preserve source freshness and decision receipts; schedule only after explicit owner opt-in.
5. **Funnel screenshot teardown:** proposed governed *public read-only* browser with clear page-state provenance. Email signup/cart creation/cookie changes have external side effects and need separately owned, allowed action capabilities; don't mask them as GET.
6. **Daily audio brief, podcast, Spotify control:** compose Research -> reference-backed evidence -> media/voice -> owner playback. Rights and actual provider permissions required; browser fallback is not a certified native voice.
7. **Social complaint-to-testimonial creative:** private message content not reusable in ads without actual permission, documented grant and revocation. Director can make drafts and rights-gate publication.
8. **Subscriptions and inbox opportunity review:** research/triage only, with user-provided verified account coverage and explicit per-service cancellation approval; no invented savings.
9. **Sentry-like crash -> diagnosis -> draft fix -> PR:** use existing Doctor/evolution and GitHub workflows, but never auto-merge/deploy, never leak incident PII or let log content override instructions.
10. **Kanban / mini apps / interactive artifacts:** use canonical WorkSession projection and typed JLLM cards; no arbitrary generated runnable HTML, background hidden tabs, or separate task database.
11. **Private screen assistance:** consented bounded screen session, source/mode identity and easy stop; not silent recurring screen capture.
12. **Share-to-Jhadina iOS intake:** accept owner-shared reel/link/photo as **untrusted** context, preserve link and permission timestamp, cite claims before recommending any purchase; never auto-buy or trust creator engagement as proof.
13. **Dynamic avatar/presence:** theme and outfit state can be derived from consented calendar/context as a reversible presentation layer; never mutate Personality/Values or imply emotion/perception from calendar data.
14. **Sports/prediction markets:** use paper-calibrated research and risk bounds; transcript claims of automatic trades or returns do **not** authorize live financial actions.

## Crosscutting failure themes, ranked by severity
**P0 — Source authenticity / untrusted code:** unverified binary masquerading as a known product. Permanent reject for binary execution unless independently verified; no GitHub file or pasted skill is a model/provider credential. This branch adds ReferenceProvenance state and tests.

**P0 — Storage and identity truth:** SWLC database recovery, 225 source migrations vs deployed migration ledger, two-owner+anonymous RLS/backup restore, service-role least privilege, false "ready" projections. One verified storage proof reused across Social/Music/Director/SHARK/CRM, never 4 conflicting migrations.

**P0 — Durable actions:** distinguish last checkpoint from complete external action. PR #1411 prevents blind replay and fixes equal-timestamp in-memory checkpoint order; atomic provider idempotency/receipt reconciler and real crash drill remain needed.

**P1 — Release branch reconciliation:** numerous parallel draft PR stacks hold overlapping app/UX/social/music/JLLM changes. Fix through current-main selective cherry/forward-port and exact-head CI, not wholesale stale merges. Prioritize #1411 then #1364, #1404, #1408 and #1328 in dependency order after conflict/permission review.

**P1 — Missing true computer operator:** Sentinel URL preflight ≠ secured browser; requires owner session binding, DNS/egress network containment, per-step approval, isolated cookie jar, screenshots, immutable action audit and irreversible-effects classification.

**P1 — Actual phone continuity:** auth reload, notifications, iPhone portrait, real mic/voice interruption, media backgrounding and multi-device state have separate live evidence gates. Provide truth UI rather than calling demos certified.

**P1 — Growth engine operating loop:** promote source-backed public/owner-authorized metrics -> diagnosis -> ranked content/SEO tasks -> draft creative -> owner approval -> publish and measure actual ROI. Canonical Growth/Social/Director already own pieces; don't buy a clone SaaS.

**P2 — Everyday workflow surface:** one owner-only Work view for approvals, blocked jobs, daily briefings, DM triage, subscriptions, competitor brief, and task receipts. Reuse existing `/work`, `/activity`, `/approvals` and typed visual structures.

**P2 — Cost observability:** real compute, vendor API, spend and storage metering before recurrent worker activation. Promotional "free" usage is neither a contract nor a sustainability guarantee.

## Smallest safe ordered build sequence
- `JH-MUSE-TRUST.01`: close source authenticity review, rejected executable reference and tests (this branch).
- `JH-MUSE-RECONCILE.02`: finish PR #1411 recovered checkpoint tests and exact-head CI; keep browser disabled.
- `JH-MUSE-RECONCILE.03`: enumerate dependencies/diff conflicts across #1364, #1404, #1408, #1328 and selective forward-port without duplicate authority.
- `JH-MUSE-STORE.04`: independent SWLC recovery + canonical project/backup/RLS evidence gate, **no automatic SQL**.
- `JH-MUSE-WORK.05`: connect WorkSession projection to consolidated iPhone Work inbox with approval, stuck/blocked and receipts.
- `JH-MUSE-BROWSER.06`: private constrained browser worker contract, DNS egress and redirect/cookie denial tested; still read-only.
- `JH-MUSE-GROWTH.07`: first source-backed public ads/customer-language weekly report (review-only, cost-free), tied to Growth.
- `JH-MUSE-CRM.08`: owner-authorized DM/reputation triage to draft replies and opt-in follow-up queue.
- `JH-MUSE-MEDIA.09`: typed artifact reports, voice-note brief and media/player consent with real iPhone acceptance.
- `JH-MUSE-CERT.10`: same-SHA CI + user/device + external provider truth; draft PRs only then ready for operator review.

## Acceptance contract
For every item: (a) reviewed exact main/head SHA, (b) producer source/tenant/rights, (c) separate `SOURCE_PASS`, `INFRA_PASS`, `LIVE_PASS`, (d) authenticated two-owner/anonymous and negative tests, (e) no paid/irreversible effect without explicit grant, (f) reproducible ledger/audit receipts, (g) real physical phone when claimed, (h) rollback/revocation. A passing mocked test never equals a running product.

## Changes in this audit PR
- New canonical provenance seed containing **REJECTED/untrusted source** entry for `muse-spark-app/muse-spark` and **official documentation-only** reference for `dev.meta.ai`. Existing ReferenceProvenance Registry, not a new authority.
- Tests assert unverified distribution remains rejected and both references carry `NONE` execution authority.
- This whole-OS gap/readiness report. No app routes, migrations, release binary, network worker, credentials, spending, schedule, public action or deployment.
- PR #1411 remains the separate source-only code repair; do **not** merge the two blindly or confuse passing CI with commissioned runtime.

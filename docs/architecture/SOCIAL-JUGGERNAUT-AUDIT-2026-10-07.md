# SOCIAL-JUGGERNAUT AUDIT — Everywhere, All At Once

Date: 2026-10-07  
Repository: `bookieandco/crispy-waddle`  
Base audited: `main@ce3e3f3025ade13bd0943a28afeaff03eb980114`  
Implementation branch: `feat/social-juggernaut-portfolio-20261007`  
Pull request: #1136

## Verdict

Do not build another Social Core.

The existing repo already has the hard execution authorities:

- Social Core: connected accounts, exact targets, governed publish proposals, approval receipts, durable outbox, provider receipts, reconciliation, observations, governed messaging.
- Growth: audience, brand, offer, research, creative evidence, experiments, paid media, attribution and economics.
- Director: media generation, editing, QC, provenance and review.
- Business Factory / Opportunity: venture truth, buyer/problem/economics, lifecycle, experiments, ownership and outcome learning.
- Music Juggernaut: song/section/experiment/fan/rights learning.
- Commerce / owned media: product and channel outcome truth.

The missing layer is a portfolio-level **Social Juggernaut**:

```
products / music / ventures / owned media / campaigns
        |
        v
portfolio opportunity queue
        |
        v
SEARCH / ATTACK
        |
        +-- research radar
        +-- story bank / artist or brand world
        +-- hook + retention mechanics
        +-- packaging / platform-native surface choice
        +-- reuse-before-create
        +-- source-safe render planning
        +-- launch waves
        |
        v
Director / Growth / Social Core
        |
        v
publish / engage / capture / convert
        |
        v
qualified outcomes -> originating business -> recursive learning
```

Social Juggernaut is orchestration and intelligence. It does not inherit publication, direct-message, outreach, paid-spend, contract or money authority.

## External reference dispositions

### Strong implementation / architecture references

#### `mvanhorn/last30days-skill`
Use:
- parallel cross-platform research;
- relevance + freshness + engagement scoring;
- source health distinct from "zero results";
- same-story clustering and dedupe;
- evidence-preserving ranked output;
- health/postmortem concepts.

Do not import its entire agent contract. Fold the mechanics into Growth research.

#### `rayguo01/viral-x`
Use:
- trend -> draft -> creative-quality assessment -> media -> approval/publish workflow;
- trend history;
- hook/curiosity/resonance/clarity/shareability as experiment dimensions.

Do not clone creator voice. Convert "voice mimicry" into structural mechanic extraction plus canonical brand/owner voice.

#### `Gingiris/gingiris-launch`
Use:
- launch as waves, not a single post;
- strategic prep -> assets -> partners -> content -> final confirmation -> launch -> momentum;
- progressive content depth;
- coordinated multi-channel launch;
- localization;
- user value and quality over vanity-volume.

Do not hard-code claimed universal numeric thresholds, KOL counts, subreddit post counts, or price tables as laws.

#### `vima-tech/moka`
Use:
- native card/carousel/page rendering;
- cover/content/closing-card composition;
- WYSIWYG review;
- reusable templates and palettes;
- reference-image design as an input to a safe design process.

Keep source-safe rules: reference style cannot silently authorize copyrighted-expression copying.

#### `ronin1770/reel-quick`
Use:
- self-hosted FFmpeg-first repackage lane;
- trim/stitch/caption/text overlay/transitions;
- async rendering workers;
- source reuse before expensive generation.

Do not build a duplicate media authority. Director remains canonical.

#### `sergebulaev/linkedin-skills`
Use:
- Story Bank: moments, numbers, corrections, opposition, asks, proof, positions;
- distinguish voice profile from story material;
- native repurposing by platform;
- hook structure extraction;
- approval-before-publish;
- engagement/read-side triage and audience-fit classification.

Do not import fixed "algorithm laws" or universal posting-time rules as truth. Test them empirically.

### Research-only / bounded-reference

#### `shixinzhang/tiktok-viral-hooks`
Useful:
- hook taxonomy;
- first-seconds analysis;
- retention beats;
- script structure abstraction.

Main corpus is CC BY-NC-SA 4.0. Do not copy its corpus/templates into Jhadina commercial production. Code under `_scripts/` is separately MIT, but no direct import is currently needed.

#### `Evil0ctal/Douyin_TikTok_Download_API`
Useful:
- normalized read-side TikTok/Douyin observations;
- source health, rate limiting, request logging, circuit breakers;
- comments/counters/watchlists;
- self-hosted research service.

Treat as a **research adapter only**. Public media has no automatic reuse rights. Browser/signature/identity machinery must never become a publish/engagement authority.

#### `JabulaniUsen/post-it`
Useful but mostly overlapping:
- niche/keyword research;
- memes;
- platform-specific draft generation.

Growth + Director already cover these primitives more deeply.

#### `snowfall6686/ki-social-media-post-generator-deutsch`
Useful but mostly overlapping:
- input topic/product;
- platform + tone selection;
- caption/emoji/hashtag generation;
- weekly batching.

Fold only as UX inspiration.

### Reject from production execution

#### `joeahkim/InstaAddict`
Primary behavior is UI-driven automated likes/follows/comments/PMs/story viewing designed to emulate human interaction.

Do not integrate execution behavior. At most retain abstract rate-limit / job-scheduling lessons.

#### `fckveza/api-sosmedboost`
API sells followers, likes, views, comments and subscribers.

Reject entirely as a growth input or outcome. Paid/fake engagement must never count as business evidence or feed recursive learning.

#### `Spikemumotor/kfebskpv`
Repository advertises follower bots, bulk accounts, scraping, cookie/session usage and proxy rotation, and its README invokes an obfuscated PowerShell downloader from an unrelated domain.

Do not execute or import.

#### Kicksta
Useful product concepts:
- audience-source hypotheses;
- allow/block lists;
- growth reporting;
- onboarding;
- competitor/hashtag targeting as research.

Do not copy automated follow/unfollow, likes/story-view emulation, device/proxy behavior or other stealth interaction automation.

## Existing Social Core overlap

The previous Social Media Marketing Beast audit already established:

```
listen
-> understand
-> big idea
-> content project
-> native derivatives
-> Director
-> approval
-> durable Social outbox
-> provider
-> receipt/reconciliation
-> observations
-> Growth attribution
-> economics
```

That remains canonical.

Social Juggernaut therefore owns only the new portfolio intelligence above that spine:
- which business/song/product deserves attention;
- SEARCH vs ATTACK;
- what audience/job is intended;
- what mechanics to test;
- which platform-native forms to make;
- what existing assets should be reused;
- launch-wave orchestration;
- how qualified outcomes feed portfolio allocation.

## Implemented in PR #1136

### SOCIAL-JUGGERNAUT.1 — Portfolio planner
Added `social-juggernaut.ts`.

- products, music, ventures, owned media and campaigns share one subject contract;
- evidence-weighted portfolio priority;
- SEARCH without a replicated winner, ATTACK only with evidence;
- native variants per surface;
- primary business outcomes separated from vanity diagnostics;
- explicit blocked automation policy.

Blocked production mechanics include:
- follow/unfollow automation;
- bulk account creation;
- credential/cookie scraping;
- proxy evasion;
- mass unsolicited engagement;
- paid fake engagement;
- UI interaction botting.

### SOCIAL-JUGGERNAUT.2 — Cross-platform research radar
Added `social-radar.ts`.

- X, Instagram, TikTok, Douyin, YouTube, Reddit, LinkedIn, Pinterest, GitHub, web and other sources can normalize into one research plane;
- relevance / brand fit / engagement / freshness / commercial intent scoring;
- source health;
- same-source dedupe;
- same-story cross-platform corroboration;
- public media reuse authority remains NONE;
- learn mechanics, not identity/expression.

### SOCIAL-JUGGERNAUT.3 — Business Factory bridge
Added `social-juggernaut-business-factory.ts`.

Venture buyer, job-to-be-done, paid problem, score, MAKE IT MAKE SENSE evidence and brand surfaces become a Social subject.

Business Factory gains no publish authority.

### SOCIAL-JUGGERNAUT.4 — Launch waves
Added `social-launch-wave.ts`.

Seven coordinated waves:
1. strategic prep;
2. asset prep;
3. partner prep;
4. content prep;
5. final confirmation;
6. launch;
7. momentum.

Every external execution type remains independently approval-bound.

### SOCIAL-JUGGERNAUT.5 — Creative mechanics + Story Bank
Added `social-creative-mechanics.ts`.

- abstract hook mechanics;
- retention beats;
- audience intent;
- learn structure, never copy source expression;
- Story Bank stores owner/interview/operational material;
- public / anonymous / restricted naming boundaries;
- no invented numbers.

### SOCIAL-JUGGERNAUT.6 — Native render / repackage planning
Added `social-native-render-plan.ts`.

- text stays text when appropriate;
- existing video/images/artwork are reused first;
- short video supports trim/stitch/caption/overlay/transition/audio/thumbnail planning;
- carousel/pin/image get native card/image paths;
- source hashes and rights evidence preserved;
- voice cloning and artwork restyling require separate authority.

### Organic Pinterest coverage repair
Social Core now recognizes Pinterest and both current Social provider paths can represent it.

Also updated Ask Social routing so Pinterest requests resolve to the canonical Social lane.

## "Everywhere all at once" rule

It does **not** mean blind cross-posting.

Canonical meaning:

```
one business thesis
-> one evidence lineage
-> many platform-native executions
-> one outcome graph
```

Examples:
- TikTok/IG/Shorts can share a creative thesis but use different openings, durations and captions;
- LinkedIn gets a native proof/story structure;
- X gets concise/thread-native packaging;
- Pinterest gets durable visual discovery assets;
- Reddit gets community-native discussion, not ad copy;
- email/owned web/direct fan surfaces remain adjacent systems with their own consent/authority.

## Measurement law

Do not optimize the portfolio on followers alone.

Primary:
- qualified engagement;
- watch depth;
- shares/saves;
- destination actions;
- direct capture;
- leads;
- music transfer / repeat listening;
- orders;
- contribution/revenue;
- advocacy / repeat behavior.

Diagnostics:
- impressions;
- views;
- likes;
- comments;
- follower count.

A smaller campaign that creates more qualified downstream behavior beats a larger vanity spike.

## Next build sequence

After #1136 is green and merged:

`SOCIAL-JUGGERNAUT.7 — durable portfolio queue + scheduler`
- persist subjects, priority, SEARCH/ATTACK state and cadence;
- consume existing Business Factory/Music/Commerce events;
- no external authority.

`SOCIAL-JUGGERNAUT.8 — platform-native campaign compiler`
- materialize Social Content Projects and derivatives from Juggernaut plans;
- Story Bank / brand character / Artist World inputs;
- localized variants;
- exact lineage.

`SOCIAL-JUGGERNAUT.9 — Director production/repackage bridge`
- existing-asset repackage first;
- source-safe QC;
- fast FFmpeg/local worker lane;
- generative Director only when needed.

`SOCIAL-JUGGERNAUT.10 — governed calendar continuation`
- approved immutable content -> scheduler -> Social outbox;
- retries/reconciliation;
- no new authority minted at runtime.

`SOCIAL-JUGGERNAUT.11 — inbox/community intelligence`
- comment/reply/message ingestion;
- triage;
- customer questions -> content opportunities;
- reply proposals remain governed.

`SOCIAL-JUGGERNAUT.12 — direct-capture + CRM attribution`
- opt-in keyword/landing/message offers;
- consent receipts;
- Growth CRM/fan identity;
- campaign -> relationship -> order/stream/lead attribution.

`SOCIAL-JUGGERNAUT.13 — portfolio recursive learning`
- mechanic -> audience quality -> downstream result;
- cross-business reusable lessons where valid;
- avoid transferring audience-specific conclusions blindly.

Then:

`SOCIAL-JUGGERNAUT.PRODUCTION.FINAL`

Final canary should prove at least:
- one Music campaign;
- one product/commerce campaign;
- one Business Factory venture;
- multiple native social platforms including Pinterest;
- Director/repackage asset production;
- governed scheduled publish;
- real observations;
- qualified downstream outcome;
- next-cycle plan changed because of measured evidence.

## Current production caveats

Source architecture can be green while live providers remain uncommissioned.

Existing known ecosystem blockers remain relevant:
- SWLC/Supabase health/storage must be recovered for durable production paths that depend on it;
- production Social provider/account bindings need controlled scheduled-post certification;
- provider analytics/inbox coverage must be commissioned;
- Music Restoration/RunPod convergence remains separate from this Social code.

Do not mark SOCIAL-JUGGERNAUT.PRODUCTION.FINAL until the live cross-domain canary is evidence-backed.

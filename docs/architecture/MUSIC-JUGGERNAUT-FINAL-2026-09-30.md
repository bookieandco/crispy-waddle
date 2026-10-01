# MUSIC-JUGGERNAUT.FINAL

Status: merged to main in PR #833; production schema commissioned on SWLC.

## Purpose

Music Juggernaut is the cross-domain artist-growth layer for Jhadina. It does not replace Music Core, Growth, Social, Director, Money, Opportunity, CRM, or the governed action system. It composes them around the artist lifecycle:

```
CREATE -> TEST -> DETECT -> REPEAT -> AMPLIFY -> CAPTURE -> RELATE
-> CONVERT -> MONETIZE -> PERFORM -> EXPAND -> LEARN -> CREATE BETTER
```

The two operating modes are:

- **SEARCH** — maximize information, creative diversity, catalog/section exploration, and low-cost tests.
- **ATTACK** — concentrate on a replicated evidence signal while preparing the follow-up, capturing direct fans, mapping rights, and preserving approval boundaries.

## Canonical ownership

| Concern | Canonical owner |
| --- | --- |
| playback, providers, restoration | Music Core |
| creative research, experiments, attribution, paid campaigns | Growth |
| publishing accounts, observations, publishing outbox | Social |
| generated media and production QC | Director |
| financial authority and accounting | Money |
| partners/contracts/opportunities | Opportunity / governed action paths |
| generic fan/customer identity and consent | Growth CRM |
| music-specific song/section/experiment/live/rights learning | Music Juggernaut |
| personal artist/fan relationship | Human artist |

Music Juggernaut deliberately does **not** create a second paid-media executor or a second fan identity store.

## Production contracts

### Durable music state

Owner-scoped RLS tables:

- `jhadina_music_projects`
- `jhadina_music_song_campaigns`
- `jhadina_music_experiments`
- `jhadina_music_observations`
- `jhadina_music_city_demand`
- `jhadina_music_rights`
- `jhadina_music_learning`

All client writes go through authenticated RPCs.

### Direct audience

Fan identity remains in `jhadina_growth_customers`. The Music consent bridge requires a consent evidence reference and writes a canonical Growth customer event. Music projections expose aggregate relationship state, not raw fan identifiers.

### Social learning

Social performance is eligible for Music learning only when the Social observation carries an explicit `musicExperimentKey` attribute that matches a durable Music experiment. Generic link clicks are not silently reclassified as song streams.

### Paid media

Music can produce a bounded paid proposal. The existing Growth paid-campaign system remains the only executor. It requires:

- configured spend ceilings;
- a persisted campaign fingerprint;
- Security policy evaluation;
- an approval receipt;
- approval consumption before provider outbox dispatch.

### Rights and consequential actions

The following remain human/governed authority:

- public publication;
- paid publication/spend;
- personal fan messages represented as the artist;
- contracts;
- rights grants;
- venue commitments;
- budget increases.

## Artist product surface

- `/music/juggernaut` — command center.
- `/api/music/juggernaut` — durable state API.
- `/api/music/juggernaut/tick` — authenticated internal planning/learning tick.
- Ask Jhadina — specialized Music Juggernaut read/diagnostic/tick shortcut.
- `/music` — links into Juggernaut while retaining playback.

## What the tick does

The tick may:

1. initialize owner-scoped internal planning state;
2. ingest lineage-bound Social observations;
3. score relative outliers against the artist's own baseline;
4. switch SEARCH/ATTACK planning behavior;
5. admit validated learnings;
6. produce a bounded creative work queue;
7. surface direct-audience, live-market, and rights priorities.

It returns `externalActionsStarted: false`.

It does not publish, message fans, book venues, sign rights, approve ads, or spend money.

## Certification

`Music Juggernaut Final Certification` requires:

- Growth Core type-check;
- Music Juggernaut unit tests;
- Jhadina Web type-check;
- Music Ask/paid-bridge regression tests;
- RLS migration presence;
- consent evidence enforcement;
- existing paid-ad approval gate presence.

This source certification is distinct from live provider certification. A real paid/social/live canary additionally requires connected provider accounts, a real catalog, campaign observations, and explicit approval for consequential actions.

## Remaining live-data dependencies

These are environment/data dependencies, not permission to fabricate readiness:

- real catalog/song-section ingest;
- Social observations carrying Music experiment lineage;
- connected paid provider/account/audience/creative IDs;
- live fan opt-ins and city-demand evidence;
- real rights/splits/clearance records;
- live-show outcomes.

Until those exist, Jhadina stays in SEARCH and reports missing evidence rather than claiming a breakout.


## Live commissioning — 2026-09-30

Canonical Supabase project: SWLC (`kqbkaozfjubkjevdfvic`).

Applied migrations:
- `20260930183612 music_juggernaut_final`
- `20260930183615 growth_direct_audience_consent`
- `20260930183743 music_juggernaut_fk_indexes`

Verification:
- all seven Music Juggernaut tables have RLS enabled;
- authenticated users have owner-scoped SELECT only; anon SELECT is absent;
- public Music/consent RPCs are SECURITY INVOKER, executable by authenticated and not anon;
- rollback smoke of the canonical schema/consent migrations succeeded against the real SWLC schema before live application;
- Supabase security advisor reports no Music-Juggernaut-specific finding after commissioning;
- the post-apply performance advisor's Music foreign-key findings were closed with dedicated covering indexes.

This certifies the durable substrate. It does not fabricate real catalog, fan, rights, city, social-provider, or breakout evidence.


## MUSIC-JUGGERNAUT.PRODUCTION.FINAL

Production certification adds forced-failure proof for:
- one-post outliers that must remain SEARCH until replication;
- fake/high-bot viral traffic that cannot become durable learning or ATTACK evidence;
- opaque/low-confidence paid traffic;
- paid scaling whose downstream conversion degrades or acquisition cost expands;
- breakout moments with weak follow-up/catalog/direct-fan/rights readiness;
- deceptive or unpermissioned guerrilla tactics;
- continuity offers without recurring fan value;
- rights-blocked promotion spend;
- attempts to exceed pre-authorized spend;
- public publishing, paid publishing, personal fan messaging, contracts, rights grants, venue commitments, and budget increases without explicit human authority.

The production-final health endpoint is read/certification only. It verifies the durable Music runtime can be reached and reports whether real artist project data exists. It does not fabricate catalog, fan, campaign, breakout, or commercial evidence when those records are absent.

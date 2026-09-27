# JhadinaTV JTV-31 / JTV-LIVE.FINAL Production Readiness

Status: REPOSITORY READY / ENVIRONMENT ADMISSION PENDING

Scope: JTV-23 through JTV-31 plus the JTV-LIVE.FINAL forward-port and production-closeout pass.

## Completed repository chain

- Ask Jhadina media runtime composes catalog discovery, viewing context, media knowledge, and the media advisor through explicit ports.
- Viewing behavior remains approval-gated before memory promotion.
- Media perception is gated by the explicit `ai-analysis` media right.
- Territory-restricted authorization fails closed when territory context is absent or disallowed.
- Playback sources must be HTTPS and must explicitly grant `playback`.
- Casting now requires a separate explicit `casting` right; playback permission alone no longer exposes AirPlay, Google Cast, or JhadinaTV receiver transfer.
- The stale JhadinaTV PR #150 is not merged. Its unique Live TV work was forward-ported onto current main semantics instead.
- Live TV channel metadata, current-program guide selection, deterministic Jhadina virtual channels, M3U parsing, and XMLTV parsing now live in the canonical TV core.
- M3U import remains discovery metadata only. An imported playlist URL is not automatically treated as an authorized source.
- Live guide metadata never carries a raw playable stream URL. Channel selection resolves through the canonical CatalogRegistry -> MediaSource -> authorization gate.
- A Jellyfin production bridge now exists at the web/server boundary. Credentials stay server-side and playback is exposed through a same-origin streaming proxy.
- Jellyfin is not registered unless the deployment supplies server URL, API key, user id, public HTTPS origin, the explicit `playback` right, and at least one rights-evidence id.
- Live TV status and guide endpoints fail closed when that admission bundle is incomplete.
- JhadinaTV PR CI uses a frozen lockfile and now type-checks both TV Core and the Jhadina Web integration.

## Provider admission environment

The Jellyfin adapter recognizes these deployment values:

- `JHADINA_TV_JELLYFIN_URL` — HTTPS Jellyfin server URL.
- `JHADINA_TV_JELLYFIN_API_KEY` — server-side credential; never placed in client playback URLs.
- `JHADINA_TV_JELLYFIN_USER_ID` — Jellyfin user identity used for catalog/guide calls.
- `JHADINA_PUBLIC_ORIGIN` — HTTPS public origin for the rights-gated proxy URL. Vercel production origin may be inferred when available.
- `JHADINA_TV_JELLYFIN_RIGHTS` — comma-separated admitted rights. `playback` is mandatory; `casting` is independent.
- `JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS` — one or more deployment-controlled evidence identifiers proving the granted rights.
- `JHADINA_TV_JELLYFIN_TERRITORIES` — optional comma-separated territory restrictions.
- `JHADINA_TV_TERRITORY` — optional current deployment/user territory supplied to playback authorization.
- `JHADINA_TV_JELLYFIN_LIVE_STREAM_PATH_TEMPLATE` and `JHADINA_TV_JELLYFIN_VOD_STREAM_PATH_TEMPLATE` — optional server-specific stream path overrides using `{id}`.

No code path invents rights or marks missing credentials as authorized.

## Final admission chain

Provider credentials + verified rights evidence
-> provider admission
-> CatalogRegistry
-> canonical media/channel identity
-> guide metadata
-> source resolution
-> HTTPS proxy
-> authorization status
-> expiry/territory checks
-> scoped MediaRight
-> local playback
-> optional separately-authorized casting
-> session continuity.

## What remains outside repository control

Repository implementation is complete for JTV-LIVE.FINAL. Overall production status remains fail-closed until execution evidence exists for:

1. a real admitted Jellyfin/authorized TV deployment with the environment above;
2. one successful real Live TV playback receipt;
3. current-main production deployment lineage;
4. the production two-user RLS isolation drill already tracked by MEDIA-PROD.ENV;
5. physical iPhone/PiP/AirPlay/Google Cast/JhadinaTV receiver/Homebase handoff receipts for the devices actually used.

Those are environment/hardware receipts, not missing application architecture. Do not weaken the admission gates merely to label the environment READY.

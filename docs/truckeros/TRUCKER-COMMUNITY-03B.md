# TRUCKER-COMMUNITY.03B — local preview HTTP boundary

The social pages and API are **development-preview only**, explicitly failing closed in production, until production authentication, CSRF/rate-limiting, verified sign-up/recovery, moderation and backup restoration are complete.

To enable a *local Node >=22.16 development host only*, set `TRUCKEROS_COMMUNITY_PREVIEW=1` and `TRUCKEROS_COMMUNITY_DATABASE_PATH=/absolute/persistent/volume/truckeros-community.sqlite`. The preview authenticates via same-site HttpOnly session cookies, rejects cross-origin mutations, limits JSON payload size, never trusts a client-supplied actor ID and does not access vehicle GPS. Do **not** set these flags on a public hosting target. Root prototype /api/driver remains separate and unauthenticated; it is not a community identity.

The preview UI exposes registration and login, consent, scoped feed, posting, likes, bookmarks, comments, profile discovery, incoming friend requests, accepted friends and a FunFinder route link. There is deliberately no fake feed, automatic geo-sharing, external media upload or public Crew-Up lobby.

Expected next: production-safe auth provider/session enforcement, persistent abuse thresholds, email verification/recovery, moderation pipeline, uploaded media virus checks/quotas, direct messages, groups and notification workers; then certifiable deployment.

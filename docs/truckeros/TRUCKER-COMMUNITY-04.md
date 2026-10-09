# TRUCKER-COMMUNITY.04 — FunFinder-linked driver reviews

Completed: Persist amenity-specific 1-5 driver self-reports with an optional claimed observation date, audience-scoped friends/network visibility, mutual blocks and author opt-out. The report action logs a complaint and immediately hides the post for its reporter without global takedown. No verified parking badge or routing intelligence is modified by crowd opinion.

The local-preview API requires existing community session and social opt-in. Review submission checks the exact place ID against FunFinder's current server-side catalog. The place details UI displays reports with explicit self-reported/independently-unverified provenance, review audience and freshness, plus abuse reporting controls. Missing or invalid GPS values no longer silently become 0,0 in FunFinder.

Native Node SQLite tests cover persistence, visibility, forged/future observation dates, blocking, opt-out, reporting and reporter-only hiding.

Not production ready: preview routes remain locked in production. FunFinder's provider catalog still lives in memory, so stable cross-restart review references require a durable catalog. Login abuse limits, account verification and recovery, centralized moderation/appeals, secure media uploads and scanner, encrypted backup/readback/restore, and a real always-on host remain blockers. Do not conflate user reviews with provider-verified access, parking legality, hygiene or safety.

Next: community moderation/management queues, identity hardening and data exports, durable catalog, and approved phone-based deployment.
# TRUCKER-COMMUNITY.05 — authentication abuse protection and moderation

## Implemented in SQLite (requires Node >=22.16)
- Persisted per-normalized-email login failures across process restarts; five failed attempts trigger a 15-minute lock. Unknown and existing accounts both use generic credential errors and the same throttling path.
- Role-based moderation queue includes reports on friend-only content, visible only to authenticated moderators. Moderator decisions `hide`, `retain`, `restore` are append-only; the current moderation state is separate. Every decision records an explanation, actor, timestamp and affected post, and closes pending reports on that post.
- Globally hidden posts are excluded from normal feeds, interactions and review listings. Restoring a post does **not** override friends-only visibility or a reporter's personal hide.
- Assigning moderator status requires an explicit, >=32-character bootstrap secret passed **only to an offline SqliteTruckerCommunity constructor**. The Next.js API constructs the database without any moderator secret, has no grant endpoint, and must never receive this secret. No self-elevation via registered accounts.
- Tests verify persistent throttling, unauthorized access refusal, role bootstrap denial, reversible moderation, reporter-specific hiding, content permissions and cross-restart durability.

## Still blocked for production
- An email-based limiter alone does **not** prevent distributed password-spraying or mass fake registrations. Add shared trusted-proxy/device/IP limits, verified registration, recovery, anti-enumeration controls, and audits before enabling public user auth. Production community routes still fail closed.
- Moderation needs an operator UI, appeals workflow, retention policy and safe escalation; the schema foundation does not constitute a fully staffed trust-and-safety program.
- Supabase remains optional. Hosting still requires persistent file storage, encrypted off-host backups and independently tested restoration; none were commissioned here.
- FunFinder's place catalog is still in-memory and must become persistent to avoid review reference loss after host restart.

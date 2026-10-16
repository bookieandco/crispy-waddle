# TRUCKER-COMMUNITY.05C — phone moderator console, preview only

Web route: `/community/moderation` is viewable on phones but requires existing authenticated moderator role; the server enforces that role for every GET and POST. Hide decisions require positive confirmation and a recorded reason. Retain/restore/hide and their evidence are stored in SQLite; reported friend-only posts appear only to moderators, never in the general feed.

**Bootstrap:** only on the authorized machine running the persistent database: register the operator as a community user; then on that same machine, in a direct interactive terminal, set environment variables `TRUCKEROS_COMMUNITY_DATABASE_PATH` (absolute persistent path), `TRUCKEROS_MODERATOR_BOOTSTRAP_SECRET` (32+ characters) and `TRUCKEROS_MODERATOR_EMAIL` (existing account), then run `pnpm --filter @jhadina/truckeros-core moderator:bootstrap`. Do not commit or paste the secret or place it in browser code. The web server does not receive the bootstrap secret and exposes no role-granting endpoint.

The entire community preview remains disabled with NODE_ENV=production. Do not expose next dev outside an isolated/trusted local network. This is not a public appeals workflow or moderation certification. Add proper verification, appeal handling, operator access review and backups before launch.

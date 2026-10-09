# TRUCKER-COMMUNITY.02 — durable accounts and privacy

Source: packages/truckeros-core/src/community/SqliteCommunityStore.ts

Completed as code (not deployed): a Node-only SQLite repository supporting unique email/driver handles, scrypt password hashing, random opaque seven-day sessions stored only as SHA-256 token digests, session revocation, privacy opt-in, profiles, profile discovery, friend request/accept/block, private-by-default social posting, public network posts, place reviews and friends-filtered feed. SQLite schemas also reserve groups, meetups and reports for the next milestone. Sensitive data is not returned in social records. Audit logs store event metadata, never password or raw session token.

Tests: packages/truckeros-core/src/community/SqliteCommunityStore.test.ts checks opt-in defaults, restart survival, visibility, friendship approval, blocks, opt-out, password constraints and review validation.

Important runtime constraints:
- node:sqlite DatabaseSync requires Node >=22.16. Set the hosting Node runtime appropriately.
- The SQLite filename must be a durable, mounted host path. An ephemeral cloud function volume and the phone browser are not durable databases.
- This class is deliberately NOT exported from the shared browser index and has NO public HTTP routes. The older prototype's single-user /api/driver endpoint remains a demo, not authentication.
- Do not admit public users until authenticated Next.js cookies, origin/CSRF protection, rate limits, email verification/recovery, authorization, abuse controls, moderation, deletion/export and isolated restore pass.
- Crowd reviews are user opinions, not verified truck parking/safety or live shower availability.
- No implicit GPS, dispatch, ELD, financial, or social opt-in.

Next: TRUCKER-COMMUNITY.03 secure HTTP auth and UI, social feed, groups and private messages, then Crew-Up with explicit voluntary and expiring coarse presence. The older FunFinder remains separate and functional as a driver utility even for users who decline social.

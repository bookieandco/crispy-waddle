# TRUCKER-COMMUNITY.03A — three social reference audits and engagement increment

The user-provided public references are:
- https://github.com/fiqrioemry/fullstack-social-media-application (post likes/comments/bookmarks, nested replies, feeds, profiles, chat and notifications)
- https://github.com/vaibhav4859/Snap-It-MERN (friend discovery, profile edit, privacy controls and chat)
- https://github.com/Qamar2315/Photobook (photo-post flows, simple like/comment and profile UI)

## Intellectual property and security
Do **not** import/copy third-party app source at this stage. Inspected repos have no top-level LICENSE file in the reviewed Git trees; README claims and npm package metadata are inconsistent and cannot substitute for a clear license grant. Photobook commits a .env file (the contents were not accessed), and its upload code uses a local machine path. None of the three projects has a functioning tests script in its package.json in the inspected revision. They are useful as product references only.

## Implementation (original code in TruckerOS)
- Added persistent like, bookmark and threaded-comment tables to existing SQLite schema, preserving default-off social settings.
- All social engagement operations bind the actor to a private session token, verify post visibility (network or accepted friends), check mutual blocks and author's opt-in state. Idempotent like/bookmark writes prevent duplicate reactions on retries.
- Comment parent must refer to an accessible comment on the same post. Filter hidden or blocked comment authors from comment listings/counts.
- No exposing accounts over unauthenticated endpoints, no media processing/uploads, no live vehicle location.
- Fix failing Vitest import of node:sqlite by executing durable store tests under the native Node test runner via tsx, requiring Node >=22.16. Keep remaining pure domain tests under Vitest.
- Photobook-style media sharing is **design only** until antivirus/scanning, file validation, quotas, signed upload and moderation are implemented.
- This remains a server-side foundation; no public social launch is authorized until actual session cookies, CSRF/origin/rate limits, recovery, moderation and backup restore are verified.

## Follow-up
TRUCKER-COMMUNITY.03B: real phone feed UI with auth-backed private pages, post composer, comments, reactions and saved posts.
TRUCKER-COMMUNITY.04: FunFinder amenity reports with provenance and recency.
TRUCKER-COMMUNITY.05: opt-in, time-boxed Crew-Up meetups and safe public venues.

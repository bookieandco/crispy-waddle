# GAME-FINISH.15 — Login outage triage and public local-only gaming

## Evidence (2026-10-10)
- Vercel's `crispy-waddle-jhadina-web` project enables SSO protection on non-custom-domain deployments. A READY preview alone is **not** an anonymous or owner-accessible playable site without Vercel authentication or a specifically issued temporary preview access link.
- Jhadina's own `/login` is **a second layer**: password and passkey flows use canonical SWLC Supabase Auth.
- The connected Supabase projects list described `Swlc` as `ACTIVE_HEALTHY` and the frontend fallback publishable key exactly matched the current public project key, but a **read-only SQL connection returned PostgreSQL FATAL 57P03, “database system is not accepting connections; Hot standby mode is disabled.”** Project metadata health is not proof that authentication/database operations work. Do not claim that the user's password is incorrect based on this error. No password was requested or read.
- The previous middleware performed a live Supabase `getClaims` call even for the static Game Boy lab. That meant genuine local-only gameplay could fail during an auth/database outage even though ROMs/saves remain in the phone's IndexedDB.

## Code changes
1. Explicitly allow **GET and HEAD only** for the Gaming index, the currently bundled Game Boy HTML/JS and licensed 2048 ROM, the original Neon Run shell, the diagnostic page and the approved MIT binjgb local static assets. Every path is enumerated in `PUBLIC_LOCAL_GAMING_PATHS`. These pages do not need the Supabase Auth round trip.
2. **Do not** unlock `/api/*`, private pages (`/ask-jhadina`, `/worlds`, etc.), unknown Game Boy paths, or writes. Existing secure session enforcement is unchanged for those paths.
3. The login page clearly explains that Face ID/passkeys require prior enrollment and provides a link to play the licensed local Game Boy demo without an account.
4. Fixes the previous preview signup confirmation origin fallback from `localhost:3000` to the trusted Vercel-provided `VERCEL_URL` when `VERCEL_ENV=preview`, subject to a strict `*.vercel.app` hostname restriction. **Still needs an approved Supabase Auth redirect allowlist entry** for the preview hostname; do not bypass redirect enforcement.
5. New regression tests cover every important guest static route and prove private API, owner pages, unknown asset paths and POST requests still require authentication.

## Outstanding access blockers
- Vercel preview protection is still enabled. Do not disable it to make gaming work. A temporary Vercel preview access link, if issued, is not a Jhadina account and does not grant Supabase/private access.
- Supabase database/auth availability must be independently confirmed with a functioning read-only connection and a **real authorized test login** before the owner account can be marked restored; never reset the database without an encrypted backup and approval.
- Deployment, iPhone Safari, Save State, passkey and confirmation email behavior must each be physically verified. Passing code CI does not certify actual account login.
- Continue preserving the draft PR until the outstanding global Launch Gate and review conditions are complete.

## Recommended acceptance order
1. Exact-head GitHub CI for this patch.
2. Preview-only Vercel deployment at the exact head with a READY state, without any production alias.
3. Access the preview as an approved team member (or with a temporary authenticated preview share link); verify `/gaming/gameboy/index.html`, `/vendor/binjgb/approved/binjgb.wasm`, and free 2048 play without a Supabase session.
4. Independently re-check Supabase availability, then try password sign-in (not an unconfigured passkey) only after the database is responding. Verify session cookies and private `/ask-jhadina` access; never collect passwords in a chat.
5. Run physical iPhone gameplay and a genuine encrypted save→Drive→isolated restore drill, then review and merge PR #1200.

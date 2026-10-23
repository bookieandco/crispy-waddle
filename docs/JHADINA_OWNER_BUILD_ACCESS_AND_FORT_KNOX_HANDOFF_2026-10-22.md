# Jhadina owner build access + Operation Fort Knox handoff

Date: 2026-10-22. Existing draft PR #1478, branch `sam-procurement-partner-docket-2026-10-22`. No unauthenticated bypass, deployment-protection removal or production release.

## User goal and current behavior
Owner wants the build to **stop repeatedly showing email/password login**, to open the current work page directly, and to postpone any *additional* broad security hardening until a final release phase named **Operation Fort Knox**. Never remove current authentication, money/wallet signing safeguards, provider approval gates or Vercel account protection as a shortcut.

### Root causes of avoidable friction
1. Existing browser Supabase SSR already uses persisted cookies with automatic refresh in middleware; `getClaims` + live `getUser` and owner-email allowlist should prevent repeated prompts on the **same browser and origin** while the session is valid.
2. Owner email magic-link server action previously hard-coded `/settings/security` instead of its requested `next`. Login form did not pass the requested `next`, so one-time email verification sent the owner away from the procurement page they needed.
3. Visiting `/login` while already signed in still rendered sign-in forms because the page did not check for a verified owner session.
4. Middleware previously used only the protected route's `pathname` for `next`, dropping state and procurement review query parameters.
5. Vercel project `crispy-waddle-jhadina-web` has **SSO deployment protection enabled** and only a stable production domain configured. Preview deployments have distinct `*.vercel.app` hostnames; host-scoped cookies/passkeys are not portable between them. A previous new-preview attempt hit the free-plan daily deployment quota. This is a **separate** sign-in layer and cannot be fixed by loosening Jhadina's owner check.

### Current code changes (build mode, not security bypass)
- `apps/jhadina-web/src/app/login/actions.ts`: Supabase `signInWithOtp` uses `safeAuthNext(next)` supplied in the form and returns to that same-origin path after verified callback. Failure and email-sent UX also preserve the destination. No email was sent and no new auth token created during coding.
- `apps/jhadina-web/src/app/login/page.tsx`: verifies a real provider-backed owner via `getUser`; if already signed in, immediately redirects to the safely normalized requested destination. No anonymous bypass; expired/revoked or different accounts must re-authenticate. Owner email form now carries `next` and informs the owner that Face ID/passkeys can be enrolled separately.
- `apps/jhadina-web/src/lib/supabase/middleware.ts`: existing owner authentication and SSR token refresh retained; unauthenticated routes now preserve path **and** query in a single encoded `next`; auth redirects have `private, no-store` and `no-referrer` headers.
- Added regression checks: `src/app/login/page.test.tsx`, updated `src/app/login/owner-email-link.test.ts` and `src/lib/supabase/middleware.test.ts`. Assertions cover verified owner direct return, unverified-owner denial, path/query preservation, hostile external redirect rejection and no anonymous protected access.

## How owner should access the current procurement build
- Source route on the branch: `/opportunity/procurement` (no need to visit home or Ask first).
- **Deep-link pattern:** `https://<verified-private-preview-host>/opportunity/procurement`. If the owner has a valid session for **that exact host**, it opens directly; otherwise Jhadina requests **one** normal owner unlock and returns there (including query parameters).
- Do **not** falsely label an earlier READY preview as containing a newer commit. A private Vercel preview must be built and marked READY at the exact PR commit before claiming current UI availability. Keep protection on.
- After initial unlock on iPhone Safari, use **Add to Home Screen** for the stable same-host URL and avoid switching among hash-suffixed preview URLs. Safari private browsing, clearing cookies, a new domain, Supabase revocation/timeout or project SSO expiry can legitimately require unlocking again.
- Avoid repeated OTP attempts under the Supabase email sending rate limit; use the existing owner passkey when supported.

## Release work still due
1. Exact-head GitHub CI passes after auth changes; test actual iPhone Safari owner session and Face ID, not only CI Chromium.
2. Establish a **stable owner-controlled private build preview hostname** pointing to a tested preview, with Vercel preview SSO still on; arrange Supabase Auth redirect allowlisting and safe callback origin before depending on it. Do not use an unverified arbitrary Host header or open redirects to build an OTP return origin.
3. Confirm actual Supabase session expiration/refresh behavior on that host. Do not change project-wide Auth lifetime, email provider policies, public row security, or wallets to reduce prompts. Wallet signing is a distinct action requiring its own authorization.
4. **Operation Fort Knox:** threat-model and audit actual deployed routes and Supabase policies (owner verification, refresh/revocation, WebAuthn recovery/MFA, CSRF, OAuth allowlists, service-role separation, secrets, financial/wallet key custody, spending and trading caps, origin protection, SSR caching, audited approvals, least privilege and emergency rollback). Require explicit owner acceptance for paid provider changes, deployment, privilege changes, production merge, or signing.

## Acceptance terms
The owner should be asked to log in only when the genuine session is absent/expired/revoked, a different origin or new browser is used, or independent Vercel session requires it. No code can guarantee a literal permanent login across domains or security-controlled session revocations; smooth build access is distinct from universal unlocked access.

# Jhadina iPhone passkey sign-in failure — evidence, correction and owner acceptance

**Date:** October 23, 2026. **Context:** iPhone Safari screenshot at about 3:19 p.m. Pacific; private branch hostname `crispy-waddle-jhadina-web-git-sam-cf6308-bookieandcos-projects.vercel.app`. Existing PR #1478, still draft/unmerged. No changes to authentication provider secrets, WebAuthn relying-party ID, Vercel project SSO, privileged routes, production or paid services.

## Verified facts
- Screenshot shows the normal owner login page and the generic message **"Could not verify your passkey. Please try again or use another sign-in method."** The browser rendered the passkey sign-in action, but the generic error string does not distinguish RP mismatch, challenge expiry, missing credential, SDK transport failure, or account mismatch.
- Current code: client `createBrowserClient(...,{auth:{experimental:{passkey:true}}})`, and `performPasskey` calls Supabase `signInWithPasskey()`, validates the returned user/session and verified owner, then navigates back to internal requested page. The page deliberately requires owner verification; the email link and existing password remain independent recovery methods.
- Read-only Supabase inspection: **one passkey is registered** in `auth.webauthn_credentials`; it had a recorded successful use at **2026-10-23 18:10:55 UTC** (11:10 a.m. Pacific). Two authentication challenges were created in the 22:00 UTC hour. Backend data confirms neither "no passkey ever registered" nor "Face ID always broken." It **does not conclusively identify which registered site the iPhone selected or the failed provider code**.
- Supabase's WebAuthn documentation states that passkeys depend on a stable WebAuthn RP ID and an allowed origin. Changing RP ID invalidates previously enrolled credentials. Switching one-off preview hostnames is a plausible **hypothesis**, not a confirmed cause for this particular failed sign-in. The user's true passkey error code was hidden by the previous generic mapping.

## Implemented safe remediation (source only until preview READY)
- `apps/jhadina-web/src/lib/auth/passkey.ts`: explicit user-readable cases for `ERROR_INVALID_RP_ID`, `ERROR_INVALID_DOMAIN`, `SecurityError`, `webauthn_verification_failed`, missing credential, challenge already consumed/expired, and an unavailable experimental SDK method. Displays only whitelisted public diagnostic codes; no credential IDs, browser assertion, secret, WebAuthn raw provider message or token is returned.
- `apps/jhadina-web/src/app/login/passkey-action.tsx`: failure displays a *one-tap owner email-link fallback* and the sanitized diagnostic code, without silently granting access, force-signing out a valid unrelated session, or automatically retrying multiple WebAuthn challenges.
- `apps/jhadina-web/src/app/login/page.tsx`: visibly displays "**Face ID not working? Open email sign-in**" with same-origin, internal `next` navigation; `recover=1` expands the correct email form and scrolls to it. The owner-only server verifies Supabase email tokens, and protects open redirects.
- Unit tests updated in `src/lib/auth/passkey.test.ts` and `src/app/login/page.test.tsx`. The new test cases ensure hidden error messages are not disclosed and verify that owner email fallback preserves the Procurement destination.
- Existing owner authentication, protected source, Vercel SSO, Supabase session policies, Money Core, wallet signing and bid/payment permissions remain intact.

## Actual iPhone acceptance checklist
1. Open **only the stable protected branch alias** `https://crispy-waddle-jhadina-web-git-sam-cf6308-bookieandcos-projects.vercel.app/opportunity/procurement` in iPhone Safari, not an ephemeral `...-random...vercel.app` deployment URL. Never use private browsing when testing persistent sessions.
2. If Face ID fails, tap "**Use owner email link instead**" or "**Face ID not working? Open email sign-in**." Trigger one legitimate owner-only email link, open it on the **same domain/device**, and verify Procurement opens without a second email prompt. Never share token or password in bug reports.
3. After a successful owner session, visit **Security Settings** on the same host. Attempt a *new* iCloud Keychain Face ID passkey enrollment only after verifying the current Auth project's WebAuthn RP ID/origin and existing credential: **do not delete the only known registered credential or modify RP ID speculatively**.
4. Sign out only after verifying you have a functioning recovery route, then attempt Face ID on the **same origin**. Collect **only the displayed sanitized diagnostic code** if verification fails again. Confirm session persistence and navigation back to Procurement after reloading.
5. If `webauthn_verification_failed`, `ERROR_INVALID_RP_ID` or `ERROR_INVALID_DOMAIN` persists, obtain current Supabase Auth configuration/RP origins using an authorized management-console read, then review exact root cause. Do not weaken settings, change RP ID, delete credentials or remove Vercel protection without explicit separate security approval.

## Acceptance statuses
- Source fix: committed to PR #1478; needs exact-head CI/preview verification.
- Owner iPhone passkey success: **NOT verified by this change**.
- Supabase RP/origin production configuration: **not read or modified**.
- Authentication controls relaxed: **no**.

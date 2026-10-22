# Jhadina navigation and passkey usability

Base: `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`. Extends the existing shell, world registry and Supabase passkey path; no new authentication service or subsystem.

## Changes

- Worlds menu now derives its destinations from the canonical registry, including labeled demo destinations. Preserve Side Hustles, Relationships and Privacy links, and expose Security directly.
- Sports opens the existing `/sports-lab` from Home, feed and registry. Work and Home expose Music Restoration, Juggernaut and other existing operator surfaces.
- Unfinished worlds have a local interactive capability preview, explicitly marked sample-only. The preview performs no network mutations.
- Mobile worlds menu stays within the viewport and scrolls. More can close its own menu; menu selections close it. Keyboard activation of an inner feed link no longer triggers its parent card handler. Previously inert feed actions open details.
- Owner passkey unlock is the primary login action. First-time email enrollment and password recovery remain available. Hide OS navigation on authentication pages and use the shared visual language, larger touch targets and readable inputs.

## Evidence

- 41 targeted tests pass: world registry, passkey, owner policy, login outage, owner middleware, middleware and auth confirmation.
- `pnpm type-check` passes. `git diff --check` passes.
- Directory route regression checks every registered destination against App or Pages Router files. Static literal internal href scan found no missing page destinations; this does not prove every runtime interaction or provider is operational.
- Read-only live Supabase queries: Jhadina project ACTIVE_HEALTHY; exactly one owner account, confirmed, and one owner WebAuthn credential. No credentials, account state or provider configuration changed.
- Actual Face ID sign-in and iPhone visual acceptance remain unverified. Browser runtime download failed in this environment. Supabase passkey uses the device's authenticator; biometric-only operation cannot be guaranteed because iOS controls passcode fallback.
- Production build completed successfully (`next build`, Next.js 14.2.35). No deployment or merge is performed by this change.
- GitHub branch push was blocked by automatic approval review pending explicit authorization of the repository destination. Changes remain committed locally.

## Remaining acceptance

1. Run exact-commit CI and production build.
2. Private iPhone: open Home → every menu destination; test More toggles, scroll and back navigation; verify demo labels and capability selection.
3. Owner: unlock using the existing passkey on its enrolled HTTPS origin, reload a protected page, cancel/retry and confirm non-owner denial. Keep the existing RP domain stable.
4. Live provider readiness and data must be assessed within each workspace. A route-backed UI is not evidence that its external provider is commissioned.

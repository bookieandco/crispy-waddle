# Jhadina passkey sign-in admission

## Implemented

Login prioritizes passkeys using Supabase's native WebAuthn ceremony. The SSR browser client writes the standard Supabase session cookies; middleware and existing owner-identity verification remain authoritative. No custom JWTs or credential database are introduced.

The protected `/settings/security` page registers a passkey only after server-side and browser-side user verification. Authentication and registration failures do not navigate or report success. Unsupported browsers, cancellation and disabled-provider errors are explained. Existing sign-in options remain available for initial enrollment and recovery. Failed password sign-in preserves the intended destination.

The existing resolved Supabase JS version, 2.116.0, is now pinned exactly. Native passkeys are experimental; implementation follows https://supabase.com/docs/guides/auth/passkeys. The authenticator chooses biometrics, device PIN or a security key; WebAuthn does not guarantee biometric-only verification. No biometric templates reach Jhadina.

## Production prerequisite — still blocked

A request to SWLC's documented `/auth/v1/passkeys/authentication/options` endpoint returned HTTP 404, `passkey_disabled`, `Passkeys are disabled`. No auth configuration was changed and no credential was enrolled.

Enable Authentication → Passkeys on project `kqbkaozfjubkjevdfvic` with:

- Relying Party Display Name: `Jhadina`
- Relying Party ID: `crispy-waddle-jhadina-web.vercel.app`
- Relying Party Origins: `https://crispy-waddle-jhadina-web.vercel.app`

Use only the stable production alias, not changing preview URLs. If a permanent custom domain is selected before enrollment, use that domain instead: changing the RP ID later requires re-enrollment. Do not disable existing account recovery methods before real-device acceptance.

## Admission steps

1. Enable the project configuration and confirm the options endpoint returns a challenge.
2. Deploy after normal CI gates pass.
3. On the owner's iPhone, verify the existing account once, open `/settings/security`, and choose Add a passkey. The user must complete their device's credential-enrollment prompt.
4. Sign out and use Sign in with a passkey; verify the server identifies the same owner.
5. Reload a protected page, verify owner session persistence, cancel one ceremony, and check a failed ceremony does not admit a session.
6. Run the Ask → saved result → reload acceptance flow.

Code validation: 9 focused authentication tests pass. Full web type-check and targeted lint pass. Physical Face ID, cookie round-trip and production provider activation remain unverified until the above sequence runs.

# JH-FACEID.OWNER — SMTP 429 diagnosis, 2026-10-20

## Exact owner symptom
Screenshot: Jhadina's owner-only `/login` is accessible on iPhone, but a click on `Email my one-time sign-in link` returned generic `service_unavailable`.

## Confirmed root cause
Canonical SWLC Supabase project `kqbkaozfjubkjevdfvic` records POST `/otp` at **2026-10-20 17:14:57 UTC** and **17:15:22 UTC**: both returned **HTTP 429**, `error_code=over_email_send_rate_limit`, with message `email rate limit exceeded`.

Logs' `referer` now points to `https://crispy-waddle-jhadina-jcb9wikw6-bookieandcos-projects.vercel.app/auth/confirm?next=%2Fsettings%2Fsecurity` (not localhost), supporting that the immediate link destination selection is corrected for those requests. This does **not** certify the subsequent email callback/session.

Live owner identity `dorianmorris8@icloud.com` exists and email is confirmed. No successful full-owner browser sign-in was observed in the account table at inspection. No account changes were made.

## App-level fix
Previously `sendOwnerSignInLink` mapped every Supabase error, including a 429, to `service_unavailable`. It now maps 429 to `rate_limited`, informs the owner that no new link was sent, and keeps existing password sign-in available. Tests explicitly verify the HTTP 429 classification. The code avoids writing provider errors or access tokens into UI output. The password/passkey and server-side owner admission checks remain unchanged.

## Operator-owned blocker and next action
Supabase's built-in SMTP is rate limited project-wide; see <https://supabase.com/docs/guides/auth/rate-limits> and <https://supabase.com/docs/guides/auth/auth-smtp>. **Stop requesting OTPs.** Either wait until the project-wide quota replenishes (not just the 60-second per-user retry window), or configure reviewed custom SMTP credentials through Supabase Authentication → SMTP Settings; doing so requires explicit owner-controlled provider credentials, potentially billing, and approval. Do not weaken email verification or bypass identity.

If the owner knows the password already set on the verified account, use the existing password form and verify a real session before enrolling Face ID. If not, email link or password recovery requires email delivery. No sent email, token, passkey registration, Supabase Auth config change, user change, production merge, public exposure, or costs occurred in this repair.

Even after email delivery returns, a proper iPhone callback/session and passkey provider activation on a stable HTTPS RP domain remain outstanding. Draft PR chain #1424 then #1425, each exact-head CI and private preview verification.

export type AuthFailureCode =
  | 'invalid_credentials'
  | 'signup_failed'
  | 'service_unavailable'
  | 'rate_limited'
  | 'session_not_established';

/** Translate provider/network errors into low-detail, user-safe states. */
export function authFailureCode(
  error: unknown,
  ordinaryFailure: 'invalid_credentials' | 'signup_failed',
): AuthFailureCode {
  if (!error || typeof error !== 'object') return 'service_unavailable';
  const status = (error as { status?: unknown }).status;
  if (status === 429) return 'rate_limited';
  if (typeof status === 'number' && status >= 500) return 'service_unavailable';
  if ((error as { name?: unknown }).name === 'AuthRetryableFetchError') return 'service_unavailable';
  return ordinaryFailure;
}

const MESSAGES: Readonly<Record<string, string>> = {
  invalid_credentials: 'We could not sign you in. Check your email and password.',
  signup_failed: 'We could not create the account. Check your details or try again.',
  service_unavailable: 'Jhadina sign-in is temporarily unavailable. Your request was not completed; try again after service is restored.',
  rate_limited: 'Supabase has temporarily hit its email sending limit. No new sign-in link was sent. Wait for the limit to reset; if you already set a password, you can use it below. Do not keep requesting emails.',
  session_not_established: 'We could not establish a secure sign-in session. Please retry your email/password sign-in.',
  missing_credentials: 'Enter your email address and password.',
  owner_access_required: 'This private workspace is available only to the verified Jhadina owner account.',
  signup_requirements: 'Enter a valid email address and a password of at least eight characters.',
  recovery_email_required: 'Enter your email to request a password reset.',
  recovery_rate_limited: 'Too many password reset requests. Try again later.',
  recovery_unavailable: 'Password recovery is temporarily unavailable. Please retry later.',
  password_mismatch: 'Passwords do not match. Enter the same password in both fields.',
  password_requirements: 'Use a password of at least eight characters.',
  password_session_required: 'The password reset link has expired or is invalid. Request a new link.',
  password_change_failed: 'We could not update the password. Request a new link and try again.',
};

export function authPageErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return MESSAGES[code] ?? 'Authentication could not be completed.';
}

/** Production must NEVER send a confirmation email pointing at localhost. */
export function authConfirmationOrigin(env: {
  siteUrl?: string;
  appUrl?: string;
  vercelEnv?: string;
  vercelUrl?: string;
}): string {
  for (const source of [env.siteUrl, env.appUrl]) {
    if (!source) continue;
    try {
      const url = new URL(source);
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      const localAllowed = env.vercelEnv !== 'preview' && env.vercelEnv !== 'production';
      if ((!local && url.protocol === 'https:') ||
          (local && localAllowed && url.protocol === 'http:')) {
        return url.origin;
      }
    } catch {
      // Invalid configured URL: continue to safe canonical fallback.
    }
  }
  if (env.vercelEnv === 'preview' && env.vercelUrl) {
    try {
      const hostname = new URL('https://' + env.vercelUrl).hostname;
      if (/^[a-z0-9-]+\.vercel\.app$/i.test(hostname)) return 'https://' + hostname;
    } catch { /* An invalid deployment host must not become a redirect. */ }
  }
  return env.vercelEnv === 'production' || env.vercelEnv === 'preview'
    ? 'https://crispy-waddle-jhadina-web.vercel.app'
    : 'http://localhost:3000';
}

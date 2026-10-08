export type AuthFailureCode =
  | 'invalid_credentials'
  | 'signup_failed'
  | 'service_unavailable'
  | 'rate_limited';

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
  rate_limited: 'Too many sign-in attempts were received. Try again later.',
  missing_credentials: 'Enter your email address and password.',
  signup_requirements: 'Enter a valid email address and a password of at least eight characters.',
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
}): string {
  for (const source of [env.siteUrl, env.appUrl]) {
    if (!source) continue;
    try {
      const url = new URL(source);
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (url.protocol === 'https:' || (local && env.vercelEnv !== 'production')) {
        return url.origin;
      }
    } catch {
      // Invalid configured URL: continue to safe canonical fallback.
    }
  }
  return env.vercelEnv === 'production'
    ? 'https://crispy-waddle-jhadina-web.vercel.app'
    : 'http://localhost:3000';
}

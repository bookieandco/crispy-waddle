import { createServerClient } from '@supabase/ssr';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabasePublicConfig } from '../../src/lib/supabase/public-config';

function cookieHeader(name: string, value: string, options: Record<string, unknown> = {}): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (typeof options.path === 'string') parts.push(`Path=${options.path}`);
  else parts.push('Path=/');
  if (typeof options.domain === 'string') parts.push(`Domain=${options.domain}`);
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (typeof options.sameSite === 'string' || options.sameSite === true) {
    parts.push(`SameSite=${options.sameSite === true ? 'Strict' : String(options.sameSite)}`);
  }
  if (options.secure) parts.push('Secure');
  if (options.httpOnly) parts.push('HttpOnly');
  return parts.join('; ');
}

/** A server-verified, fail-closed owner identity, not an x-user-id or middleware-only assumption. */
export async function requireJtvOwner(req: NextApiRequest, res: NextApiResponse): Promise<string | null> {
  const ownerId = process.env.JHADINA_TV_OWNER_AUTH_USER_ID?.trim();
  if (!ownerId) {
    res.status(503).json({ error: 'JhadinaTV owner identity has not been commissioned.' });
    return null;
  }
  try {
    const supabase = createJtvOwnerClient(req, res);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      res.status(401).json({ error: 'JhadinaTV requires a verified sign-in.' });
      return null;
    }
    if (data.user.id !== ownerId) {
      res.status(403).json({ error: 'This media library is restricted to its owner.' });
      return null;
    }
    return data.user.id;
  } catch {
    res.status(503).json({ error: 'JhadinaTV identity verification is unavailable.' });
    return null;
  }
}

/** Cookie-scoped Supabase client; browser-safe key only, never service role. */
export function createJtvOwnerClient(req: NextApiRequest, res: NextApiResponse) {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return Object.entries(req.cookies ?? {})
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          .map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        const current = res.getHeader('Set-Cookie');
        const previous = Array.isArray(current) ? current.map(String) : current ? [String(current)] : [];
        const added = cookiesToSet.map(({ name, value, options }) =>
          cookieHeader(name, value, (options ?? {}) as Record<string, unknown>));
        res.setHeader('Set-Cookie', [...previous, ...added]);
      },
    },
  });
}

/**
 * JH-CLOSE.03 — canonical durable authority admission.
 *
 * This does not select, migrate or create a database. It rejects unpinned
 * destinations before a privileged Memory client makes any query/write.
 * Production deployment must independently configure expected identity.
 */
export type CanonicalStorageTarget =
  | { kind: 'supabase'; url: string; expectedProjectRef?: string }
  | { kind: 'oidc_gateway'; url: string; expectedProjectRef?: string; expectedGatewayOrigin?: string };

export interface CanonicalStorageAdmission {
  admitted: boolean;
  reason: 'BOUND_SUPABASE' | 'BOUND_PORTABLE_GATEWAY' | 'UNCONFIGURED' |
    'INVALID_URL' | 'INSECURE_TRANSPORT' | 'MISMATCHED_SUPABASE_PROJECT' |
    'UNPINNED_SUPABASE_PROJECT' | 'UNPINNED_GATEWAY_ORIGIN' | 'GATEWAY_PATH_UNVERIFIED';
  provider: CanonicalStorageTarget['kind'];
}

/** No credentials or resource IDs are ever returned in admission receipts. */
export function assessCanonicalStorageTarget(target: CanonicalStorageTarget): CanonicalStorageAdmission {
  const deny = (reason: CanonicalStorageAdmission['reason']): CanonicalStorageAdmission => ({
    admitted: false, reason, provider: target.kind,
  });
  if (!target.url.trim()) return deny('UNCONFIGURED');
  let parsed: URL;
  try { parsed = new URL(target.url); } catch { return deny('INVALID_URL'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) return deny('INSECURE_TRANSPORT');
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith('.supabase.co')) {
    const ref = target.expectedProjectRef?.trim().toLowerCase() ?? '';
    if (!/^[a-z0-9]{10,32}$/.test(ref)) return deny('UNPINNED_SUPABASE_PROJECT');
    if (host !== ref + '.supabase.co') return deny('MISMATCHED_SUPABASE_PROJECT');
    if (target.kind === 'oidc_gateway' &&
        (parsed.pathname !== '/functions/v1/jhadina-memory-gateway' || parsed.search)) {
      return deny('GATEWAY_PATH_UNVERIFIED');
    }
    if (target.kind === 'supabase' &&
        (parsed.pathname !== '/' || parsed.search)) return deny('INVALID_URL');
    return { admitted: true, reason: 'BOUND_SUPABASE', provider: target.kind };
  }
  if (target.kind !== 'oidc_gateway') return deny('MISMATCHED_SUPABASE_PROJECT');
  // Portable gateways must be explicitly origin-pinned. No implicit host trust.
  if (!target.expectedGatewayOrigin?.trim()) return deny('UNPINNED_GATEWAY_ORIGIN');
  let pinned: URL;
  try { pinned = new URL(target.expectedGatewayOrigin); } catch { return deny('INVALID_URL'); }
  if (pinned.protocol !== 'https:' || pinned.origin !== parsed.origin ||
      pinned.pathname !== '/' || pinned.search || pinned.hash || pinned.username || pinned.password) {
    return deny('UNPINNED_GATEWAY_ORIGIN');
  }
  return { admitted: true, reason: 'BOUND_PORTABLE_GATEWAY', provider: target.kind };
}

export function requireCanonicalStorageTarget(target: CanonicalStorageTarget): void {
  const admission = assessCanonicalStorageTarget(target);
  if (!admission.admitted) throw new Error('JHADINA_MEMORY_TARGET_' + admission.reason);
}

/**
 * A newly commissioned paper-learning worker must not expose raw health,
 * runtime counters or owner-sync routes to the public network by default.
 * Remote OIDC sync can be enabled only by a separate explicit host approval.
 */
export function shadowHealthBindAddress(env:Readonly<Record<string,string|undefined>>):'127.0.0.1'|'0.0.0.0' {
  const requested=(env.SHARK_SHADOW_HEALTH_BIND_ADDRESS??'127.0.0.1').trim()
  if(requested==='127.0.0.1')return '127.0.0.1'
  if(requested==='0.0.0.0'&&env.SHARK_SHADOW_REMOTE_BIND_APPROVED==='YES')
    return '0.0.0.0'
  throw new Error('SHADOW_REMOTE_HEALTH_BIND_EXPLICIT_APPROVAL_REQUIRED')
}

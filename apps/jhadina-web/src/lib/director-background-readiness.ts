/**
 * Non-secret Director background commissioning diagnostics.
 *
 * Direct Supabase credentials are optional: the scheduler can use the
 * existing GitHub OIDC -> SWLC service-proxy transport. The presence of
 * either transport never establishes storage health; only live table probes do.
 */
export type DirectorBackgroundCredentialMode =
  | 'direct-service-role'
  | 'scheduler-oidc-proxy'
  | 'unavailable'

export type DirectorBackgroundConfiguration = Readonly<{
  hasSupabaseUrl: boolean
  hasSupabaseServiceRoleKey: boolean
  hasPublicSupabaseBootstrap: boolean
  hasSchedulerBearerIdentity: boolean
  credentialMode: DirectorBackgroundCredentialMode
  hasWatchWorkerUrl: boolean
  hasWatchWorkerToken: boolean
  hasWatchCallbackUrl: boolean
  hasWatchCallbackSecret: boolean
  watchWorkerRequiresRuntimeResolution: true
  watchWorkerReady: 'not-probed'
}>

export function directorBackgroundConfiguration(input: Readonly<{
  directSupabaseUrl: boolean
  directServiceRoleKey: boolean
  publicSupabaseBootstrap: boolean
  schedulerBearerIdentity: boolean
  watchWorkerUrl: boolean
  watchWorkerToken: boolean
  watchCallbackUrl: boolean
  watchCallbackSecret: boolean
}>): DirectorBackgroundConfiguration {
  const direct = input.directSupabaseUrl && input.directServiceRoleKey
  const proxy = !direct && input.publicSupabaseBootstrap && input.schedulerBearerIdentity
  return Object.freeze({
    hasSupabaseUrl: input.directSupabaseUrl,
    hasSupabaseServiceRoleKey: input.directServiceRoleKey,
    hasPublicSupabaseBootstrap: input.publicSupabaseBootstrap,
    hasSchedulerBearerIdentity: input.schedulerBearerIdentity,
    credentialMode: direct ? 'direct-service-role' : proxy ? 'scheduler-oidc-proxy' : 'unavailable',
    hasWatchWorkerUrl: input.watchWorkerUrl,
    hasWatchWorkerToken: input.watchWorkerToken,
    hasWatchCallbackUrl: input.watchCallbackUrl,
    hasWatchCallbackSecret: input.watchCallbackSecret,
    // Watch can resolve through the existing authenticated Hunyuan sidecar
    // and fallback callback origin. Missing direct WATCH_* vars alone do not
    // establish that Watch is unavailable. Do not claim it is ready either.
    watchWorkerRequiresRuntimeResolution: true,
    watchWorkerReady: 'not-probed',
  })
}

export type DirectorBackgroundStorageError = Readonly<{
  code?: string | null
  message?: string | null
}>
export type DirectorBackgroundStorageBlocker =
  | 'DIRECTOR_BACKGROUND_STORAGE_SCHEMA_UNAVAILABLE'
  | 'DIRECTOR_BACKGROUND_STORAGE_AUTHORITY_REJECTED'
  | 'DIRECTOR_BACKGROUND_STORAGE_SERVICE_UNAVAILABLE'
  | 'DIRECTOR_BACKGROUND_STORAGE_PROBE_FAILED'

/** Emit stable, non-sensitive reason codes; never return raw DB errors. */
export function classifyDirectorBackgroundStorageBlocker(
  error: DirectorBackgroundStorageError,
): DirectorBackgroundStorageBlocker {
  const code = (error.code ?? '').toUpperCase()
  if (code === '42P01' || code === 'PGRST205') return 'DIRECTOR_BACKGROUND_STORAGE_SCHEMA_UNAVAILABLE'
  if (code === '42501' || code === 'PGRST301' || code === '401' || code === '403') {
    return 'DIRECTOR_BACKGROUND_STORAGE_AUTHORITY_REJECTED'
  }
  if (['57P03', '53100', '08006', '08001', 'PGRST000', 'PGRST002'].includes(code)) {
    return 'DIRECTOR_BACKGROUND_STORAGE_SERVICE_UNAVAILABLE'
  }
  return 'DIRECTOR_BACKGROUND_STORAGE_PROBE_FAILED'
}

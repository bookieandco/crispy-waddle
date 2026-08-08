export type LoginMethod = 'email-password' | 'magic-link' | 'oauth' | 'otp'

export interface JhadinaTVAccountPolicy {
  allowMultipleSessions: boolean
  requireMfaForNewDevices: boolean
  rememberTrustedDevices: boolean
  syncCatalogPreferences: boolean
  syncWatchProgress: boolean
}

export const DEFAULT_JHADINA_TV_ACCOUNT_POLICY: JhadinaTVAccountPolicy = {
  allowMultipleSessions: true,
  requireMfaForNewDevices: false,
  rememberTrustedDevices: true,
  syncCatalogPreferences: true,
  syncWatchProgress: true,
}

export interface DeviceSession {
  sessionId: string
  deviceLabel: string
  lastSeenAt: string
  trusted: boolean
}

export function canUseJhadinaTVAnywhere(session: DeviceSession | undefined): boolean {
  return Boolean(session?.sessionId)
}

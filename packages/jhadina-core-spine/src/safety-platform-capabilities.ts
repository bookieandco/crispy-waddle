export type SafetyPlatform = 'ios' | 'android' | 'web' | 'unknown';

export interface SafetyPlatformCapabilities {
  readonly platform: SafetyPlatform;
  readonly foregroundAudio: boolean;
  readonly foregroundVideo: boolean;
  readonly backgroundAudio: boolean;
  readonly backgroundVideo: boolean;
  readonly backgroundLocation: boolean;
  readonly notifications: boolean;
  readonly localEncryptedStorage: boolean;
}

export function requirePlatformCapability(
  capabilities: SafetyPlatformCapabilities,
  capability: keyof Omit<SafetyPlatformCapabilities, 'platform'>,
): void {
  if (!capabilities[capability]) throw new Error(`Platform capability unavailable: ${capability}`);
}

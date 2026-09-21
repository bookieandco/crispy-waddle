import { HootsuiteProvider, type SocialProvider } from "@jhadina/social-core"

export function assertHootsuiteOwner(userId: string): void {
  const ownerUserId = process.env.HOOTSUITE_OWNER_USER_ID
  if (!ownerUserId) throw new Error("HOOTSUITE_OWNER_USER_ID is not configured")
  if (ownerUserId !== userId) throw new Error("HOOTSUITE_ACCOUNT_OWNER_MISMATCH")
}

export function createSocialProviderForUser(userId: string, provider: string): SocialProvider {
  if (provider !== "hootsuite") throw new Error(`SOCIAL_PROVIDER_NOT_CONFIGURED:${provider}`)
  assertHootsuiteOwner(userId)
  return new HootsuiteProvider()
}

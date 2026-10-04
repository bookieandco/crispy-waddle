import {
  AyrshareProvider,
  HootsuiteProvider,
  type SocialProvider,
} from "@jhadina/social-core"
import { createAyrshareBindingVault } from "./ayrshare-binding-vault"

export function assertHootsuiteOwner(userId: string): void {
  const ownerUserId = process.env.HOOTSUITE_OWNER_USER_ID
  if (!ownerUserId) throw new Error("HOOTSUITE_OWNER_USER_ID is not configured")
  if (ownerUserId !== userId) throw new Error("HOOTSUITE_ACCOUNT_OWNER_MISMATCH")
}

export async function createSocialProviderForUser(
  userId: string,
  provider: string,
): Promise<SocialProvider> {
  switch (provider) {
    case "hootsuite":
      assertHootsuiteOwner(userId)
      return new HootsuiteProvider()
    case "ayrshare": {
      const bindings = await createAyrshareBindingVault().list(userId)
      if (!bindings.length) throw new Error("AYRSHARE_PROFILE_BINDINGS_NOT_CONFIGURED")
      return new AyrshareProvider({ bindings })
    }
    default:
      throw new Error(`SOCIAL_PROVIDER_NOT_CONFIGURED:${provider}`)
  }
}

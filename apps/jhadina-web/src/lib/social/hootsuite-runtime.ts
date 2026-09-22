import {
  AyrshareProvider,
  HootsuiteProvider,
  type AyrshareProfileBinding,
  type SocialPlatform,
  type SocialProvider,
} from "@jhadina/social-core"

export function assertHootsuiteOwner(userId: string): void {
  const ownerUserId = process.env.HOOTSUITE_OWNER_USER_ID
  if (!ownerUserId) throw new Error("HOOTSUITE_OWNER_USER_ID is not configured")
  if (ownerUserId !== userId) throw new Error("HOOTSUITE_ACCOUNT_OWNER_MISMATCH")
}

export function assertAyrshareOwner(userId: string): void {
  const ownerUserId = process.env.AYRSHARE_OWNER_USER_ID
  if (!ownerUserId) throw new Error("AYRSHARE_OWNER_USER_ID is not configured")
  if (ownerUserId !== userId) throw new Error("AYRSHARE_ACCOUNT_OWNER_MISMATCH")
}

export function createSocialProviderForUser(userId: string, provider: string): SocialProvider {
  switch (provider) {
    case "hootsuite":
      assertHootsuiteOwner(userId)
      return new HootsuiteProvider()
    case "ayrshare":
      assertAyrshareOwner(userId)
      return new AyrshareProvider({ bindings: parseAyrshareBindings() })
    default:
      throw new Error(`SOCIAL_PROVIDER_NOT_CONFIGURED:${provider}`)
  }
}

function parseAyrshareBindings(): AyrshareProfileBinding[] {
  const raw = process.env.AYRSHARE_PROFILE_BINDINGS_JSON
  if (!raw) throw new Error("AYRSHARE_PROFILE_BINDINGS_JSON is not configured")
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error("AYRSHARE_PROFILE_BINDINGS_JSON is invalid JSON")
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("AYRSHARE_PROFILE_BINDINGS_JSON must contain at least one binding")
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`AYRSHARE_PROFILE_BINDING_INVALID:${index}`)
    }
    const record = entry as Record<string, unknown>
    const id = stringField(record, "id", index)
    const profileKey = stringField(record, "profileKey", index)
    const platform = stringField(record, "platform", index) as SocialPlatform
    const name = stringField(record, "name", index)
    const handle = typeof record.handle === "string" && record.handle.trim()
      ? record.handle.trim()
      : undefined
    return { id, profileKey, platform, name, handle }
  })
}

function stringField(record: Record<string, unknown>, field: string, index: number): string {
  const value = record[field]
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`AYRSHARE_PROFILE_BINDING_INVALID:${index}:${field}`)
  }
  return value.trim()
}

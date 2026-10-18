import {
  createZeroRigSuperteamReader, scoutSuperteamAgentListings,
  type ZeroRigScoutResult,
} from '@jhadina/opportunity-core'

/**
 * JH-ZERO-RIG.LIVE.03 — owner-only read runtime.
 * Feature gate and owner binding are mandatory; nothing here registers agents,
 * imports wallet keys, signs transactions, creates submissions or writes records.
 */
export type ZeroRigLiveEnvironment = {
  ZERO_RIG_OWNER_USER_ID?: string
  ZERO_RIG_SUPERTEAM_READS_ENABLED?: string
  ZERO_RIG_SUPERTEAM_API_KEY?: string
}

export type ZeroRigLiveReadiness = {
  state: 'owner_unconfigured' | 'forbidden' | 'disabled' | 'credential_missing' | 'ready'
  liveProviderReadAllowed: boolean
  ownerAuthenticated: boolean
  credentialsConfigured: boolean
  mode: 'READ_ONLY'
  externalActionsAuthorized: false
}

export function checkZeroRigLiveReadiness(
  userId: string,
  env: ZeroRigLiveEnvironment,
): ZeroRigLiveReadiness {
  const owner = env.ZERO_RIG_OWNER_USER_ID?.trim()
  const actor = userId.trim()
  const authorizedOwner = !!owner && !!actor && actor === owner
  const credentialPresent = !!env.ZERO_RIG_SUPERTEAM_API_KEY?.trim()
  const state: ZeroRigLiveReadiness['state'] =
    !owner ? 'owner_unconfigured' :
    !authorizedOwner ? 'forbidden' :
    env.ZERO_RIG_SUPERTEAM_READS_ENABLED !== 'true' ? 'disabled' :
    !credentialPresent ? 'credential_missing' : 'ready'
  return {
    state,liveProviderReadAllowed:state==='ready',
    ownerAuthenticated:authorizedOwner,credentialsConfigured:credentialPresent,
    mode:'READ_ONLY',externalActionsAuthorized:false,
  }
}

export async function executeZeroRigReadOnlyScout(input: {
  userId: string
  env: ZeroRigLiveEnvironment
  now: string
  take?: number
  fetchImpl?: typeof fetch
}): Promise<ZeroRigScoutResult> {
  const readiness = checkZeroRigLiveReadiness(input.userId,input.env)
  if (!readiness.liveProviderReadAllowed) throw new Error('ZERO_RIG_READ_UNAVAILABLE')
  const reader=createZeroRigSuperteamReader({
    apiKey:input.env.ZERO_RIG_SUPERTEAM_API_KEY!,
    fetchImpl:input.fetchImpl,
  })
  return scoutSuperteamAgentListings(reader,{now:input.now,take:input.take??20})
}

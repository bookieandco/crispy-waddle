export type RecoverySearchHealth = {
  searchConfigured: boolean
  endpointConfigured: boolean
  credentialConfigured: boolean
  endpointHost: string | null
  endpointProtocol: string | null
  noQueryExecuted: true
  noExternalActionAuthority: true
}

function safeEndpoint(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

export type RecoverySearchEnv = {
  WEB_SEARCH_URL?: string
  WEB_SEARCH_API_KEY?: string
}

export function getRecoverySearchHealth(
  env: RecoverySearchEnv = {
    WEB_SEARCH_URL: process.env.WEB_SEARCH_URL,
    WEB_SEARCH_API_KEY: process.env.WEB_SEARCH_API_KEY,
  },
): RecoverySearchHealth {
  const endpoint = safeEndpoint(env.WEB_SEARCH_URL)
  const credentialConfigured = Boolean(env.WEB_SEARCH_API_KEY?.trim())

  return {
    searchConfigured: Boolean(endpoint && credentialConfigured),
    endpointConfigured: Boolean(endpoint),
    credentialConfigured,
    endpointHost: endpoint?.hostname || null,
    endpointProtocol: endpoint?.protocol || null,
    noQueryExecuted: true,
    noExternalActionAuthority: true,
  }
}

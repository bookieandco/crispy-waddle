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

export function getRecoverySearchHealth(
  env: NodeJS.ProcessEnv = process.env,
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

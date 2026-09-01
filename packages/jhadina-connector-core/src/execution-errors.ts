export class ConnectorExecutionAmbiguousError extends Error {
  readonly recoveryRequired = true
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ConnectorExecutionAmbiguousError'
    this.cause = cause
  }
}

export function isConnectorExecutionAmbiguousError(error: unknown): boolean {
  return error instanceof ConnectorExecutionAmbiguousError || (
    typeof error === 'object' &&
    error !== null &&
    (error as { recoveryRequired?: unknown }).recoveryRequired === true
  )
}

/**
 * Classify provider transport failures only when the provider outcome cannot
 * be established. Definitive HTTP/application rejections remain ordinary
 * failures and must not trigger recovery retries.
 */
export function shouldTreatTransportErrorAsAmbiguous(error: unknown): boolean {
  if (error instanceof ConnectorExecutionAmbiguousError) return true
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    recoveryRequired?: unknown
    status?: unknown
    statusCode?: unknown
    code?: unknown
    name?: unknown
  }

  if (candidate.recoveryRequired === true) return true

  const status = typeof candidate.status === 'number'
    ? candidate.status
    : typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : undefined

  // A response proving rejection is definitive. 429 is intentionally
  // ambiguous because a request may have reached the provider before the
  // rate-limit response was produced.
  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500
  }

  const code = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : ''
  const name = typeof candidate.name === 'string' ? candidate.name.toLowerCase() : ''

  // These indicate that the client lost certainty about the result.
  return (
    name === 'aborterror' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNABORTED' ||
    code === 'EPIPE' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET'
  )
}

export function toConnectorExecutionError(error: unknown): ConnectorExecutionAmbiguousError | undefined {
  return shouldTreatTransportErrorAsAmbiguous(error)
    ? new ConnectorExecutionAmbiguousError(
        error instanceof Error ? error.message : 'Provider outcome is ambiguous',
        error,
      )
    : undefined
}

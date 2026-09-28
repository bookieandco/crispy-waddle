import {
  constants,
  createPrivateKey,
  createSign,
  sign as cryptoSign,
  type KeyObject,
} from 'node:crypto'

const KALSHI_BALANCE_PATH = '/portfolio/balance'
const ENVIRONMENTS = {
  demo: 'https://external-api.demo.kalshi.co/trade-api/v2',
  production: 'https://external-api.kalshi.com/trade-api/v2',
} as const

export type KalshiEnvironment = keyof typeof ENVIRONMENTS
export type KalshiKeyType = 'ed25519' | 'rsa'
export type KalshiHealthStatus =
  | 'AUTHENTICATED'
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'AUTH_REJECTED'
  | 'UPSTREAM_ERROR'

export type KalshiHealthReceipt = {
  ok: boolean
  status: KalshiHealthStatus
  environment: KalshiEnvironment | null
  baseUrl: string | null
  keyIdPresent: boolean
  privateKeyPresent: boolean
  keyType: KalshiKeyType | null
  authenticated: boolean
  providerHttpStatus: number | null
  checkedAt: string
  evidence: readonly string[]
}

export type KalshiRuntimeConfig = {
  environment: KalshiEnvironment
  apiKeyId: string
  privateKey: KeyObject
  keyType: KalshiKeyType
  baseUrl: string
}

function decodePrivateKeyFromEnv(env: NodeJS.ProcessEnv): string | null {
  const encoded = env.KALSHI_PRIVATE_KEY_BASE64?.trim()
  if (encoded) {
    try {
      const pem = Buffer.from(encoded, 'base64').toString('utf8').trim()
      return pem || null
    } catch {
      return null
    }
  }

  const raw = env.KALSHI_PRIVATE_KEY?.trim()
  if (!raw) return null
  return raw.replace(/\\n/g, '\n')
}

function classifyKey(key: KeyObject): KalshiKeyType | null {
  if (key.asymmetricKeyType === 'ed25519') return 'ed25519'
  if (key.asymmetricKeyType === 'rsa' || key.asymmetricKeyType === 'rsa-pss') return 'rsa'
  return null
}

function normalizeEnvironment(value: string | undefined): KalshiEnvironment | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'demo' || normalized === 'production') return normalized
  return null
}

export function loadKalshiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): { config: KalshiRuntimeConfig | null; receipt: KalshiHealthReceipt } {
  const environment = normalizeEnvironment(env.KALSHI_ENV)
  const apiKeyId = env.KALSHI_API_KEY_ID?.trim() ?? ''
  const privateKeyPem = decodePrivateKeyFromEnv(env)
  const expectedBaseUrl = environment ? ENVIRONMENTS[environment] : null
  const suppliedBaseUrl = env.KALSHI_API_BASE_URL?.trim().replace(/\/$/, '') || expectedBaseUrl
  const checkedAt = new Date().toISOString()

  const evidence: string[] = []
  if (!environment) evidence.push('KALSHI_ENV must be demo or production')
  if (!apiKeyId) evidence.push('KALSHI_API_KEY_ID is missing')
  if (!privateKeyPem) evidence.push('KALSHI_PRIVATE_KEY_BASE64 or KALSHI_PRIVATE_KEY is missing')

  if (!environment || !apiKeyId || !privateKeyPem || !expectedBaseUrl) {
    return {
      config: null,
      receipt: {
        ok: false,
        status: 'CONFIG_MISSING',
        environment,
        baseUrl: suppliedBaseUrl ?? null,
        keyIdPresent: Boolean(apiKeyId),
        privateKeyPresent: Boolean(privateKeyPem),
        keyType: null,
        authenticated: false,
        providerHttpStatus: null,
        checkedAt,
        evidence,
      },
    }
  }

  if (suppliedBaseUrl !== expectedBaseUrl) {
    evidence.push(
      `KALSHI_API_BASE_URL does not match the canonical ${environment} Kalshi trading endpoint`,
    )
    return {
      config: null,
      receipt: {
        ok: false,
        status: 'CONFIG_INVALID',
        environment,
        baseUrl: suppliedBaseUrl ?? null,
        keyIdPresent: true,
        privateKeyPresent: true,
        keyType: null,
        authenticated: false,
        providerHttpStatus: null,
        checkedAt,
        evidence,
      },
    }
  }

  let privateKey: KeyObject
  try {
    privateKey = createPrivateKey(privateKeyPem)
  } catch {
    evidence.push('Kalshi private key could not be parsed as PEM')
    return {
      config: null,
      receipt: {
        ok: false,
        status: 'CONFIG_INVALID',
        environment,
        baseUrl: expectedBaseUrl,
        keyIdPresent: true,
        privateKeyPresent: true,
        keyType: null,
        authenticated: false,
        providerHttpStatus: null,
        checkedAt,
        evidence,
      },
    }
  }

  const keyType = classifyKey(privateKey)
  if (!keyType) {
    evidence.push(`Unsupported Kalshi private key type: ${privateKey.asymmetricKeyType ?? 'unknown'}`)
    return {
      config: null,
      receipt: {
        ok: false,
        status: 'CONFIG_INVALID',
        environment,
        baseUrl: expectedBaseUrl,
        keyIdPresent: true,
        privateKeyPresent: true,
        keyType: null,
        authenticated: false,
        providerHttpStatus: null,
        checkedAt,
        evidence,
      },
    }
  }

  evidence.push(`Kalshi ${environment} configuration loaded`)
  evidence.push(`${keyType} private key parsed successfully`)

  return {
    config: {
      environment,
      apiKeyId,
      privateKey,
      keyType,
      baseUrl: expectedBaseUrl,
    },
    receipt: {
      ok: false,
      status: 'UPSTREAM_ERROR',
      environment,
      baseUrl: expectedBaseUrl,
      keyIdPresent: true,
      privateKeyPresent: true,
      keyType,
      authenticated: false,
      providerHttpStatus: null,
      checkedAt,
      evidence,
    },
  }
}

export function signKalshiRequest(input: {
  privateKey: KeyObject
  keyType: KalshiKeyType
  timestampMs: string
  method: string
  path: string
}): string {
  const pathWithoutQuery = input.path.split('?')[0]!
  const message = Buffer.from(
    `${input.timestampMs}${input.method.toUpperCase()}${pathWithoutQuery}`,
    'utf8',
  )

  if (input.keyType === 'ed25519') {
    return cryptoSign(null, message, input.privateKey).toString('base64')
  }

  const signer = createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  return signer
    .sign({
      key: input.privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    })
    .toString('base64')
}

export async function checkKalshiAuthentication(input: {
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  nowMs?: number
} = {}): Promise<KalshiHealthReceipt> {
  const loaded = loadKalshiRuntimeConfig(input.env)
  if (!loaded.config) return loaded.receipt

  const { config } = loaded
  const fetchImpl = input.fetchImpl ?? fetch
  const nowMs = input.nowMs ?? Date.now()
  const timestampMs = String(nowMs)
  const fullPath = new URL(config.baseUrl + KALSHI_BALANCE_PATH).pathname
  const signature = signKalshiRequest({
    privateKey: config.privateKey,
    keyType: config.keyType,
    timestampMs,
    method: 'GET',
    path: fullPath,
  })

  try {
    const response = await fetchImpl(config.baseUrl + KALSHI_BALANCE_PATH, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'KALSHI-ACCESS-KEY': config.apiKeyId,
        'KALSHI-ACCESS-TIMESTAMP': timestampMs,
        'KALSHI-ACCESS-SIGNATURE': signature,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      return {
        ...loaded.receipt,
        ok: true,
        status: 'AUTHENTICATED',
        authenticated: true,
        providerHttpStatus: response.status,
        evidence: [
          ...loaded.receipt.evidence,
          'Signed read-only /portfolio/balance request authenticated',
          'Balance payload intentionally discarded',
        ],
      }
    }

    const authenticationRejected = response.status === 401 || response.status === 403
    return {
      ...loaded.receipt,
      ok: false,
      status: authenticationRejected ? 'AUTH_REJECTED' : 'UPSTREAM_ERROR',
      authenticated: false,
      providerHttpStatus: response.status,
      evidence: [
        ...loaded.receipt.evidence,
        authenticationRejected
          ? 'Kalshi rejected the signed credentials'
          : `Kalshi returned HTTP ${response.status}`,
      ],
    }
  } catch (error) {
    return {
      ...loaded.receipt,
      ok: false,
      status: 'UPSTREAM_ERROR',
      authenticated: false,
      providerHttpStatus: null,
      evidence: [
        ...loaded.receipt.evidence,
        error instanceof Error ? `Kalshi request failed: ${error.name}` : 'Kalshi request failed',
      ],
    }
  }
}

import {
  constants,
  generateKeyPairSync,
  verify as cryptoVerify,
} from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  checkKalshiAuthentication,
  loadKalshiRuntimeConfig,
  signKalshiRequest,
} from './kalshi-health'

function ed25519Env() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  return {
    publicKey,
    env: {
      KALSHI_ENV: 'demo',
      KALSHI_API_KEY_ID: 'test-key-id',
      KALSHI_PRIVATE_KEY_BASE64: Buffer.from(pem).toString('base64'),
      KALSHI_API_BASE_URL: 'https://external-api.demo.kalshi.co/trade-api/v2',
    } as NodeJS.ProcessEnv,
  }
}

describe('Kalshi read-only commissioning health', () => {
  it('loads a base64 Ed25519 key without exposing credential values', () => {
    const { env } = ed25519Env()
    const loaded = loadKalshiRuntimeConfig(env)

    expect(loaded.config?.keyType).toBe('ed25519')
    expect(loaded.receipt.keyIdPresent).toBe(true)
    expect(loaded.receipt.privateKeyPresent).toBe(true)
    expect(JSON.stringify(loaded.receipt)).not.toContain('test-key-id')
    expect(JSON.stringify(loaded.receipt)).not.toContain(env.KALSHI_PRIVATE_KEY_BASE64!)
  })

  it('signs the exact Kalshi path without query parameters', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const timestampMs = '1703123456789'
    const signature = signKalshiRequest({
      privateKey,
      keyType: 'rsa',
      timestampMs,
      method: 'GET',
      path: '/trade-api/v2/portfolio/orders?limit=5',
    })

    const message = Buffer.from(
      timestampMs + 'GET' + '/trade-api/v2/portfolio/orders',
      'utf8',
    )
    expect(
      cryptoVerify(
        'RSA-SHA256',
        message,
        {
          key: publicKey,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
        },
        Buffer.from(signature, 'base64'),
      ),
    ).toBe(true)
  })

  it('authenticates with a signed read-only balance probe and discards balance data', async () => {
    const { env, publicKey } = ed25519Env()
    const nowMs = 1703123456789
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        'https://external-api.demo.kalshi.co/trade-api/v2/portfolio/balance',
      )
      const headers = new Headers(init?.headers)
      expect(headers.get('KALSHI-ACCESS-KEY')).toBe('test-key-id')
      expect(headers.get('KALSHI-ACCESS-TIMESTAMP')).toBe(String(nowMs))

      const signature = headers.get('KALSHI-ACCESS-SIGNATURE')
      expect(signature).toBeTruthy()
      const message = Buffer.from(
        String(nowMs) + 'GET' + '/trade-api/v2/portfolio/balance',
        'utf8',
      )
      expect(
        cryptoVerify(null, message, publicKey, Buffer.from(signature!, 'base64')),
      ).toBe(true)

      return new Response(JSON.stringify({ balance: 12345 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    const receipt = await checkKalshiAuthentication({ env, fetchImpl, nowMs })

    expect(receipt.ok).toBe(true)
    expect(receipt.status).toBe('AUTHENTICATED')
    expect(receipt.authenticated).toBe(true)
    expect(receipt.providerHttpStatus).toBe(200)
    expect(JSON.stringify(receipt)).not.toContain('12345')
    expect(JSON.stringify(receipt)).not.toContain('"balance"')
  })

  it('fails closed when the configured environment endpoint is not canonical', () => {
    const { env } = ed25519Env()
    env.KALSHI_API_BASE_URL = 'https://example.invalid/trade-api/v2'

    const loaded = loadKalshiRuntimeConfig(env)

    expect(loaded.config).toBeNull()
    expect(loaded.receipt.status).toBe('CONFIG_INVALID')
    expect(loaded.receipt.authenticated).toBe(false)
  })

  it('classifies rejected credentials without returning an upstream body', async () => {
    const { env } = ed25519Env()
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'secret provider detail' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch

    const receipt = await checkKalshiAuthentication({
      env,
      fetchImpl,
      nowMs: 1703123456789,
    })

    expect(receipt.ok).toBe(false)
    expect(receipt.status).toBe('AUTH_REJECTED')
    expect(receipt.providerHttpStatus).toBe(401)
    expect(JSON.stringify(receipt)).not.toContain('secret provider detail')
  })
})

import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizedSchedulerRequest } from './internal-scheduler-auth'

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function makeOidcFixture(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey & {
    kid?: string
    alg?: string
    use?: string
  }
  jwk.kid = 'test-key'
  jwk.alg = 'RS256'
  jwk.use = 'sig'

  const header = base64UrlJson({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
  const claims = base64UrlJson({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'jhadina-production-scheduler',
    sub: 'repo:bookieandco/crispy-waddle:ref:refs/heads/main',
    repository: 'bookieandco/crispy-waddle',
    repository_owner: 'bookieandco',
    ref: 'refs/heads/main',
    event_name: 'schedule',
    workflow_ref:
      'bookieandco/crispy-waddle/.github/workflows/jhadina-production-scheduler.yml@refs/heads/main',
    nbf: 1_800_000_000,
    exp: 1_800_000_600,
    ...overrides,
  })
  const signingInput = `${header}.${claims}`
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')

  return {
    token: `${signingInput}.${signature}`,
    fetchImpl: vi.fn(async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('internal scheduler authorization', () => {
  it('continues to accept the existing CRON_SECRET path', async () => {
    vi.stubEnv('CRON_SECRET', 'a'.repeat(40))
    const request = new Request('https://example.test/internal', {
      headers: { authorization: `Bearer ${'a'.repeat(40)}` },
    })

    await expect(authorizedSchedulerRequest(request)).resolves.toBe(true)
  })

  it('accepts a signature-verified GitHub OIDC token from the exact main scheduler workflow', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const fixture = makeOidcFixture()
    const request = new Request('https://example.test/internal', {
      headers: { authorization: `Bearer ${fixture.token}` },
    })

    await expect(
      authorizedSchedulerRequest(request, {
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(true)
  })

  it('accepts exact-main push OIDC for post-deploy admission smoke', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const fixture = makeOidcFixture({ event_name: 'push' })
    const request = new Request('https://example.test/internal', {
      headers: { authorization: `Bearer ${fixture.token}` },
    })

    await expect(
      authorizedSchedulerRequest(request, {
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(true)
  })

  it('rejects a validly signed token from a different workflow or ref', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const fixture = makeOidcFixture({
      ref: 'refs/heads/feature',
      workflow_ref:
        'bookieandco/crispy-waddle/.github/workflows/other.yml@refs/heads/feature',
    })
    const request = new Request('https://example.test/internal', {
      headers: { authorization: `Bearer ${fixture.token}` },
    })

    await expect(
      authorizedSchedulerRequest(request, {
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(false)
  })

  it('rejects expired tokens and tokens with an unexpected audience', async () => {
    vi.stubEnv('CRON_SECRET', '')
    for (const overrides of [{ exp: 1_799_999_999 }, { aud: 'not-jhadina' }]) {
      const fixture = makeOidcFixture(overrides)
      const request = new Request('https://example.test/internal', {
        headers: { authorization: `Bearer ${fixture.token}` },
      })

      await expect(
        authorizedSchedulerRequest(request, {
          fetchImpl: fixture.fetchImpl,
          nowSeconds: 1_800_000_100,
        }),
      ).resolves.toBe(false)
    }
  })
})

import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authorizedGitHubRepositoryWorkflowRequest,
  authorizedGitHubWorkflowRequest,
  authorizedSchedulerRequest,
} from './internal-scheduler-auth'

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' }) as JsonWebKey & {
  kid?: string
  alg?: string
  use?: string
}
jwk.kid = 'test-key'
jwk.alg = 'RS256'
jwk.use = 'sig'

function makeOidcFixture(overrides: Record<string, unknown> = {}) {
  const header = base64UrlJson({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
  const claims = base64UrlJson({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'jhadina-production-scheduler',
    sub: 'repo:bookieandco@289295074/crispy-waddle@1320251374:ref:refs/heads/main',
    repository: 'bookieandco/crispy-waddle',
    repository_id: '1320251374',
    repository_owner: 'bookieandco',
    repository_owner_id: '289295074',
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

  it('accepts the exact SAM commissioning workflow only for its scoped audience', async () => {
    const fixture = makeOidcFixture({
      aud: 'jhadina-sam-upstream',
      workflow_ref:
        'bookieandco/crispy-waddle/.github/workflows/sam-live-commissioning.yml@refs/heads/main',
    })
    const request = new Request('https://example.test/internal/sam/upstream', {
      headers: { authorization: `Bearer ${fixture.token}` },
    })

    await expect(
      authorizedGitHubWorkflowRequest(request, {
        audience: 'jhadina-sam-upstream',
        workflowRef:
          'bookieandco/crispy-waddle/.github/workflows/sam-live-commissioning.yml@refs/heads/main',
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(true)

    await expect(
      authorizedGitHubWorkflowRequest(request, {
        audience: 'jhadina-sam-runtime',
        workflowRef:
          'bookieandco/crispy-waddle/.github/workflows/sam-live-commissioning.yml@refs/heads/main',
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(false)
  })

  it('accepts the exact private restoration benchmark workflow without requiring another repository subject customization', async () => {
    const fixture = makeOidcFixture({
      aud: 'jhadina-music-restoration-canary',
      sub: 'repo:bookieandco/music-restoration-intelligence:ref:refs/heads/main',
      repository: 'bookieandco/music-restoration-intelligence',
      repository_id: '1320611836',
      repository_owner: 'bookieandco',
      repository_owner_id: '289295074',
      ref: 'refs/heads/main',
      event_name: 'workflow_dispatch',
      workflow_ref:
        'bookieandco/music-restoration-intelligence/.github/workflows/no-good-production-canary.yml@refs/heads/main',
    })
    const request = new Request('https://example.test/api/music/restoration/canary/prepare', {
      headers: { authorization: `Bearer ${fixture.token}` },
    })

    await expect(
      authorizedGitHubRepositoryWorkflowRequest(request, {
        audience: 'jhadina-music-restoration-canary',
        workflowRef:
          'bookieandco/music-restoration-intelligence/.github/workflows/no-good-production-canary.yml@refs/heads/main',
        repository: 'bookieandco/music-restoration-intelligence',
        repositoryId: '1320611836',
        repositoryOwner: 'bookieandco',
        repositoryOwnerId: '289295074',
        ref: 'refs/heads/main',
        allowedEvents: ['push', 'workflow_dispatch'],
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(true)

    await expect(
      authorizedGitHubRepositoryWorkflowRequest(request, {
        audience: 'jhadina-music-restoration-canary',
        workflowRef:
          'bookieandco/music-restoration-intelligence/.github/workflows/no-good-production-canary.yml@refs/heads/main',
        repository: 'bookieandco/music-restoration-intelligence',
        repositoryId: '999',
        repositoryOwner: 'bookieandco',
        repositoryOwnerId: '289295074',
        ref: 'refs/heads/main',
        allowedEvents: ['push', 'workflow_dispatch'],
        fetchImpl: fixture.fetchImpl,
        nowSeconds: 1_800_000_100,
      }),
    ).resolves.toBe(false)
  })

  it('rejects a legacy name-only subject even when other claims look valid', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const fixture = makeOidcFixture({
      sub: 'repo:bookieandco/crispy-waddle:ref:refs/heads/main',
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

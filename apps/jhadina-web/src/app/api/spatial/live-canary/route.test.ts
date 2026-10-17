import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  authorized: true,
  canary: vi.fn(async () => ({
    kind: 'GEV_LIVE_CANARY_V1', status: 'DISABLED',
    reasonCode: 'GEV_CANARY_DISABLED', admittedReality: false, durabilityVerified: false,
  })),
}))

vi.mock('@/lib/auth/request-identity', () => ({
  createRequestIdentityVerifier: async () => ({
    verify: async ({ userId }: { userId: string }) => {
      if (!mock.authorized) throw new Error('BAD_SESSION_WITH_SECRETS')
      return { userId }
    },
  }),
}))

vi.mock('@/lib/context/gev-live-evidence-canary', () => ({
  runGevLiveEvidenceCanary: mock.canary,
}))

import { POST } from './route'

const invoke = async (body: string, user?: string) => await POST(new NextRequest(
  'https://jhadina.test/api/spatial/live-canary',
  { method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-jhadina-user-id': user } : {}) }, body },
))

describe('GEV manual canary identity and confirmation boundary', () => {
  it('requires actual verified owner identity', async () => {
    mock.canary.mockClear()
    expect((await invoke('{"confirm":"RUN_ONE_AUTHORIZED_USGS_CANARY"}')).status).toBe(401)
    mock.authorized = false
    try {
      expect((await invoke('{"confirm":"RUN_ONE_AUTHORIZED_USGS_CANARY"}', 'owner')).status).toBe(401)
    } finally { mock.authorized = true }
    expect(mock.canary).not.toHaveBeenCalled()
  })

  it('requires explicit single-source execution confirmation and body bounds', async () => {
    mock.canary.mockClear()
    expect((await invoke('{}', 'owner')).status).toBe(400)
    expect((await invoke(' '.repeat(300), 'owner')).status).toBe(400)
    expect(mock.canary).not.toHaveBeenCalled()
  })

  it('keeps disabled canary a 503 even when an authenticated user requests it', async () => {
    mock.canary.mockClear()
    const response = await invoke('{"confirm":"RUN_ONE_AUTHORIZED_USGS_CANARY"}', 'owner')
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect((await response.json()).data.status).toBe('DISABLED')
    expect(mock.canary).toHaveBeenCalledTimes(1)
  })
})

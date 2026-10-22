import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {NextRequest} from 'next/server'

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), identityFactory: vi.fn(), clientFactory: vi.fn(),
  from: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn(),
}))
vi.mock('@/lib/auth/request-identity', () => ({createRequestIdentityVerifier: mocks.identityFactory}))
vi.mock('@/lib/supabase/server', () => ({createClient: mocks.clientFactory}))

import {POST, PATCH} from './route'
import {POST as IMPORT} from './import/route'

describe('SOCIAL-FREE-LIVE.04A unconditional persistence denial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.identityFactory.mockResolvedValue({verify: mocks.verify})
    mocks.clientFactory.mockResolvedValue({from: mocks.from})
    mocks.from.mockReturnValue({insert: mocks.insert, update: mocks.update, upsert: mocks.upsert})
    // A healthy client must not cause commissioning or even a storage read.
    mocks.insert.mockResolvedValue({data: {}, error: null})
    mocks.update.mockResolvedValue({data: {}, error: null})
    mocks.upsert.mockResolvedValue({data: [], error: null})
  })
  afterEach(() => vi.unstubAllEnvs())

  for (const [label, handler, method, path] of [
    ['create', POST, 'POST', '/api/social/collaborations'],
    ['update/archive', PATCH, 'PATCH', '/api/social/collaborations'],
    ['import', IMPORT, 'POST', '/api/social/collaborations/import'],
  ] as const) {
    for (const identity of ['owner-a', 'owner-b', 'anonymous', 'forged'] as const) {
      it(`${label}: ${identity} cannot reach storage`, async () => {
        mocks.verify.mockImplementation(async () => {
          if (identity === 'anonymous' || identity === 'forged') throw Error('Authenticated session required')
          return {userId: identity, sessionId: 'fixture-session'}
        })
        vi.stubEnv('SOCIAL_FREE_PERSISTENCE_COMMISSIONED', 'true')
        const request = new NextRequest('http://localhost' + path, {
          method,
          headers: {'content-type': 'application/json', origin: 'http://localhost',
            ...(identity === 'anonymous' ? {} : {cookie: 'fixture=session', 'x-jhadina-user-id': identity}),
            'x-social-free-commissioned': 'true'},
          body: JSON.stringify({kind: 'creator', brandId: 'pupsonstuff', sourceKey: 'instagram:fixture',
            payload: {handle: 'fixture'}, evidenceRefs: ['fixture:manual'], observedAt: '2026-10-16T00:00:00Z',
            commissioned: true, externalActionAuthorized: true, archive: true, revision: 1,
            leads: [{platform: 'instagram', handle: 'fixture', contactPermission: 'verified_opt_in'}]}),
        })
        const response = await handler(request)
        expect(response.status).toBe(503)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(await response.json()).toEqual({ok: false, error: 'SOCIAL_FREE_NOT_COMMISSIONED',
          externalActionAuthorized: false, moneyMovementAuthorized: false})
        expect(mocks.identityFactory).not.toHaveBeenCalled()
        expect(mocks.verify).not.toHaveBeenCalled()
        expect(mocks.clientFactory).not.toHaveBeenCalled()
        for (const spy of [mocks.from, mocks.insert, mocks.update, mocks.upsert]) expect(spy).not.toHaveBeenCalled()
      })
    }
    it(`${label}: malformed bodies are denied before parsing`, async () => {
      const request = new NextRequest('http://localhost' + path, {method, body: '{broken'})
      const response = await handler(request)
      expect(response.status).toBe(503)
      expect((await response.json()).error).toBe('SOCIAL_FREE_NOT_COMMISSIONED')
      expect(request.bodyUsed).toBe(false)
      expect(mocks.clientFactory).not.toHaveBeenCalled()
    })
  }
})

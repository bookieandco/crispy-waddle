import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({ verified: true, reads: 0 }))
vi.mock('@/lib/auth/request-identity', () => ({
  createRequestIdentityVerifier: async () => ({
    verify: async ({ userId }: { userId: string }) => {
      if (!mock.verified) throw new Error('secret-session-error')
      return { userId }
    },
  }),
}))
vi.mock('@/lib/context/gev-cert-public-readiness', () => ({
  readGevPublicReadiness: async () => {
    mock.reads++
    return { kind: 'GEV_PUBLIC_READINESS_V1', status: 'PARTIAL',
      productionCertified: false, persisted: false, admittedReality: false,
      blockers: ['CELESTRAK_SOURCE_UNAVAILABLE'] }
  },
}))
import { GET } from './route'
const req = (user?: string) => new NextRequest('https://jhadina.test/api/spatial/public-readiness', {
  headers: user ? { 'x-jhadina-user-id': user } : {},
})

describe('GEV-CERT.02-.03 public source owner route', () => {
  it('rejects anonymous and bad-session requests without fetching public feeds', async () => {
    mock.reads = 0
    expect((await GET(req())).status).toBe(401)
    mock.verified = false
    try {
      expect((await GET(req('owner'))).status).toBe(401)
    } finally { mock.verified = true }
    expect(mock.reads).toBe(0)
  })
  it('returns bounded, no-store, non-certified source state to verified owner only', async () => {
    mock.reads = 0
    const response = await GET(req('owner'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const data = await response.json()
    expect(data.data.status).toBe('PARTIAL')
    expect(data.data.productionCertified).toBe(false)
    expect(mock.reads).toBe(1)
  })
})

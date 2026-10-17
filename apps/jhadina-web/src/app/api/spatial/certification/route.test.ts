import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const fixture = vi.hoisted(() => ({
  authorized: true,
  reads: 0,
}))

vi.mock('@/lib/auth/request-identity', () => ({
  createRequestIdentityVerifier: async () => ({
    verify: async ({ userId }: { userId: string }) => {
      if (!fixture.authorized) throw Error('SECRET_AUTH_ERROR')
      return { userId }
    },
  }),
}))

vi.mock('@/lib/context/gev-live-closeout', () => ({
  currentGevLiveCloseoutPreflight: () => {
    fixture.reads++
    return { kind: 'GEV_LIVE_CLOSEOUT_V1', status: 'BLOCKED', productionCertified: false, blockedOn: ['OWNER_REVIEW'] }
  },
}))

vi.mock('@/lib/context/gev-cert-acceptance', () => ({
  getGevCertBlockedPreflight: () => ({
    kind: 'GEV_CERT_01_08_V1', status: 'BLOCKED',
    productionCertified: false, blockedOn: ['GEV-CERT.01', 'GEV-CERT.08'],
  }),
}))

import { GET } from './route'

const req = (user?: string) => new NextRequest('https://jhadina.test/api/spatial/certification', {
  headers: user ? { 'x-jhadina-user-id': user } : {},
})

describe('GEV-LIVE.13 owner-only read-only preflight', () => {
  it('refuses anonymous requests before reading the report', async () => {
    fixture.reads = 0
    const result = await GET(req())
    expect(result.status).toBe(401)
    expect(fixture.reads).toBe(0)
  })
  it('refuses asserted identities with invalid sessions', async () => {
    fixture.reads = 0
    fixture.authorized = false
    try { expect((await GET(req('owner'))).status).toBe(401) }
    finally { fixture.authorized = true }
    expect(fixture.reads).toBe(0)
  })
  it('returns only no-store, fail-closed certification data for a verified owner', async () => {
    fixture.reads = 0
    const result = await GET(req('owner'))
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toContain('no-store')
    const json = await result.json()
    expect(json.data.status).toBe('BLOCKED')
    expect(json.data.productionCertified).toBe(false)
    expect(json.certStages.status).toBe('BLOCKED')
    expect(json.certStages.productionCertified).toBe(false)
    expect(fixture.reads).toBe(1)
  })
})

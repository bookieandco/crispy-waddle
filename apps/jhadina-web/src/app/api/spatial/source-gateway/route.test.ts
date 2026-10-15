import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  authorized: true,
  calls: 0,
}))

vi.mock('@/lib/auth/request-identity', () => ({
  createRequestIdentityVerifier: async () => ({
    verify: async ({ userId }: { userId: string }) => {
      if (!mock.authorized) throw new Error('NO_SESSION')
      return { userId }
    },
  }),
}))

vi.mock('@/lib/context/gev-live-source-gateway', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/context/gev-live-source-gateway')>()
  return {
    ...original,
    readGevLiveSourceGateway: async (input: unknown) => {
      mock.calls += 1
      return {
        kind: 'GEV_SOURCE_GATEWAY_V1', checkedAt: '2026-10-14T22:00:00Z',
        authority: 'INTELLIGENCE_ONLY', persisted: false, admittedReality: false,
        sources: [], input,
      }
    },
  }
})

import { POST } from './route'

const callRoute = async (body: string, user?: string) => await POST(new NextRequest(
  'https://jhadina.test/api/spatial/source-gateway',
  { method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-jhadina-user-id': user } : {}) }, body },
))

describe('POST /api/spatial/source-gateway', () => {
  it('denies requests without a verified owner identity', async () => {
    mock.calls = 0
    const response = await callRoute(JSON.stringify({ domains: ['earthquake'], purpose: 'model-input' }))
    expect(response.status).toBe(401)
    expect(mock.calls).toBe(0)
  })

  it('denies an asserted user when the session is not valid', async () => {
    mock.calls = 0
    mock.authorized = false
    try {
      const response = await callRoute(JSON.stringify({ domains: ['earthquake'], purpose: 'model-input' }), 'owner')
      expect(response.status).toBe(401)
      expect(mock.calls).toBe(0)
    } finally {
      mock.authorized = true
    }
  })

  it('accepts a bounded authenticated read and never exposes private state', async () => {
    mock.calls = 0
    const response = await callRoute(JSON.stringify({ domains: ['earthquake'], purpose: 'model-input' }), 'owner')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.authority).toBe('INTELLIGENCE_ONLY')
    expect(body.data.admittedReality).toBe(false)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(mock.calls).toBe(1)
  })

  it('rejects oversized or unsupported-source requests without dispatch', async () => {
    mock.calls = 0
    const oversized = await callRoute(' '.repeat(2100), 'owner')
    const unknown = await callRoute(JSON.stringify({ domains: ['somebody'], purpose: 'model-input' }), 'owner')
    expect(oversized.status).toBe(400)
    expect(unknown.status).toBe(400)
    expect(mock.calls).toBe(0)
  })
})

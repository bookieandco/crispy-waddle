import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({ valid: true }))

vi.mock('@/lib/auth/request-identity', () => ({
  createRequestIdentityVerifier: async () => ({
    verify: async ({ userId }: { userId: string }) => {
      if (!mock.valid) throw Error('Not signed in: SECRET_FROM_SESSION')
      return { userId }
    },
  }),
}))

vi.mock('@/lib/context/production-spatial-context-provider', () => ({
  createProductionSpatialContextProvider: () => ({
    getContext: async () => { throw Error('POSTGRES_USER=hidden-credential upstream SQL returned privileged data') },
  }),
}))

vi.mock('@/lib/context/supabase-spatial-workspace-store', () => ({
  createSupabaseSpatialWorkspaceStore: () => ({
    latest: async () => { throw Error('SUPABASE_SERVICE_ROLE_KEY=hidden-credential') },
    atOrBefore: async () => { throw Error('SUPABASE_SERVICE_ROLE_KEY=hidden-credential') },
  }),
}))

import { POST, GET } from './route'

const url = 'https://jhadina.test/api/spatial/context'
const headers = { 'x-jhadina-user-id': 'owner', 'content-type': 'application/json' }

describe('GEV-LIVE.11 Context API error-redaction acceptance', () => {
  it('does not echo privileged database or upstream messages on failed POST', async () => {
    const response = await POST(new NextRequest(url, {
      method: 'POST', headers,
      body: JSON.stringify({ activeTask: 'inspect earthquake spatial context' }),
    }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('SPATIAL_CONTEXT_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('hidden-credential')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('does not echo privileged database errors on replay GET', async () => {
    const response = await GET(new NextRequest(url, { headers }))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('SPATIAL_REPLAY_UNAVAILABLE')
    expect(JSON.stringify(body)).not.toContain('hidden-credential')
  })

  it('sanitizes malformed request bodies', async () => {
    const response = await POST(new NextRequest(url, {
      method: 'POST', headers, body: 'not-json-SECRET_PII',
    }))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('SECRET_PII')
  })

  it('does not expose invalid-session detail as a user-visible message', async () => {
    mock.valid = false
    try {
      const response = await GET(new NextRequest(url, { headers }))
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('AUTH_REQUIRED')
      expect(JSON.stringify(body)).not.toContain('SECRET_FROM_SESSION')
    } finally { mock.valid = true }
  })
})

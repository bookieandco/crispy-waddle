import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from './route'

const keys = [
  'JHADINA_GEV_BASE_URL',
  'GEV_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const original = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of keys) {
    original.set(key, process.env[key])
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of keys) {
    const value = original.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  original.clear()
})

describe('GET /api/spatial/health', () => {
  it('fails closed without provider or database configuration and exposes no secrets', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('DEGRADED')
    expect(body.provider).toEqual({ configured: false, reachable: false })
    expect(body.database.configured).toBe(false)
    expect(body.database.reachable).toBe(false)
    expect(Object.values(body.database.tables).every((value) => value === false)).toBe(true)

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(serialized).not.toContain('JHADINA_GEV_BASE_URL')
    expect(serialized).not.toContain('GEV_BASE_URL')
  })
})

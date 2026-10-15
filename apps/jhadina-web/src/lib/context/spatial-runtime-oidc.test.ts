import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  enabled: true,
  operations: [] as string[],
}))

vi.mock('../supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => null),
  createRuntimeServiceRoleClient: vi.fn(async () => {
    if (!auth.enabled) return null
    return {
      from: (table: string) => {
        auth.operations.push(table)
        const q: Record<string, unknown> = {}
        const chain = new Proxy(q, {
          get: (_target, prop) => {
            if (prop === 'maybeSingle') return async () => ({ data: null, error: null })
            if (prop === 'then') return undefined
            return () => chain
          },
        })
        return chain
      },
    }
  }),
}))

import { createSupabaseSpatialEvidenceStore } from './supabase-spatial-evidence-store'
import { createSupabaseSpatialRealityStore } from './supabase-spatial-reality-store'
import { createSupabaseSpatialKnowledgeSink } from './supabase-spatial-knowledge-sink'
import { createSupabaseSpatialWorkspaceStore } from './supabase-spatial-workspace-store'

const savedEnv = process.env.VERCEL_ENV
beforeEach(() => {
  process.env.VERCEL_ENV = 'production'
  auth.enabled = true
  auth.operations = []
})
afterEach(() => {
  if (savedEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = savedEnv
})

describe('Production Spatial stores use the isolated request-context OIDC path', () => {
  it('resolves production readbacks for evidence, candidate and workspace without a static key', async () => {
    const evidence = createSupabaseSpatialEvidenceStore()
    const reality = createSupabaseSpatialRealityStore()
    const workspace = createSupabaseSpatialWorkspaceStore()
    expect(evidence).toBeDefined()
    expect(reality).toBeDefined()
    expect(workspace).toBeDefined()
    await expect(evidence!.get('missing')).resolves.toBeUndefined()
    await expect(reality!.getCandidate('missing')).resolves.toBeUndefined()
    await expect(workspace!.latest('workspace', 'owner')).resolves.toBeUndefined()
    expect(auth.operations).toEqual([
      'jhadina_spatial_evidence',
      'jhadina_spatial_reality_candidates',
      'jhadina_spatial_workspace_revisions',
    ])
  })

  it('resolves knowledge sink safely for an empty graph', async () => {
    const knowledge = createSupabaseSpatialKnowledgeSink()
    expect(knowledge).toBeDefined()
    await expect(knowledge!.persist({ nodes: [], edges: [], evidenceRefs: [] })).resolves.toEqual({ nodes: 0, relations: 0 })
  })

  it('fails closed if identity is unavailable, including the knowledge sink', async () => {
    auth.enabled = false
    await expect(createSupabaseSpatialEvidenceStore()!.get('missing')).rejects.toThrow('SPATIAL_PRIVILEGED_DATABASE_UNAVAILABLE')
    await expect(createSupabaseSpatialRealityStore()!.getCandidate('missing')).rejects.toThrow('SPATIAL_PRIVILEGED_DATABASE_UNAVAILABLE')
    await expect(createSupabaseSpatialWorkspaceStore()!.latest('ws', 'owner')).rejects.toThrow('SPATIAL_PRIVILEGED_DATABASE_UNAVAILABLE')
    await expect(createSupabaseSpatialKnowledgeSink()!.persist({ nodes: [], edges: [], evidenceRefs: [] }))
      .rejects.toThrow('SPATIAL_PRIVILEGED_DATABASE_UNAVAILABLE')
    expect(auth.operations).toHaveLength(0)
  })
})

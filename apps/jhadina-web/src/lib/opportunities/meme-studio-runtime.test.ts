import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VentureDiscoveryCandidate, VentureOpportunity } from '@jhadina/opportunity-core'
import {
  MemeStudioDraftRuntime,
  SupabaseMemeStudioDraftStore,
  listEligibleTokenVentures,
  requireRevision,
  validateMemeStudioPayload,
  type MemeStudioDraftStore,
  type MemeStudioPayload,
  type MemeStudioSaved,
  type MemeStudioVentureReader,
} from './meme-studio-runtime'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const makePayload = (): MemeStudioPayload => ({
  draft: {
    name: 'Cactus Astronaut', ticker: 'CACTUS',
    description: 'An original, hypothetical fictional mascot with no existing token.',
    totalSupply: 1_000_000, poolSupplyPercent: 90, creatorSupplyPercent: 10,
    artworkRightsConfirmed: false, brandOriginalityConfirmed: false,
    allocationDisclosureConfirmed: false, liquidityTermsDisclosureConfirmed: false,
    truthfulPromotionConfirmed: false, noArtificialVolumeConfirmed: false,
    noGuaranteedReturnsConfirmed: false,
  },
  tier: 'brand_preview', laborHours: 2, laborRate: 20, otherCosts: 0,
  paperSol: 2, paperBuySol: 0.1, paperSellTokens: 1000,
})
const mockCandidate = { seedId: 'token-creation-services-market', family: 'software_apps' } as VentureDiscoveryCandidate
const unrelatedCandidate = { seedId: 'micro-saas-market', family: 'software_apps' } as VentureDiscoveryCandidate
const canonical = {
  id: 'venture:token-creation-services:accepted',
  family: 'software_apps',
  lifecycle: 'researched',
  title: 'Original Token Services',
  opportunityId: 'opportunity:token-services',
} as VentureOpportunity

function ventureReader(options: {
  venture?: VentureOpportunity | null
  candidate?: VentureDiscoveryCandidate | null
  owner?: string
  adopted?: boolean
} = {}): MemeStudioVentureReader {
  const venture = options.venture === undefined ? canonical : options.venture
  return {
    async getVenture(owner, id) {
      return owner === (options.owner || alice) && venture?.id === id ? venture : null
    },
    async listVentures(owner) { return owner === (options.owner || alice) && venture ? [venture] : [] },
    async listCandidateAdoptions(owner) {
      return owner === (options.owner || alice) && options.adopted !== false
        ? [{
            ownerUserId: owner, candidateId: 'candidate:token-services',
            opportunityId: 'opportunity:token-services',
            status: 'adopted' as const, adoptedAt: '2026-10-15T18:00:00Z', payload: {},
          }]
        : []
    },
    async getCandidate(id) {
      return id === 'candidate:token-services' ? (options.candidate === undefined ? mockCandidate : options.candidate) : null
    },
  }
}

function memoryStore(): MemeStudioDraftStore {
  const records = new Map<string, MemeStudioSaved>()
  let number = 0
  const id = '44444444-4444-4444-8444-444444444444'
  const key = (owner: string, draftId: string) => owner + ':' + draftId
  return {
    async list(owner) { return [...records.entries()].filter(([k]) => k.startsWith(owner + ':')).map(([, v]) => structuredClone(v)) },
    async get(owner, draftId) { return structuredClone(records.get(key(owner, draftId)) || null) },
    async create(owner, payload, ventureId) {
      number++
      const saved = {
        id, revision: 1, ventureId, payload: structuredClone(payload),
        createdAt: '2026-10-15T18:00:00.000Z', updatedAt: '2026-10-15T18:00:00.000Z',
        authority: 'PAPER_ONLY' as const, externalActionAuthorized: false as const, moneyMovementAuthorized: false as const,
      }
      if (number > 1) throw Error('fixture supports one draft')
      records.set(key(owner, id), saved)
      return structuredClone(saved)
    },
    async update(owner, draftId, revision, payload, ventureId) {
      const old = records.get(key(owner, draftId))
      if (!old || old.revision !== revision) return null
      const saved = { ...old, revision: revision + 1, ventureId, payload: structuredClone(payload), updatedAt: '2026-10-15T18:05:00.000Z' }
      records.set(key(owner, draftId), saved)
      return structuredClone(saved)
    },
    async archive(owner, draftId, revision) {
      const old = records.get(key(owner, draftId))
      if (!old || old.revision !== revision) return false
      return records.delete(key(owner, draftId))
    },
  }
}

describe('MEME-VENTURE.RUNTIME.01–.03', () => {
  it('persists incomplete self-attestation drafts without granting preview or action rights', async () => {
    const draft = validateMemeStudioPayload(makePayload())
    expect(draft.draft.brandOriginalityConfirmed).toBe(false)
    const runtime = new MemeStudioDraftRuntime(memoryStore(), ventureReader())
    const saved = await runtime.create(alice, { payload: draft })
    expect(saved.authority).toBe('PAPER_ONLY')
    expect(saved.ventureId).toBeNull()
    expect(saved.externalActionAuthorized).toBe(false)
    expect(saved.moneyMovementAuthorized).toBe(false)
    expect((await runtime.list(alice))).toHaveLength(1)
    expect((await runtime.list(bob))).toHaveLength(0)
    expect(await runtime.get(bob, saved.id)).toBeNull()
  })

  it('rejects unrecognized keys, illicit authority flags and malformed paper settings', () => {
    expect(() => validateMemeStudioPayload({ ...makePayload(), privateKey: 'never save me' })).toThrow('FIELDS_INVALID')
    expect(() => validateMemeStudioPayload({ ...makePayload(), moneyMovementAuthorized: true })).toThrow('FIELDS_INVALID')
    expect(() => validateMemeStudioPayload({ ...makePayload(), paperSol: 0 })).toThrow('INVALID_paperSol')
    expect(() => validateMemeStudioPayload({ ...makePayload(), laborHours: Infinity })).toThrow('INVALID_laborHours')
    expect(() => validateMemeStudioPayload({ ...makePayload(), draft: { ...makePayload().draft, signerEnabled: true } })).toThrow('FIELDS_INVALID')
    expect(() => validateMemeStudioPayload({ ...makePayload(), draft: { ...makePayload().draft, creatorSupplyPercent: 110 } })).toThrow()
    expect(() => validateMemeStudioPayload({ ...makePayload(), draft: { ...makePayload().draft, brandOriginalityConfirmed: 'yes' } })).toThrow('INVALID_ATTESTATIONS')
    expect(() => requireRevision(0)).toThrow()
    expect(() => requireRevision(1.1)).toThrow()
    expect(() => requireRevision(NaN)).toThrow()
  })

  it('does not accept an unadopted, unrelated or foreign owner Venture link', async () => {
    const payload = makePayload()
    for (const reader of [
      ventureReader({ adopted: false }),
      ventureReader({ candidate: unrelatedCandidate }),
      ventureReader({ owner: bob }),
      ventureReader({ venture: { ...canonical, lifecycle: 'archived' } }),
    ]) {
      const runtime = new MemeStudioDraftRuntime(memoryStore(), reader)
      await expect(runtime.create(alice, { payload, ventureId: canonical.id })).rejects.toThrow()
    }
    const legit = new MemeStudioDraftRuntime(memoryStore(), ventureReader())
    const saved = await legit.create(alice, { payload, ventureId: canonical.id })
    expect(saved.ventureId).toBe(canonical.id)
    expect(await listEligibleTokenVentures(alice, ventureReader())).toEqual([
      { id: canonical.id, title: canonical.title, opportunityId: canonical.opportunityId },
    ])
    expect(await listEligibleTokenVentures(bob, ventureReader())).toEqual([])
  })

  it('rejects stale concurrent writes, foreign updates and stale archive attempts', async () => {
    const runtime = new MemeStudioDraftRuntime(memoryStore(), ventureReader())
    const saved = await runtime.create(alice, { payload: makePayload() })
    const edited = makePayload()
    edited.draft.name = 'Original Paper Token'
    const next = await runtime.update(alice, saved.id, { payload: edited, revision: saved.revision })
    expect(next.revision).toBe(2)
    expect(next.payload.draft.name).toBe('Original Paper Token')
    await expect(runtime.update(alice, saved.id, { payload: makePayload(), revision: 1 })).rejects.toThrow('REVISION_CONFLICT')
    await expect(runtime.update(bob, saved.id, { payload: makePayload(), revision: 2 })).rejects.toThrow('REVISION_CONFLICT')
    await expect(runtime.archive(alice, saved.id, 1)).rejects.toThrow('REVISION_CONFLICT')
    expect(await runtime.archive(alice, saved.id, 2)).toEqual({ archived: true, externalActionAuthorized: false })
    expect(await runtime.get(alice, saved.id)).toBeNull()
  })

  it('uses owner + candidate + optimistic revision predicates on every Supabase query', async () => {
    const queries: Array<{ operation: string; filters: Record<string, unknown> }> = []
    function makeBuilder(operation: string) {
      const filters: Record<string, unknown> = {}
      const builder: Record<string, (...args: unknown[]) => unknown> = {}
      for (const name of ['select', 'eq', 'is', 'order', 'limit', 'update', 'insert']) {
        builder[name] = (...args: unknown[]) => {
          if (name === 'eq') filters[String(args[0])] = args[1]
          if (name === 'is') filters[String(args[0])] = args[1]
          return builder
        }
      }
      builder.returns = async () => {
        queries.push({ operation, filters: { ...filters } })
        return { data: [], error: null }
      }
      builder.maybeSingle = async () => {
        queries.push({ operation, filters: { ...filters } })
        return { data: null, error: null }
      }
      return builder
    }
    const client = {
      from(table: string) { expect(table).toBe('jhadina_meme_studio_drafts'); return makeBuilder('from') },
    } as unknown as SupabaseClient
    const store = new SupabaseMemeStudioDraftStore(client)
    await store.list(alice)
    await store.get(alice, '44444444-4444-4444-8444-444444444444')
    expect(await store.update(alice, '44444444-4444-4444-8444-444444444444', 2, makePayload(), null)).toBeNull()
    expect(await store.archive(alice, '44444444-4444-4444-8444-444444444444', 2)).toBe(false)
    expect(queries).toHaveLength(4)
    for (const query of queries) {
      expect(query.filters.owner_user_id).toBe(alice)
      expect(query.filters.candidate_id).toBe('venture:token-launch-services-2026-10-15')
      expect(query.filters.archived_at).toBeNull()
    }
    expect(queries[2].filters.revision).toBe(2)
    expect(queries[3].filters.revision).toBe(2)
  })
})

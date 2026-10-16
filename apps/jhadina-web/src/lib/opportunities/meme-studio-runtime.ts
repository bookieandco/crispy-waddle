import type { SupabaseClient } from '@supabase/supabase-js'
import {
  MEME_VENTURE_CANDIDATE_ID,
  reviewMemeDraft,
  quoteMemeService,
  simulateMemePool,
  type MemeDraft,
  type MemeServiceTier,
} from '@jhadina/opportunity-core/meme-venture'
import type { VentureRuntimeRepository } from './venture-runtime-repository'

export const MEME_STUDIO_SEED_ID = 'token-creation-services-market'
const MAX_DRAFTS = 50
const LIMIT = 50
const FIELDS = ['draft', 'tier', 'laborHours', 'laborRate', 'otherCosts', 'paperSol', 'paperBuySol', 'paperSellTokens'] as const
const DRAFT_KEYS: readonly (keyof MemeDraft)[] = [
  'name', 'ticker', 'description', 'totalSupply', 'poolSupplyPercent', 'creatorSupplyPercent',
  'artworkRightsConfirmed', 'brandOriginalityConfirmed', 'allocationDisclosureConfirmed',
  'liquidityTermsDisclosureConfirmed', 'truthfulPromotionConfirmed',
  'noArtificialVolumeConfirmed', 'noGuaranteedReturnsConfirmed',
]

export type MemeStudioPayload = {
  draft: MemeDraft
  tier: MemeServiceTier
  laborHours: number
  laborRate: number
  otherCosts: number
  paperSol: number
  paperBuySol: number
  paperSellTokens: number
}

export type MemeStudioSaved = {
  id: string
  revision: number
  ventureId: string | null
  payload: MemeStudioPayload
  createdAt: string
  updatedAt: string
  authority: 'PAPER_ONLY'
  externalActionAuthorized: false
  moneyMovementAuthorized: false
}

export type MemeStudioLink = { id: string; title: string; opportunityId: string }
export type MemeStudioVentureReader = Pick<VentureRuntimeRepository,
  'getVenture' | 'listVentures' | 'listCandidateAdoptions' | 'getCandidate'>

type Row = {
  draft_id: string
  revision: number
  venture_id: string | null
  payload: MemeStudioPayload
  created_at: string
  updated_at: string
}

const isRecord = (item: unknown): item is Record<string, unknown> =>
  !!item && typeof item === 'object' && !Array.isArray(item)

function exactFields(record: Record<string, unknown>, keys: readonly string[], type: string): void {
  if (Object.keys(record).some(k => !keys.includes(k)) ||
      keys.some(k => !Object.prototype.hasOwnProperty.call(record, k))) {
    throw new Error('MEME_STUDIO_' + type + '_FIELDS_INVALID')
  }
}

function bounded(value: unknown, field: string, max: number, allowZero = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      value < (allowZero ? 0 : Number.MIN_VALUE) || value > max) {
    throw new Error('MEME_STUDIO_INVALID_' + field)
  }
  return value
}

export function validateMemeStudioPayload(value: unknown): MemeStudioPayload {
  if (!isRecord(value)) throw new Error('MEME_STUDIO_INVALID_PAYLOAD')
  exactFields(value, FIELDS, 'PAYLOAD')
  if (!isRecord(value.draft)) throw new Error('MEME_STUDIO_INVALID_DRAFT')
  exactFields(value.draft, DRAFT_KEYS, 'DRAFT')
  const raw = value.draft
  const flags = DRAFT_KEYS.slice(6)
  if (flags.some(f => typeof raw[f] !== 'boolean')) throw new Error('MEME_STUDIO_INVALID_ATTESTATIONS')
  const draft = { ...raw } as MemeDraft
  // A draft with unchecked rights declarations may be saved but cannot be preview-ready.
  reviewMemeDraft(draft)
  if (value.tier !== 'brand_preview' && value.tier !== 'creation_prep') throw new Error('MEME_STUDIO_INVALID_TIER')
  const tier = value.tier
  const laborHours = bounded(value.laborHours, 'laborHours', 1000)
  const laborRate = bounded(value.laborRate, 'laborRate', 100_000)
  const otherCosts = bounded(value.otherCosts, 'otherCosts', 100_000_000)
  quoteMemeService({ tier, estimatedLaborHours: laborHours, estimatedLaborCostPerHourUsd: laborRate, estimatedOtherCostUsd: otherCosts })
  const paperSol = bounded(value.paperSol, 'paperSol', 1_000_000, false)
  const paperBuySol = bounded(value.paperBuySol, 'paperBuySol', 1_000_000, false)
  const paperSellTokens = bounded(value.paperSellTokens, 'paperSellTokens', 1_000_000_000_000, false)
  // Validate the simulator only for preview-capable allocations; incomplete drafts are still permitted.
  if (draft.poolSupplyPercent > 0 && draft.totalSupply * draft.poolSupplyPercent / 100 > 0) {
    simulateMemePool({
      initialReserveSol: paperSol,
      initialReserveTokens: draft.totalSupply * draft.poolSupplyPercent / 100,
      feeBps: 30,
      paperTrades: [{ side: 'buy', amount: paperBuySol }, { side: 'sell', amount: paperSellTokens }],
    })
  }
  return { draft, tier, laborHours, laborRate, otherCosts, paperSol, paperBuySol, paperSellTokens }
}

const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
function requireUuid(value: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new Error('MEME_STUDIO_INVALID_DRAFT_ID')
  return value
}

function requireUserId(owner: string): string {
  return requireUuid(owner)
}

function output(row: Row): MemeStudioSaved {
  return {
    id: row.draft_id,
    revision: row.revision,
    ventureId: row.venture_id,
    payload: validateMemeStudioPayload(row.payload),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authority: 'PAPER_ONLY',
    externalActionAuthorized: false,
    moneyMovementAuthorized: false,
  }
}

export function requireRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || typeof value !== 'number' || value < 1 || value > 1_000_000) {
    throw new Error('MEME_STUDIO_REVISION_REQUIRED')
  }
  return value
}

/**
 * View-only projection of already-admitted token service ventures.
 * A saved draft does not become a Venture or trigger adoption.
 */
export async function listEligibleTokenVentures(
  owner: string,
  reader: MemeStudioVentureReader,
): Promise<MemeStudioLink[]> {
  const adoptions = await reader.listCandidateAdoptions(owner)
  const approvedOpportunityIds = new Set<string>()
  for (const adoption of adoptions.filter(x => x.status === 'adopted').slice(0, 100)) {
    const candidate = await reader.getCandidate(adoption.candidateId)
    if (candidate?.seedId === MEME_STUDIO_SEED_ID && candidate.family === 'software_apps') {
      approvedOpportunityIds.add(adoption.opportunityId)
    }
  }
  const ventures = await reader.listVentures(owner)
  return ventures.filter(v => approvedOpportunityIds.has(v.opportunityId) &&
    v.family === 'software_apps' && !['killed', 'archived'].includes(v.lifecycle))
    .map(v => ({ id: v.id, title: v.title, opportunityId: v.opportunityId }))
}

/**
 * Canonical link lookup: only a persisted owner-owned Venture record and its
 * matching token-services candidate adoption qualify. No adoption is created here.
 */
export async function validateMemeStudioVentureLink(
  owner: string, ventureId: unknown, reader: MemeStudioVentureReader,
): Promise<string | null> {
  if (ventureId === null || ventureId === undefined || ventureId === '') return null
  if (typeof ventureId !== 'string' || ventureId.length > 200 || !/^[a-zA-Z0-9:_-]+$/.test(ventureId)) {
    throw new Error('MEME_STUDIO_INVALID_VENTURE_LINK')
  }
  const venture = await reader.getVenture(owner, ventureId)
  if (!venture || venture.family !== 'software_apps' || venture.lifecycle === 'killed' || venture.lifecycle === 'archived') {
    throw new Error('MEME_STUDIO_VENTURE_NOT_ELIGIBLE')
  }
  const adoptions = await reader.listCandidateAdoptions(owner)
  const matched = adoptions.filter(a => a.status === 'adopted' && a.opportunityId === venture.opportunityId)
  let eligible = false
  for (const adoption of matched) {
    const candidate = await reader.getCandidate(adoption.candidateId)
    if (candidate?.seedId === MEME_STUDIO_SEED_ID && candidate.family === 'software_apps') eligible = true
  }
  if (!eligible) throw new Error('MEME_STUDIO_CANONICAL_ADOPTION_REQUIRED')
  return ventureId
}

export interface MemeStudioDraftStore {
  list(owner: string): Promise<MemeStudioSaved[]>
  get(owner: string, id: string): Promise<MemeStudioSaved | null>
  create(owner: string, payload: MemeStudioPayload, ventureId: string | null): Promise<MemeStudioSaved>
  update(owner: string, id: string, revision: number, payload: MemeStudioPayload, ventureId: string | null): Promise<MemeStudioSaved | null>
  archive(owner: string, id: string, revision: number): Promise<boolean>
}

export class SupabaseMemeStudioDraftStore implements MemeStudioDraftStore {
  constructor(private readonly client: SupabaseClient) {}

  async list(owner: string): Promise<MemeStudioSaved[]> {
    const { data, error } = await this.client.from('jhadina_meme_studio_drafts')
      .select('draft_id,revision,venture_id,payload,created_at,updated_at')
      .eq('owner_user_id', requireUserId(owner))
      .eq('candidate_id', MEME_VENTURE_CANDIDATE_ID)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(LIMIT)
      .returns<Row[]>()
    if (error) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
    return (data ?? []).map(output)
  }

  async get(owner: string, id: string): Promise<MemeStudioSaved | null> {
    const { data, error } = await this.client.from('jhadina_meme_studio_drafts')
      .select('draft_id,revision,venture_id,payload,created_at,updated_at')
      .eq('owner_user_id', requireUserId(owner)).eq('draft_id', requireUuid(id))
      .eq('candidate_id', MEME_VENTURE_CANDIDATE_ID).is('archived_at', null)
      .maybeSingle<Row>()
    if (error) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
    return data ? output(data) : null
  }

  async create(owner: string, payload: MemeStudioPayload, ventureId: string | null): Promise<MemeStudioSaved> {
    const drafts = await this.list(owner)
    if (drafts.length >= MAX_DRAFTS) throw new Error('MEME_STUDIO_DRAFT_LIMIT_REACHED')
    const { data, error } = await this.client.from('jhadina_meme_studio_drafts')
      .insert({
        owner_user_id: requireUserId(owner), draft_id: crypto.randomUUID(),
        candidate_id: MEME_VENTURE_CANDIDATE_ID,
        venture_id: ventureId, payload, revision: 1,
        authority: 'PAPER_ONLY', external_action_authorized: false, money_movement_authorized: false,
      })
      .select('draft_id,revision,venture_id,payload,created_at,updated_at').single<Row>()
    if (error || !data) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
    return output(data)
  }

  async update(owner: string, id: string, revision: number, payload: MemeStudioPayload, ventureId: string | null): Promise<MemeStudioSaved | null> {
    const { data, error } = await this.client.from('jhadina_meme_studio_drafts')
      .update({ payload, venture_id: ventureId, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq('owner_user_id', requireUserId(owner)).eq('draft_id', requireUuid(id))
      .eq('revision', requireRevision(revision)).eq('candidate_id', MEME_VENTURE_CANDIDATE_ID)
      .is('archived_at', null)
      .select('draft_id,revision,venture_id,payload,created_at,updated_at')
      .maybeSingle<Row>()
    if (error) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
    return data ? output(data) : null
  }

  async archive(owner: string, id: string, revision: number): Promise<boolean> {
    const { data, error } = await this.client.from('jhadina_meme_studio_drafts')
      .update({ archived_at: new Date().toISOString(), revision: revision + 1, updated_at: new Date().toISOString() })
      .eq('owner_user_id', requireUserId(owner)).eq('draft_id', requireUuid(id))
      .eq('revision', requireRevision(revision)).eq('candidate_id', MEME_VENTURE_CANDIDATE_ID)
      .is('archived_at', null)
      .select('draft_id').maybeSingle<{ draft_id: string }>()
    if (error) throw new Error('MEME_STUDIO_STORAGE_UNAVAILABLE')
    return !!data
  }
}

/**
 * Purely draft/document operations. Caller must verify the session and inject
 * the owner ID; service-role storage is never exposed to client controls.
 */
export class MemeStudioDraftRuntime {
  constructor(
    private readonly store: MemeStudioDraftStore,
    private readonly ventures: MemeStudioVentureReader,
  ) {}

  list(owner: string) { return this.store.list(owner) }
  get(owner: string, id: string) { return this.store.get(owner, requireUuid(id)) }

  async create(owner: string, input: { payload: unknown; ventureId?: unknown }) {
    const payload = validateMemeStudioPayload(input.payload)
    const ventureId = await validateMemeStudioVentureLink(owner, input.ventureId, this.ventures)
    return this.store.create(owner, payload, ventureId)
  }

  async update(owner: string, id: string, input: { payload: unknown; revision: unknown; ventureId?: unknown }) {
    const payload = validateMemeStudioPayload(input.payload)
    const revision = requireRevision(input.revision)
    const ventureId = await validateMemeStudioVentureLink(owner, input.ventureId, this.ventures)
    const saved = await this.store.update(owner, requireUuid(id), revision, payload, ventureId)
    if (!saved) throw new Error('MEME_STUDIO_REVISION_CONFLICT_OR_NOT_FOUND')
    return saved
  }

  async archive(owner: string, id: string, revision: unknown) {
    const ok = await this.store.archive(owner, requireUuid(id), requireRevision(revision))
    if (!ok) throw new Error('MEME_STUDIO_REVISION_CONFLICT_OR_NOT_FOUND')
    return { archived: true as const, externalActionAuthorized: false as const }
  }
}

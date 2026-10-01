import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  SideHustleFamily,
  VentureMarketSignal,
  VentureMemoryRecord,
  VentureOpportunity,
  VentureSupervisorIssue,
  VentureWorkItem,
} from '@jhadina/opportunity-core'

export type VentureScoutInboxRecord = {
  seedId: string
  family: SideHustleFamily
  signal: VentureMarketSignal
  sourceUrl?: string
  sourceTitle: string
}

export type VentureRuntimeReceiptKind =
  | 'market_scout'
  | 'supervisor'
  | 'spatial_projection'
  | 'experiment_bridge'
  | 'outcome_bridge'

export type VentureRuntimeReceipt = {
  id: string
  ownerUserId: string
  ventureId?: string
  kind: VentureRuntimeReceiptKind
  evidenceRefs: string[]
  payload: Record<string, unknown>
  recordedAt: string
}

type VentureRow = {
  owner_user_id: string
  payload: VentureOpportunity
}

type VentureWorkRow = {
  payload: VentureWorkItem
}

type VentureIssueRow = {
  payload: VentureSupervisorIssue
}

type VentureMemoryRow = {
  payload: VentureMemoryRecord
}

type VentureReceiptRow = {
  owner_user_id: string
  id: string
  venture_id: string | null
  kind: VentureRuntimeReceiptKind
  evidence_refs: string[]
  payload: Record<string, unknown>
  recorded_at: string
}

type SignalInboxRow = {
  seed_id: string
  family: SideHustleFamily
  source_url: string | null
  source_title: string
  payload: VentureMarketSignal
}

function requireOwner(value: string): string {
  const owner = value.trim()
  if (!owner) throw new Error('VENTURE_OWNER_REQUIRED')
  return owner
}

export class VentureRuntimeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async upsertScoutSignals(records: VentureScoutInboxRecord[]): Promise<number> {
    if (!records.length) return 0
    const now = new Date().toISOString()
    const rows = records.map((record) => ({
      id: record.signal.id,
      seed_id: record.seedId,
      family: record.family,
      signal_kind: record.signal.kind,
      source_ref: record.signal.sourceRef,
      source_url: record.sourceUrl ?? null,
      source_title: record.sourceTitle,
      observed_at: record.signal.observedAt,
      confidence: record.signal.confidence,
      payload: record.signal,
      last_seen_at: now,
      active: true,
      updated_at: now,
    }))
    const { error } = await this.client
      .from('jhadina_venture_signal_inbox')
      .upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`VENTURE_SIGNAL_PERSIST_FAILED:${error.message}`)
    return rows.length
  }

  async getScoutSignals(ids: string[]): Promise<VentureScoutInboxRecord[]> {
    const normalized = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
    if (!normalized.length) return []
    if (normalized.length > 100) throw new Error('VENTURE_SIGNAL_SELECTION_TOO_LARGE')
    const { data, error } = await this.client
      .from('jhadina_venture_signal_inbox')
      .select('seed_id,family,source_url,source_title,payload')
      .eq('active', true)
      .in('id', normalized)
      .returns<SignalInboxRow[]>()
    if (error) throw new Error(`VENTURE_SIGNAL_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => ({
      seedId: row.seed_id,
      family: row.family,
      signal: row.payload,
      sourceUrl: row.source_url ?? undefined,
      sourceTitle: row.source_title,
    }))
  }

  async listScoutSignals(input: {
    seedId?: string
    family?: SideHustleFamily
    limit?: number
  } = {}): Promise<VentureScoutInboxRecord[]> {
    let query = this.client
      .from('jhadina_venture_signal_inbox')
      .select('seed_id,family,source_url,source_title,payload')
      .eq('active', true)
      .order('observed_at', { ascending: false })
      .limit(Math.max(1, Math.min(input.limit ?? 100, 500)))
    if (input.seedId) query = query.eq('seed_id', input.seedId)
    if (input.family) query = query.eq('family', input.family)
    const { data, error } = await query.returns<SignalInboxRow[]>()
    if (error) throw new Error(`VENTURE_SIGNAL_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => ({
      seedId: row.seed_id,
      family: row.family,
      signal: row.payload,
      sourceUrl: row.source_url ?? undefined,
      sourceTitle: row.source_title,
    }))
  }

  async saveVenture(ownerUserId: string, venture: VentureOpportunity): Promise<VentureOpportunity> {
    const owner = requireOwner(ownerUserId)
    const row = {
      owner_user_id: owner,
      id: venture.id,
      opportunity_id: venture.opportunityId,
      family: venture.family,
      lifecycle: venture.lifecycle,
      score: venture.score.total,
      payload: venture,
      created_at: venture.createdAt,
      updated_at: venture.updatedAt,
    }
    const { error } = await this.client
      .from('jhadina_venture_records')
      .upsert(row, { onConflict: 'owner_user_id,id' })
    if (error) throw new Error(`VENTURE_SAVE_FAILED:${error.message}`)
    return venture
  }

  async getVenture(ownerUserId: string, ventureId: string): Promise<VentureOpportunity | null> {
    const owner = requireOwner(ownerUserId)
    const { data, error } = await this.client
      .from('jhadina_venture_records')
      .select('owner_user_id,payload')
      .eq('owner_user_id', owner)
      .eq('id', ventureId)
      .maybeSingle<VentureRow>()
    if (error) throw new Error(`VENTURE_READ_FAILED:${error.message}`)
    return data?.payload ?? null
  }

  async listVentures(ownerUserId: string): Promise<VentureOpportunity[]> {
    const owner = requireOwner(ownerUserId)
    const { data, error } = await this.client
      .from('jhadina_venture_records')
      .select('owner_user_id,payload')
      .eq('owner_user_id', owner)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: false })
      .returns<VentureRow[]>()
    if (error) throw new Error(`VENTURE_LIST_FAILED:${error.message}`)
    return (data ?? []).map((row) => row.payload)
  }

  async listVenturesForSupervisor(limit = 100): Promise<Array<{ ownerUserId: string; venture: VentureOpportunity }>> {
    const { data, error } = await this.client
      .from('jhadina_venture_records')
      .select('owner_user_id,payload')
      .not('lifecycle', 'in', '("killed","archived")')
      .order('updated_at', { ascending: true })
      .limit(Math.max(1, Math.min(limit, 500)))
      .returns<VentureRow[]>()
    if (error) throw new Error(`VENTURE_SUPERVISOR_LIST_FAILED:${error.message}`)
    return (data ?? []).map((row) => ({ ownerUserId: row.owner_user_id, venture: row.payload }))
  }

  async upsertWorkItems(ownerUserId: string, items: VentureWorkItem[]): Promise<number> {
    const owner = requireOwner(ownerUserId)
    if (!items.length) return 0
    const rows = items.map((item) => ({
      owner_user_id: owner,
      id: item.id,
      venture_id: item.ventureId,
      agent_id: item.agentId,
      step: item.step,
      status: item.status,
      spend_usd: item.spendUsd,
      payload: item,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }))
    const { error } = await this.client
      .from('jhadina_venture_work_items')
      .upsert(rows, { onConflict: 'owner_user_id,id' })
    if (error) throw new Error(`VENTURE_WORK_SAVE_FAILED:${error.message}`)
    return rows.length
  }

  async listWorkItems(ownerUserId: string, ventureId?: string): Promise<VentureWorkItem[]> {
    const owner = requireOwner(ownerUserId)
    let query = this.client
      .from('jhadina_venture_work_items')
      .select('payload')
      .eq('owner_user_id', owner)
      .order('updated_at', { ascending: false })
    if (ventureId) query = query.eq('venture_id', ventureId)
    const { data, error } = await query.returns<VentureWorkRow[]>()
    if (error) throw new Error(`VENTURE_WORK_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => row.payload)
  }

  async upsertSupervisorIssues(ownerUserId: string, issues: VentureSupervisorIssue[]): Promise<number> {
    const owner = requireOwner(ownerUserId)
    if (!issues.length) return 0
    const rows = issues.map((issue) => ({
      owner_user_id: owner,
      id: issue.id,
      venture_id: issue.ventureId,
      kind: issue.kind,
      severity: issue.severity,
      recommended_action: issue.recommendedAction,
      payload: issue,
      detected_at: issue.detectedAt,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await this.client
      .from('jhadina_venture_supervisor_issues')
      .upsert(rows, { onConflict: 'owner_user_id,id' })
    if (error) throw new Error(`VENTURE_ISSUE_SAVE_FAILED:${error.message}`)
    return rows.length
  }

  async listSupervisorIssues(ownerUserId: string, ventureId?: string): Promise<VentureSupervisorIssue[]> {
    const owner = requireOwner(ownerUserId)
    let query = this.client
      .from('jhadina_venture_supervisor_issues')
      .select('payload')
      .eq('owner_user_id', owner)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
    if (ventureId) query = query.eq('venture_id', ventureId)
    const { data, error } = await query.returns<VentureIssueRow[]>()
    if (error) throw new Error(`VENTURE_ISSUE_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => row.payload)
  }

  async upsertMemory(ownerUserId: string, records: VentureMemoryRecord[]): Promise<number> {
    const owner = requireOwner(ownerUserId)
    if (!records.length) return 0
    const rows = records.map((record) => ({
      owner_user_id: owner,
      id: record.id,
      venture_id: record.ventureId,
      family: record.family,
      scope: record.scope,
      confidence: record.confidence,
      payload: record,
      observed_at: record.observedAt,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await this.client
      .from('jhadina_venture_memory')
      .upsert(rows, { onConflict: 'owner_user_id,id' })
    if (error) throw new Error(`VENTURE_MEMORY_SAVE_FAILED:${error.message}`)
    return rows.length
  }

  async listMemory(ownerUserId: string, ventureId?: string): Promise<VentureMemoryRecord[]> {
    const owner = requireOwner(ownerUserId)
    let query = this.client
      .from('jhadina_venture_memory')
      .select('payload')
      .eq('owner_user_id', owner)
      .order('observed_at', { ascending: false })
    if (ventureId) query = query.eq('venture_id', ventureId)
    const { data, error } = await query.returns<VentureMemoryRow[]>()
    if (error) throw new Error(`VENTURE_MEMORY_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => row.payload)
  }

  async recordReceipt(receipt: VentureRuntimeReceipt): Promise<VentureRuntimeReceipt> {
    const owner = requireOwner(receipt.ownerUserId)
    const { error } = await this.client
      .from('jhadina_venture_runtime_receipts')
      .upsert({
        owner_user_id: owner,
        id: receipt.id,
        venture_id: receipt.ventureId ?? null,
        kind: receipt.kind,
        evidence_refs: receipt.evidenceRefs,
        payload: receipt.payload,
        recorded_at: receipt.recordedAt,
      }, { onConflict: 'owner_user_id,id' })
    if (error) throw new Error(`VENTURE_RECEIPT_SAVE_FAILED:${error.message}`)
    return receipt
  }

  async listReceipts(ownerUserId: string, kind?: VentureRuntimeReceiptKind): Promise<VentureRuntimeReceipt[]> {
    const owner = requireOwner(ownerUserId)
    let query = this.client
      .from('jhadina_venture_runtime_receipts')
      .select('owner_user_id,id,venture_id,kind,evidence_refs,payload,recorded_at')
      .eq('owner_user_id', owner)
      .order('recorded_at', { ascending: false })
    if (kind) query = query.eq('kind', kind)
    const { data, error } = await query.returns<VentureReceiptRow[]>()
    if (error) throw new Error(`VENTURE_RECEIPT_READ_FAILED:${error.message}`)
    return (data ?? []).map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      ventureId: row.venture_id ?? undefined,
      kind: row.kind,
      evidenceRefs: row.evidence_refs ?? [],
      payload: row.payload,
      recordedAt: row.recorded_at,
    }))
  }
}

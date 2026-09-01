import type {
  AlertDeliveryRecord,
  AlertEvent,
  FeedbackEvent,
  VersionedAssessment,
  WatchlistEntry,
  AlertDeliveryRepository,
  AlertEventRepository,
  FeedbackRepository,
  VersionedAssessmentRepository,
  WatchlistRepository,
} from '@jhadina/opportunity-core'
import { createServiceRoleClient } from '../supabase/service-role'

function serviceClient() {
  const client = createServiceRoleClient()
  if (!client) throw new Error('Supabase service-role configuration is missing')
  return client
}

export class SupabaseWatchlistRepository implements WatchlistRepository {
  async get(id: string) {
    const { data, error } = await serviceClient().from('oce_watchlist_entries').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`Watchlist persistence failed: ${error.message}`)
    return data ? toWatchlist(data) : undefined
  }
  async listByUser(userId: string) {
    const { data, error } = await serviceClient().from('oce_watchlist_entries').select('*').eq('user_id', userId).order('created_at')
    if (error) throw new Error(`Watchlist persistence failed: ${error.message}`)
    return (data ?? []).map(toWatchlist)
  }
  async save(entry: WatchlistEntry) {
    const { data, error } = await serviceClient().from('oce_watchlist_entries').upsert(toWatchlistRow(entry)).select('*').single()
    if (error) throw new Error(`Watchlist persistence failed: ${error.message}`)
    return toWatchlist(data)
  }
  async delete(id: string) {
    const { error } = await serviceClient().from('oce_watchlist_entries').delete().eq('id', id)
    if (error) throw new Error(`Watchlist persistence failed: ${error.message}`)
  }
}

export class SupabaseAlertEventRepository implements AlertEventRepository {
  async get(id: string) {
    const { data, error } = await serviceClient().from('oce_alert_events').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`Alert event persistence failed: ${error.message}`)
    return data ? toAlertEvent(data) : undefined
  }
  async listByWatchlistEntry(watchlistEntryId: string) {
    const { data, error } = await serviceClient().from('oce_alert_events').select('*').eq('watchlist_entry_id', watchlistEntryId).order('detected_at')
    if (error) throw new Error(`Alert event persistence failed: ${error.message}`)
    return (data ?? []).map(toAlertEvent)
  }
  async saveIfAbsent(event: AlertEvent) {
    const client = serviceClient()
    const { data: existing, error: lookupError } = await client.from('oce_alert_events').select('*').eq('watchlist_entry_id', event.watchlistEntryId).eq('fingerprint', event.fingerprint).maybeSingle()
    if (lookupError) throw new Error(`Alert event persistence failed: ${lookupError.message}`)
    if (existing) return { event: toAlertEvent(existing), created: false }
    const { data, error } = await client.from('oce_alert_events').insert(toAlertEventRow(event)).select('*').single()
    if (!error) return { event: toAlertEvent(data), created: true }
    if (error.code === '23505') {
      const { data: raced, error: raceError } = await client.from('oce_alert_events').select('*').eq('watchlist_entry_id', event.watchlistEntryId).eq('fingerprint', event.fingerprint).single()
      if (raceError) throw new Error(`Alert event persistence failed: ${raceError.message}`)
      return { event: toAlertEvent(raced), created: false }
    }
    throw new Error(`Alert event persistence failed: ${error.message}`)
  }
}

export class SupabaseAlertDeliveryRepository implements AlertDeliveryRepository {
  async get(id: string) {
    const { data, error } = await serviceClient().from('oce_alert_deliveries').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`Alert delivery persistence failed: ${error.message}`)
    return data ? toDelivery(data) : undefined
  }
  async getByIdempotencyKey(idempotencyKey: string) {
    const { data, error } = await serviceClient().from('oce_alert_deliveries').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (error) throw new Error(`Alert delivery persistence failed: ${error.message}`)
    return data ? toDelivery(data) : undefined
  }
  async saveIfAbsent(record: AlertDeliveryRecord) {
    const client = serviceClient()
    const { data, error } = await client.from('oce_alert_deliveries').upsert(toDeliveryRow(record), { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('*').maybeSingle()
    if (error) throw new Error(`Alert delivery persistence failed: ${error.message}`)
    if (data) return { record: toDelivery(data), created: true }
    const { data: existing, error: lookupError } = await client.from('oce_alert_deliveries').select('*').eq('idempotency_key', record.idempotencyKey).single()
    if (lookupError) throw new Error(`Alert delivery persistence failed: ${lookupError.message}`)
    return { record: toDelivery(existing), created: false }
  }
  async update(record: AlertDeliveryRecord) {
    const { data, error } = await serviceClient().from('oce_alert_deliveries').update(toDeliveryRow(record)).eq('id', record.id).select('*').single()
    if (error) throw new Error(`Alert delivery persistence failed: ${error.message}`)
    return toDelivery(data)
  }
}

export class SupabaseFeedbackRepository implements FeedbackRepository {
  async get(id: string) {
    const { data, error } = await serviceClient().from('oce_feedback_events').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`Feedback persistence failed: ${error.message}`)
    return data ? toFeedback(data) : undefined
  }
  async listBySubject(subjectId: string) {
    const client = serviceClient()
    const { data, error } = await client.from('oce_feedback_events').select('*').or(`opportunity_id.eq.${subjectId},principal_id.eq.${subjectId}`).order('observed_at')
    if (error) throw new Error(`Feedback persistence failed: ${error.message}`)
    return (data ?? []).map(toFeedback)
  }
  async append(event: FeedbackEvent) {
    const { data, error } = await serviceClient().from('oce_feedback_events').insert(toFeedbackRow(event)).select('*').single()
    if (error) throw new Error(error.code === '23505' ? `Duplicate feedback event: ${event.id}` : `Feedback persistence failed: ${error.message}`)
    return toFeedback(data)
  }
}

export class SupabaseVersionedAssessmentRepository implements VersionedAssessmentRepository {
  async get(id: string) {
    const { data, error } = await serviceClient().from('oce_versioned_assessments').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`Assessment persistence failed: ${error.message}`)
    return data ? toAssessment(data) : undefined
  }
  async listBySubject(subjectId: string, assessmentType?: string) {
    let query = serviceClient().from('oce_versioned_assessments').select('*').eq('subject_id', subjectId).order('assessed_at')
    if (assessmentType) query = query.eq('assessment_type', assessmentType)
    const { data, error } = await query
    if (error) throw new Error(`Assessment persistence failed: ${error.message}`)
    return (data ?? []).map(toAssessment)
  }
  async append(assessment: VersionedAssessment) {
    const client = serviceClient()
    if (assessment.supersedesId) {
      const { data: previous, error: lookupError } = await client.from('oce_versioned_assessments').select('id').eq('id', assessment.supersedesId).maybeSingle()
      if (lookupError) throw new Error(`Assessment persistence failed: ${lookupError.message}`)
      if (!previous) throw new Error(`Assessment supersedes unknown version: ${assessment.supersedesId}`)
    }
    const { data, error } = await client.from('oce_versioned_assessments').insert(toAssessmentRow(assessment)).select('*').single()
    if (error) throw new Error(error.code === '23505' ? `Duplicate assessment: ${assessment.id}` : `Assessment persistence failed: ${error.message}`)
    return toAssessment(data)
  }
}

const toWatchlistRow = (e: WatchlistEntry) => ({ id: e.id, user_id: e.userId, opportunity_id: e.opportunityId, principal_id: e.principalId ?? null, enabled: e.enabled, created_at: e.createdAt })
const toWatchlist = (r: any): WatchlistEntry => ({ id: r.id, userId: r.user_id, opportunityId: r.opportunity_id, principalId: r.principal_id ?? undefined, enabled: r.enabled, createdAt: r.created_at })
const toAlertEventRow = (e: AlertEvent) => ({ id: e.id, fingerprint: e.fingerprint, watchlist_entry_id: e.watchlistEntryId, opportunity_id: e.opportunityId, principal_id: e.principalId ?? null, alert_type: e.type, priority: e.priority, previous_state: e.previousState ?? null, new_state: e.newState ?? null, change_reason: e.changeReason, supporting_evidence_ids: e.supportingEvidenceIds, detected_at: e.detectedAt, engine_version: e.engineVersion })
const toAlertEvent = (r: any): AlertEvent => ({ id: r.id, fingerprint: r.fingerprint, watchlistEntryId: r.watchlist_entry_id, opportunityId: r.opportunity_id, principalId: r.principal_id ?? undefined, type: r.alert_type, priority: r.priority, previousState: r.previous_state ?? undefined, newState: r.new_state ?? undefined, changeReason: r.change_reason, supportingEvidenceIds: r.supporting_evidence_ids ?? [], detectedAt: r.detected_at, engineVersion: r.engine_version })
const toDeliveryRow = (r: AlertDeliveryRecord) => ({ id: r.id, alert_id: r.alertId, recipient_id: r.recipientId, channel: r.channel, priority: r.priority, status: r.status, payload: r.payload ?? {}, idempotency_key: r.idempotencyKey, attempt: r.attempt, created_at: r.createdAt, updated_at: r.updatedAt, next_attempt_at: r.nextAttemptAt ?? null, last_error: r.lastError ?? null, max_attempts: Math.max(1, r.maxAttempts ?? 5), dead_lettered_at: r.deadLetteredAt ?? null })
const toDelivery = (r: any): AlertDeliveryRecord => ({ id: r.id, alertId: r.alert_id, recipientId: r.recipient_id, channel: r.channel, priority: r.priority, status: r.status, payload: r.payload ?? {}, idempotencyKey: r.idempotency_key, attempt: r.attempt, createdAt: r.created_at, updatedAt: r.updated_at, nextAttemptAt: r.next_attempt_at ?? undefined, lastError: r.last_error ?? undefined, maxAttempts: Number(r.max_attempts ?? 5), deadLetteredAt: r.dead_lettered_at ?? undefined })
const toFeedbackRow = (e: FeedbackEvent) => ({ id: e.id, kind: e.kind, event_type: e.type, opportunity_id: e.opportunityId ?? null, principal_id: e.principalId ?? null, source_evidence_ids: e.sourceEvidenceIds, payload: e.payload ?? {}, observed_at: e.observedAt, recorded_at: e.recordedAt, schema_version: Number.parseInt(e.schemaVersion, 10) || 1 })
const toFeedback = (r: any): FeedbackEvent => ({ id: r.id, kind: r.kind, type: r.event_type, opportunityId: r.opportunity_id ?? undefined, principalId: r.principal_id ?? undefined, sourceEvidenceIds: r.source_evidence_ids ?? [], payload: r.payload ?? {}, observedAt: r.observed_at, recordedAt: r.recorded_at, schemaVersion: String(r.schema_version) })
const toAssessmentRow = (a: VersionedAssessment) => ({ id: a.id, subject_id: a.subjectId, assessment_type: a.assessmentType, score: a.score, basis_evidence_ids: a.basisEvidenceIds, supersedes_id: a.supersedesId ?? null, assessed_at: a.assessedAt, engine_version: a.engineVersion })
const toAssessment = (r: any): VersionedAssessment => ({ id: r.id, subjectId: r.subject_id, assessmentType: r.assessment_type, score: Number(r.score), basisEvidenceIds: r.basis_evidence_ids ?? [], supersedesId: r.supersedes_id ?? undefined, assessedAt: r.assessed_at, engineVersion: r.engine_version })

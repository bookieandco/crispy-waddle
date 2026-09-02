import type { SupabaseClient } from '@supabase/supabase-js'
import type { AlertDeliveryRecord, AlertDeliveryRepository } from '@jhadina/opportunity-core'

export type OceAlertDeliveryRow = {
  id: string
  alert_id: string
  recipient_id: string
  channel: AlertDeliveryRecord['channel']
  priority: AlertDeliveryRecord['priority']
  status: AlertDeliveryRecord['status']
  payload: unknown
  idempotency_key: string
  attempt: number
  max_attempts: number
  created_at: string
  updated_at: string
  next_attempt_at: string | null
  last_error: string | null
  dead_lettered_at: string | null
  claimed_at: string | null
  claimed_by: string | null
}

const toRecord = (row: OceAlertDeliveryRow): AlertDeliveryRecord => ({
  id: row.id,
  alertId: row.alert_id,
  recipientId: row.recipient_id,
  channel: row.channel,
  priority: row.priority,
  status: row.status,
  payload: row.payload,
  idempotencyKey: row.idempotency_key,
  attempt: row.attempt,
  maxAttempts: row.max_attempts,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.next_attempt_at ? { nextAttemptAt: row.next_attempt_at } : {}),
  ...(row.last_error ? { lastError: row.last_error } : {}),
  ...(row.dead_lettered_at ? { deadLetteredAt: row.dead_lettered_at } : {}),
})

/** Service-role persistence adapter used only by the OCE delivery worker. */
export class SupabaseAlertDeliveryRepository implements AlertDeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(id: string): Promise<AlertDeliveryRecord | undefined> {
    const { data, error } = await this.client.from('oce_alert_deliveries').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`OCE delivery read failed: ${error.message}`)
    return data ? toRecord(data as OceAlertDeliveryRow) : undefined
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<AlertDeliveryRecord | undefined> {
    const { data, error } = await this.client.from('oce_alert_deliveries').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (error) throw new Error(`OCE delivery idempotency read failed: ${error.message}`)
    return data ? toRecord(data as OceAlertDeliveryRow) : undefined
  }

  async saveIfAbsent(record: AlertDeliveryRecord): Promise<{ record: AlertDeliveryRecord; created: boolean }> {
    const { data, error } = await this.client.from('oce_alert_deliveries').insert({
      id: record.id,
      alert_id: record.alertId,
      recipient_id: record.recipientId,
      channel: record.channel,
      priority: record.priority,
      status: record.status,
      payload: record.payload ?? {},
      idempotency_key: record.idempotencyKey,
      attempt: record.attempt,
      max_attempts: record.maxAttempts,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      next_attempt_at: record.nextAttemptAt ?? null,
      last_error: record.lastError ?? null,
      dead_lettered_at: record.deadLetteredAt ?? null,
    }).select('*').maybeSingle()

    if (!error && data) return { record: toRecord(data as OceAlertDeliveryRow), created: true }

    const existing = await this.getByIdempotencyKey(record.idempotencyKey)
    if (existing) return { record: existing, created: false }
    throw new Error(`OCE delivery insert failed: ${error?.message ?? 'no row returned'}`)
  }

  async update(record: AlertDeliveryRecord): Promise<AlertDeliveryRecord> {
    const { data, error } = await this.client
      .from('oce_alert_deliveries')
      .update({
        status: record.status,
        attempt: record.attempt,
        updated_at: record.updatedAt,
        next_attempt_at: record.nextAttemptAt ?? null,
        last_error: record.lastError ?? null,
        dead_lettered_at: record.deadLetteredAt ?? null,
        claimed_at: null,
        claimed_by: null,
      })
      .eq('id', record.id)
      .select('*')
      .single()

    if (error || !data) throw new Error(`OCE delivery update failed: ${error?.message ?? 'delivery not found'}`)
    return toRecord(data as OceAlertDeliveryRow)
  }

  async claimDue(now: string, workerId: string, limit: number): Promise<AlertDeliveryRecord[]> {
    const { data, error } = await this.client.rpc('claim_oce_alert_deliveries', {
      p_now: now,
      p_worker_id: workerId,
      p_limit: Math.max(1, Math.min(100, Math.floor(limit))),
    })
    if (error) throw new Error(`OCE delivery claim failed: ${error.message}`)
    return ((data ?? []) as OceAlertDeliveryRow[]).map(toRecord)
  }
}

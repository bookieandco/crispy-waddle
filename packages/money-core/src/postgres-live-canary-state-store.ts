import { createHash } from 'node:crypto'
import type { SqlClient } from './postgres-idempotency-store.js'
import { canaryBlockReasons } from './live-canary-store.js'
import {
  assertCanaryPolicy,
  assertRiskMetricSnapshot,
  type CanaryReservation,
  type CanaryReserveResult,
  type LiveCanaryPolicy,
  type LiveCanaryState,
  type LiveCanaryStateStore,
  type LiveRiskMetricSnapshot,
} from './live-canary-contracts.js'

type Row = {
  provider: string
  account_id: string
  trading_date: string
  currency: string
  submitted_notional_minor: string | number | bigint
  submitted_orders: number
  realized_loss_minor: string | number | bigint
  gross_exposure_minor: string | number | bigint
  unresolved_execution_ids: string[]
  risk_metric_observed_at: string | Date | null
  risk_metric_evidence_ids: string[]
  halted: boolean
  halt_reason: string | null
  version: number
  updated_at: string | Date
}

function safe(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('MONEY_050_CANARY_TABLE_INVALID')
  }
  return value
}

function iso(value: string | Date | null): string | undefined {
  if (value == null) return undefined
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapRow(row: Row): LiveCanaryState {
  return Object.freeze({
    provider: row.provider,
    accountId: row.account_id,
    tradingDate: row.trading_date,
    currency: row.currency,
    submittedNotionalMinor: BigInt(row.submitted_notional_minor),
    submittedOrders: row.submitted_orders,
    realizedLossMinor: BigInt(row.realized_loss_minor),
    grossExposureMinor: BigInt(row.gross_exposure_minor),
    unresolvedExecutionIds: Object.freeze(row.unresolved_execution_ids ?? []),
    riskMetricObservedAt: iso(row.risk_metric_observed_at),
    riskMetricEvidenceIds: Object.freeze(row.risk_metric_evidence_ids ?? []),
    halted: row.halted,
    haltReason: row.halt_reason ?? undefined,
    version: row.version,
    updatedAt: iso(row.updated_at)!,
  })
}

function hash(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value, (_, x) => typeof x === 'bigint' ? x.toString() : x))
    .digest('hex')
}

export class PostgresLiveCanaryStateStore implements LiveCanaryStateStore {
  private readonly stateTable: string
  private readonly reservationTable: string

  constructor(
    private readonly client: SqlClient,
    stateTable = 'money_live_canary_state',
    reservationTable = 'money_live_canary_reservations',
  ) {
    this.stateTable = safe(stateTable)
    this.reservationTable = safe(reservationTable)
  }

  private async ensure(
    provider: string,
    accountId: string,
    tradingDate: string,
    currency: string,
    now: string,
  ) {
    await this.client.query(
      `INSERT INTO ${this.stateTable}
       (provider, account_id, trading_date, currency, submitted_notional_minor,
        submitted_orders, realized_loss_minor, gross_exposure_minor,
        unresolved_execution_ids, risk_metric_evidence_ids, halted, version, updated_at)
       VALUES ($1,$2,$3,$4,0,0,0,0,'{}','{}',FALSE,0,$5)
       ON CONFLICT(provider,account_id,trading_date) DO NOTHING`,
      [provider, accountId, tradingDate, currency, now],
    )
  }

  async get(provider: string, accountId: string, tradingDate: string) {
    const result = await this.client.query<Row>(
      `SELECT provider,account_id,trading_date,currency,submitted_notional_minor,
              submitted_orders,realized_loss_minor,gross_exposure_minor,
              unresolved_execution_ids,risk_metric_observed_at,risk_metric_evidence_ids,
              halted,halt_reason,version,updated_at
       FROM ${this.stateTable}
       WHERE provider=$1 AND account_id=$2 AND trading_date=$3
       LIMIT 1`,
      [provider, accountId, tradingDate],
    )
    return result.rows[0] ? mapRow(result.rows[0]) : undefined
  }

  async updateRiskMetrics(snapshot: LiveRiskMetricSnapshot, tradingDate: string, now: string) {
    assertRiskMetricSnapshot(snapshot, {
      provider: snapshot.provider,
      accountId: snapshot.accountId,
      currency: snapshot.currency,
      cutoff: now,
    })
    await this.ensure(snapshot.provider, snapshot.accountId, tradingDate, snapshot.currency, now)
    const loss = snapshot.realizedPnlMinor < 0n ? -snapshot.realizedPnlMinor : 0n
    const result = await this.client.query<Row>(
      `UPDATE ${this.stateTable}
       SET currency=$4,
           realized_loss_minor=$5,
           gross_exposure_minor=$6,
           risk_metric_observed_at=$7,
           risk_metric_evidence_ids=$8,
           version=version+1,
           updated_at=$9
       WHERE provider=$1 AND account_id=$2 AND trading_date=$3
       RETURNING *`,
      [
        snapshot.provider,
        snapshot.accountId,
        tradingDate,
        snapshot.currency,
        loss.toString(),
        snapshot.grossExposureMinor.toString(),
        snapshot.observedAt,
        [...snapshot.evidenceIds],
        now,
      ],
    )
    if (!result.rows[0]) throw new Error('MONEY_050_CANARY_STATE_UPDATE_FAILED')
    return mapRow(result.rows[0])
  }

  async reserve(input: {
    provider: string
    accountId: string
    tradingDate: string
    currency: string
    notionalMinor: bigint
    side: 'BUY' | 'SELL'
    policy: LiveCanaryPolicy
    now: string
  }): Promise<CanaryReserveResult> {
    assertCanaryPolicy(input.policy)
    await this.ensure(
      input.provider,
      input.accountId,
      input.tradingDate,
      input.currency,
      input.now,
    )

    const reservationId = 'canary-reservation:' + hash({
      provider: input.provider,
      accountId: input.accountId,
      tradingDate: input.tradingDate,
      notionalMinor: input.notionalMinor,
      side: input.side,
      now: input.now,
    })
    const projectedExposure = input.side === 'BUY'
      ? 'gross_exposure_minor + $5::bigint'
      : 'GREATEST(0::bigint, gross_exposure_minor - $5::bigint)'

    const sql =
      `WITH updated AS (
         UPDATE ${this.stateTable}
         SET submitted_notional_minor=submitted_notional_minor+$5::bigint,
             submitted_orders=submitted_orders+1,
             gross_exposure_minor=${projectedExposure},
             version=version+1,
             updated_at=$6
         WHERE provider=$1
           AND account_id=$2
           AND trading_date=$3
           AND halted=FALSE
           AND currency=$4
           AND $5::bigint>0
           AND $5::bigint<=$7::bigint
           AND submitted_notional_minor+$5::bigint<=$8::bigint
           AND submitted_orders+1<=$9::int
           AND realized_loss_minor<=$10::bigint
           AND ${projectedExposure}<=$11::bigint
           AND cardinality(unresolved_execution_ids)<=$12::int
           AND risk_metric_observed_at IS NOT NULL
           AND risk_metric_observed_at<=$6::timestamptz
           AND risk_metric_observed_at>=($6::timestamptz-($13::text||' seconds')::interval)
         RETURNING *
       ),
       inserted AS (
         INSERT INTO ${this.reservationTable}
           (reservation_id,provider,account_id,trading_date,notional_minor,side,state_version,status,created_at)
         SELECT $14,provider,account_id,trading_date,$5::bigint,$15,version,'RESERVED',$6
         FROM updated
         RETURNING reservation_id
       )
       SELECT updated.* FROM updated JOIN inserted ON TRUE`

    const result = await this.client.query<Row>(sql, [
      input.provider,
      input.accountId,
      input.tradingDate,
      input.currency,
      input.notionalMinor.toString(),
      input.now,
      input.policy.maxOrderNotionalMinor.toString(),
      input.policy.maxDailySubmittedNotionalMinor.toString(),
      input.policy.maxDailyOrders,
      input.policy.maxDailyRealizedLossMinor.toString(),
      input.policy.maxGrossExposureMinor.toString(),
      input.policy.maxOpenUnknownExecutions,
      input.policy.maxRiskMetricAgeSeconds,
      reservationId,
      input.side,
    ])

    if (!result.rows[0]) {
      const state = await this.get(input.provider, input.accountId, input.tradingDate)
      if (!state) throw new Error('MONEY_050_CANARY_STATE_MISSING')
      return Object.freeze({
        allowed: false as const,
        reasonCodes: canaryBlockReasons(state, input.policy, input),
        state,
      })
    }

    const state = mapRow(result.rows[0])
    const reservation: CanaryReservation = Object.freeze({
      reservationId,
      provider: input.provider,
      accountId: input.accountId,
      tradingDate: input.tradingDate,
      notionalMinor: input.notionalMinor,
      side: input.side,
      stateVersion: state.version,
      authority: 'RISK_GATE_ONLY',
      canExecute: false,
    })
    return Object.freeze({ allowed: true as const, reservation, state })
  }

  async release(reservation: CanaryReservation, now: string) {
    const exposureExpression = reservation.side === 'BUY'
      ? 'GREATEST(0::bigint, s.gross_exposure_minor-x.notional_minor)'
      : 's.gross_exposure_minor+x.notional_minor'

    await this.client.query(
      `WITH released AS (
         UPDATE ${this.reservationTable}
         SET status='RELEASED',released_at=$2
         WHERE reservation_id=$1 AND status='RESERVED'
         RETURNING provider,account_id,trading_date,notional_minor,side
       )
       UPDATE ${this.stateTable} s
       SET submitted_notional_minor=GREATEST(0::bigint,s.submitted_notional_minor-released.notional_minor),
           submitted_orders=GREATEST(0,s.submitted_orders-1),
           gross_exposure_minor=${exposureExpression.replaceAll('x.', 'released.')},
           version=s.version+1,
           updated_at=$2
       FROM released
       WHERE s.provider=released.provider
         AND s.account_id=released.account_id
         AND s.trading_date=released.trading_date`,
      [reservation.reservationId, now],
    )
  }

  async markUnknown(
    provider: string,
    accountId: string,
    tradingDate: string,
    executionId: string,
    now: string,
  ) {
    await this.client.query(
      `UPDATE ${this.stateTable}
       SET unresolved_execution_ids=
         CASE WHEN $4=ANY(unresolved_execution_ids)
              THEN unresolved_execution_ids
              ELSE array_append(unresolved_execution_ids,$4)
         END,
         version=version+1,
         updated_at=$5
       WHERE provider=$1 AND account_id=$2 AND trading_date=$3`,
      [provider, accountId, tradingDate, executionId, now],
    )
  }

  async resolveUnknown(
    provider: string,
    accountId: string,
    tradingDate: string,
    executionId: string,
    now: string,
  ) {
    await this.client.query(
      `UPDATE ${this.stateTable}
       SET unresolved_execution_ids=array_remove(unresolved_execution_ids,$4),
           version=version+1,
           updated_at=$5
       WHERE provider=$1 AND account_id=$2 AND trading_date=$3`,
      [provider, accountId, tradingDate, executionId, now],
    )
  }

  async halt(
    provider: string,
    accountId: string,
    tradingDate: string,
    reason: string,
    now: string,
  ) {
    await this.ensure(provider, accountId, tradingDate, 'USD', now)
    await this.client.query(
      `UPDATE ${this.stateTable}
       SET halted=TRUE,halt_reason=$4,version=version+1,updated_at=$5
       WHERE provider=$1 AND account_id=$2 AND trading_date=$3`,
      [provider, accountId, tradingDate, reason, now],
    )
  }
}

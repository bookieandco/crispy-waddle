import type { AlertDeliveryRecord, AlertDeliveryRepository, DeliveryRetryPolicy, DeliveryRouter } from '@jhadina/opportunity-core'
import { applyDeliveryResult, isTerminalDeliveryStatus } from '@jhadina/opportunity-core'

export type AlertDeliveryWorkerOptions = {
  workerId: string
  batchSize?: number
  retryPolicy: DeliveryRetryPolicy
  now?: () => string
}

export type AlertDeliveryWorkerResult = {
  claimed: number
  completed: number
  retrying: number
  deadLettered: number
  failed: number
}

export class AlertDeliveryWorker {
  constructor(private readonly repository: AlertDeliveryRepository, private readonly router: DeliveryRouter, private readonly options: AlertDeliveryWorkerOptions) {}

  async runOnce(): Promise<AlertDeliveryWorkerResult> {
    const now = this.options.now?.() ?? new Date().toISOString()
    const records = await this.repository.claimDue(now, this.options.workerId, this.options.batchSize ?? 25)
    const result: AlertDeliveryWorkerResult = { claimed: records.length, completed: 0, retrying: 0, deadLettered: 0, failed: 0 }
    for (const record of records) await this.process(record, result)
    return result
  }

  private async process(record: AlertDeliveryRecord, result: AlertDeliveryWorkerResult): Promise<void> {
    const now = this.options.now?.() ?? new Date().toISOString()
    let next: AlertDeliveryRecord
    try {
      const delivery = await this.router.route(record, now)
      next = applyDeliveryResult(record, delivery, now, this.options.retryPolicy)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      next = applyDeliveryResult(record, { status: 'FAILED', error: message }, now, this.options.retryPolicy)
    }
    await this.repository.update(next)
    if (isTerminalDeliveryStatus(next.status)) result.completed += 1
    else if (next.deadLetteredAt) result.deadLettered += 1
    else if (next.status === 'RETRYING') result.retrying += 1
    else result.failed += 1
  }
}

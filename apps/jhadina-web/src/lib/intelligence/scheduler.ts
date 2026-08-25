import type { SourceWatch } from "./source-registry"

export type ScheduledCollection = {
  watchId: string
  dueAt: string
  attempt: number
  priority: SourceWatch["priority"]
}

/** Pure scheduling logic. A worker/cron runtime is responsible for execution. */
export function planCollections(
  watches: SourceWatch[],
  now: Date = new Date(),
): ScheduledCollection[] {
  return watches
    .filter((watch) => watch.enabled && watch.cadenceMinutes > 0)
    .map((watch) => ({
      watchId: watch.id,
      dueAt: new Date(now.getTime() + watch.cadenceMinutes * 60_000).toISOString(),
      attempt: 0,
      priority: watch.priority,
    }))
    .sort((a, b) => {
      const priority = { critical: 0, high: 1, normal: 2, low: 3 }
      return priority[a.priority] - priority[b.priority]
    })
}

export type RetryPolicy = {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 30_000,
  maxDelayMs: 15 * 60_000,
}

export function retryDelayMs(attempt: number, policy = DEFAULT_RETRY_POLICY): number | null {
  if (attempt >= policy.maxAttempts) return null
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1))
}

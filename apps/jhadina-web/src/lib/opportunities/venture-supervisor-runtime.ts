import type { SupabaseClient } from '@supabase/supabase-js'
import { superviseVentureWork } from '@jhadina/opportunity-core'
import { VentureRuntimeRepository } from './venture-runtime-repository'

export async function runVentureSupervisorBatch(
  client: SupabaseClient,
  input: {
    limit?: number
    now?: string
    staleAfterHours?: number
    queuePressureThreshold?: number
  } = {},
) {
  const repository = new VentureRuntimeRepository(client)
  const now = input.now ?? new Date().toISOString()
  const ventures = await repository.listVenturesForSupervisor(input.limit ?? 100)
  const results: Array<{
    ownerUserId: string
    ventureId: string
    issueCount: number
    issueIds: string[]
  }> = []

  for (const { ownerUserId, venture } of ventures) {
    const workItems = await repository.listWorkItems(ownerUserId, venture.id)
    const evidenceRefs = [
      `venture-supervisor:${venture.id}:${now}`,
      ...venture.evidenceRefs,
      ...workItems.flatMap((item) => item.evidenceRefs),
    ]
    const issues = superviseVentureWork({
      venture,
      workItems,
      now,
      staleAfterHours: input.staleAfterHours,
      queuePressureThreshold: input.queuePressureThreshold,
      evidenceRefs: [...new Set(evidenceRefs)],
    })
    await repository.upsertSupervisorIssues(ownerUserId, issues)
    await repository.recordReceipt({
      id: `venture-supervisor-receipt:${venture.id}:${now.replace(/[^0-9A-Za-z]/g, '').slice(0, 24)}`,
      ownerUserId,
      ventureId: venture.id,
      kind: 'supervisor',
      evidenceRefs: [...new Set(evidenceRefs)],
      payload: {
        ventureId: venture.id,
        workItemCount: workItems.length,
        issueCount: issues.length,
        issueIds: issues.map((issue) => issue.id),
        recommendations: issues.map((issue) => ({
          issueId: issue.id,
          severity: issue.severity,
          action: issue.recommendedAction,
        })),
        automaticExternalActionAuthorized: false,
      },
      recordedAt: now,
    })
    results.push({
      ownerUserId,
      ventureId: venture.id,
      issueCount: issues.length,
      issueIds: issues.map((issue) => issue.id),
    })
  }

  return {
    status: 'PASS' as const,
    scannedVentures: ventures.length,
    issuesDetected: results.reduce((sum, result) => sum + result.issueCount, 0),
    results,
    automaticExternalActionAuthorized: false as const,
    automaticLifecycleMutationAuthorized: false as const,
  }
}

import { describe, expect, it } from 'vitest'
import { runPersistedLaunchOutcomeWorker } from './launch-outcome-repository'

type Row = Record<string, any>

function fixtureClient(options: { failFirstApply?: boolean } = {}) {
  const launches: Row[] = [
    {
      launch_id: 'old-rug', chain_id: 'solana-mainnet', token_address: 'OLD',
      deployer_wallet_id: 'wallet-1', developer_entity_id: 'dev-1', cluster_id: null,
      launched_at: '2026-09-01T00:00:00.000Z', outcome: 'RUG',
      outcome_observed_at: '2026-09-02T00:00:00.000Z', evidence_ids: ['old-rug-evidence'],
    },
    {
      launch_id: 'candidate', chain_id: 'solana-mainnet', token_address: 'NEW',
      deployer_wallet_id: 'wallet-1', developer_entity_id: 'dev-1', cluster_id: null,
      launched_at: '2026-09-20T00:00:00.000Z', outcome: 'UNKNOWN',
      outcome_observed_at: null, evidence_ids: ['candidate-evidence'],
    },
  ]
  const observations: Row[] = [{
    observation_id: 'obs-candidate', launch_id: 'candidate', observed_at: '2026-09-20T01:00:00.000Z',
    price_return_from_launch_pct: -90, holder_exit_pct: .8, evidence_ids: ['collapse-evidence'], source: 'fixture',
  }]
  const edges: Row[] = [
    { launch_id: 'old-rug', actor_id: 'dev-1', actor_kind: 'developer', confidence: .4 },
    { launch_id: 'candidate', actor_id: 'dev-1', actor_kind: 'developer', confidence: .8 },
    { launch_id: 'old-rug', actor_id: 'wallet-1', actor_kind: 'wallet', confidence: 1 },
    { launch_id: 'candidate', actor_id: 'wallet-1', actor_kind: 'wallet', confidence: 1 },
  ]
  const evaluations = new Map<string, Row>()
  const histories = new Map<string, Row>()
  let failApply = options.failFirstApply ?? false

  const client = {
    from(table: string) {
      let rows = table === 'jhadina_token_launches' ? launches : table === 'jhadina_token_actor_edges' ? edges : []
      const chain: any = {
        select() { return chain },
        order() { return chain },
        limit(limit: number) { return Promise.resolve({ data: rows.slice(0, limit), error: null }) },
        range(from: number, to: number) { return Promise.resolve({ data: rows.slice(from, to + 1), error: null }) },
        in(column: string, values: string[]) {
          return Promise.resolve({ data: rows.filter(row => values.includes(row[column])), error: null })
        },
      }
      return chain
    },
    async rpc(name: string, args: any) {
      if (name === 'jhadina_shark_latest_outcome_observations') {
        return { data: observations.filter(row => args.p_launch_ids.includes(row.launch_id)), error: null }
      }
      if (name === 'jhadina_shark_apply_outcome_batch') {
        if (failApply) {
          failApply = false
          return { data: null, error: { message: 'simulated transaction abort' } }
        }
        // Simulate transaction semantics: stage everything before committing.
        const stagedLaunches = launches.map(row => ({ ...row }))
        const stagedEvaluations = new Map(evaluations)
        const stagedHistories = new Map(histories)
        for (const evaluation of args.p_evaluations as Row[]) {
          stagedEvaluations.set(evaluation.evaluation_id, evaluation)
          const launch = stagedLaunches.find(row => row.launch_id === evaluation.launch_id)
          if (launch && evaluation.evaluated_outcome !== 'UNKNOWN') {
            launch.outcome = evaluation.evaluated_outcome
            launch.outcome_observed_at = evaluation.outcome_observed_at ?? evaluation.evaluated_at
            launch.evidence_ids = [...new Set([...launch.evidence_ids, ...evaluation.evidence_ids])]
          }
        }
        for (const history of args.p_actor_histories as Row[]) stagedHistories.set(history.actor_key, history)
        launches.splice(0, launches.length, ...stagedLaunches)
        evaluations.clear(); for (const [key, value] of stagedEvaluations) evaluations.set(key, value)
        histories.clear(); for (const [key, value] of stagedHistories) histories.set(key, value)
        return { data: null, error: null }
      }
      throw new Error(`unexpected rpc: ${name}`)
    },
  }

  return { client: client as any, launches, evaluations, histories }
}

describe('SHARK QA17 persisted outcome soak', () => {
  it('recovers from an interrupted atomic batch without duplicate evaluation or reputation shrinkage', async () => {
    const fixture = fixtureClient({ failFirstApply: true })

    await expect(runPersistedLaunchOutcomeWorker(fixture.client, 500))
      .rejects.toThrow('simulated transaction abort')
    expect(fixture.launches.find(row => row.launch_id === 'candidate')?.outcome).toBe('UNKNOWN')
    expect(fixture.evaluations.size).toBe(0)
    expect(fixture.histories.size).toBe(0)

    const first = await runPersistedLaunchOutcomeWorker(fixture.client, 500)
    expect(first.changed).toBe(1)
    expect(fixture.launches.find(row => row.launch_id === 'candidate')?.outcome).toBe('FAILED')
    expect(fixture.evaluations.size).toBe(1)
    expect(fixture.launches.find(row => row.launch_id === 'candidate')?.outcome_observed_at)
      .toBe('2026-09-20T01:00:00.000Z')

    const developer = fixture.histories.get('developer:dev-1')
    expect(developer.launches).toBe(2)
    expect(developer.bad_launches).toBe(1)
    expect(developer.failed_launches).toBe(1)
    expect(developer.association_confidence).toBeCloseTo(.6, 10)

    for (let iteration = 0; iteration < 25; iteration += 1) {
      await runPersistedLaunchOutcomeWorker(fixture.client, 500)
    }
    expect(fixture.evaluations.size).toBe(1)
    expect(fixture.launches.find(row => row.launch_id === 'candidate')?.outcome_observed_at)
      .toBe('2026-09-20T01:00:00.000Z')
    expect(fixture.histories.get('developer:dev-1')?.launches).toBe(2)
    expect(fixture.histories.get('developer:dev-1')?.evidence_ids)
      .toEqual(expect.arrayContaining(['old-rug-evidence', 'candidate-evidence', 'collapse-evidence']))
  })
})

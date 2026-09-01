import { describe, expect, it } from 'vitest'
import { InMemoryNonceReplayGuard } from '../../security-core/src/replay-guard.js'
import { ActionExecutor, InMemoryActionLedger, type ActionRequest } from './action-executor.js'

const request: ActionRequest<{ value: string }> = {
  id: 'action-replay-1',
  userId: 'user-replay-1',
  type: 'test.action',
  action: { value: 'ok' },
  requestedAt: new Date().toISOString(),
  nonce: 'nonce-replay-1',
}

describe('ActionExecutor durable replay boundary', () => {
  it('claims the nonce only after policy allows and rejects the second execution', async () => {
    const ledger = new InMemoryActionLedger()
    const replayGuard = new InMemoryNonceReplayGuard()
    let executions = 0
    const executor = new ActionExecutor(
      { async evaluate() { return 'allow' } },
      ledger,
      [{ supports: (type) => type === 'test.action', async execute() { executions += 1; return 'done' } }],
      undefined,
      replayGuard,
    )

    await expect(executor.execute(request)).resolves.toBe('done')
    await expect(executor.execute(request)).rejects.toThrow('Action replay rejected')
    expect(executions).toBe(1)
  })

  it('does not consume a nonce when policy denies the action', async () => {
    const ledger = new InMemoryActionLedger()
    const replayGuard = new InMemoryNonceReplayGuard()
    const executor = new ActionExecutor(
      { async evaluate() { return 'deny' } },
      ledger,
      [{ supports: () => true, async execute() { throw new Error('must not execute') } }],
      undefined,
      replayGuard,
    )

    await expect(executor.execute(request)).rejects.toThrow('Action denied')
    expect(ledger.list().some((event) => event.metadata?.reason === 'replayed_action_nonce')).toBe(false)
  })

  it('atomically allows only one concurrent execution for one nonce', async () => {
    const ledger = new InMemoryActionLedger()
    const replayGuard = new InMemoryNonceReplayGuard()
    let executions = 0
    const executor = new ActionExecutor(
      { async evaluate() { return 'allow' } },
      ledger,
      [{
        supports: () => true,
        async execute() { executions += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return 'done' },
      }],
      undefined,
      replayGuard,
    )

    const results = await Promise.allSettled([executor.execute(request), executor.execute(request)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(executions).toBe(1)
  })
})

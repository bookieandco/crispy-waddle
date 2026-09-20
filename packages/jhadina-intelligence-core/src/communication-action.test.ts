import assert from 'node:assert/strict'
import test from 'node:test'
import { ActionExecutor, InMemoryActionLedger, type ActionPolicy } from '@jhadina/action-core'
import { CommunicationAuthorizationHandler, toCommunicationActionRequest } from './communication-action.js'

const intent = {
  intentId: 'intent-1', correlationId: 'corr-1', actorId: 'actor-1',
  recipient: { endpointId: 'person-1', kind: 'person' as const, trustState: 'trusted' as const, authorization: { capability: 'communications.send' as const, granted: true, evidenceRef: 'grant:1' } },
  capability: 'communications.send' as const, contentRef: 'content:1', createdAt: '2026-09-19T00:00:00.000Z',
}

test('communication reaches dispatch boundary only through ActionExecutor policy', async () => {
  const ledger = new InMemoryActionLedger()
  const policy: ActionPolicy = { async evaluate() { return 'allow' } }
  const executor = new ActionExecutor(policy, ledger, [new CommunicationAuthorizationHandler()])
  const result = await executor.execute(toCommunicationActionRequest({ intent }))
  assert.equal(result.correlationId, 'corr-1')
  assert.deepEqual(ledger.list().map(e => e.status), ['started', 'completed'])
})

test('denied policy prevents communication dispatch', async () => {
  const ledger = new InMemoryActionLedger()
  const policy: ActionPolicy = { async evaluate() { return 'deny' } }
  const executor = new ActionExecutor(policy, ledger, [new CommunicationAuthorizationHandler()])
  await assert.rejects(() => executor.execute(toCommunicationActionRequest({ intent })), /Action denied/)
  assert.deepEqual(ledger.list().map(e => e.status), ['started', 'denied'])
})

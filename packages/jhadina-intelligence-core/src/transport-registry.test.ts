import assert from 'node:assert/strict'
import test from 'node:test'
import { TransportRegistry } from './transport-registry.js'

const dispatch = { correlationId: 'corr-1', intent: { correlationId: 'corr-1' } } as any

test('selects only healthy/degraded capable routes by priority', () => {
  const registry = new TransportRegistry([
    { identity: { transportId:'offline', adapter:'x', address:'a' }, health:'offline', capabilities:['message.send'], priority:0 },
    { identity: { transportId:'store', adapter:'y', address:'b' }, health:'healthy', capabilities:['store.forward'], priority:1 },
    { identity: { transportId:'send', adapter:'z', address:'c' }, health:'degraded', capabilities:['message.send'], priority:2 },
  ])
  assert.equal(registry.select(dispatch).identity.transportId, 'send')
})

test('fails closed when no route can satisfy required capability', () => {
  const registry = new TransportRegistry([{ identity:{transportId:'x',adapter:'x',address:'a'}, health:'offline', capabilities:['message.send'], priority:0 }])
  assert.throws(() => registry.select(dispatch), /COMMUNICATION_ROUTE_UNAVAILABLE/)
})


test('route selection rejects forged dispatch correlation lineage', () => {
  const registry = new TransportRegistry([{ identity: { transportId: 't1', adapter: 'test', address: 'a' }, health: 'healthy', capabilities: ['message.send'], priority: 1 }])
  assert.throws(() => registry.select({ ...dispatch, correlationId: 'forged-correlation' }), /AUTHORIZED_DISPATCH_LINEAGE_MISMATCH/)
})

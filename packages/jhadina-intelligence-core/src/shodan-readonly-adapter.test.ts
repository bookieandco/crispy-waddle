import assert from 'node:assert/strict'
import test from 'node:test'
import { ShodanReadOnlyAdapter, type ShodanTransport } from './shodan-readonly-adapter.js'

test('maps an allowlisted passive read into ObservationEnvelope', async () => {
  const calls: string[] = []
  const transport: ShodanTransport = {
    async read(capability, subject) {
      calls.push(`${capability}:${subject}`)
      return { ip: subject, ports: [443] }
    },
  }
  const adapter = new ShodanReadOnlyAdapter(transport)
  const result = await adapter.observe({
    observationId: 'obs-shodan-1',
    subjectId: '203.0.113.10',
    capability: 'host.read',
    observedAt: '2026-09-19T00:00:00.000Z',
    receivedAt: '2026-09-19T00:00:01.000Z',
    evidenceRefs: ['shodan:host:203.0.113.10'],
  })

  assert.deepEqual(calls, ['host.read:203.0.113.10'])
  assert.equal(result.source.provider, 'shodan')
  assert.equal(result.trustEffect, 'NONE')
  assert.equal(result.authorizationEffect, 'NONE')
  assert.equal(result.source.sourceRef, 'shodan:host.read:203.0.113.10')
})

test('fails closed before transport for unsupported or mutating capability', async () => {
  let called = false
  const adapter = new ShodanReadOnlyAdapter({ async read() { called = true; return {} } })
  await assert.rejects(() => adapter.observe({
    observationId: 'obs-bad',
    subjectId: '203.0.113.10',
    capability: 'scan.start',
    observedAt: '2026-09-19T00:00:00.000Z',
  }), /SHODAN_CAPABILITY_NOT_READ_ONLY/)
  assert.equal(called, false)
  await assert.rejects(() => adapter.execute('scan.start'), /SHODAN_MUTATION_UNSUPPORTED/)
})


test('default Shodan evidence reference contains no credential material', async () => {
  const adapter = new ShodanReadOnlyAdapter({ async read() { return {} } })
  const result = await adapter.observe({ observationId: 'obs-ref', subjectId: 'example.org', capability: 'dns.read', observedAt: '2026-09-20T00:00:00.000Z', receivedAt: '2026-09-20T00:00:01.000Z' })
  assert.deepEqual(result.provenance.evidenceRefs, ['shodan:dns.read:example.org'])
  assert.equal(JSON.stringify(result).includes('key='), false)
})

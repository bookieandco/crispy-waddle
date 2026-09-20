import assert from 'node:assert/strict'
import test from 'node:test'
import { InMemoryActionLedger } from '@jhadina/action-core'
import { appendObservationEvidence } from './observation-evidence.js'
import { createObservationEnvelope } from './observation.js'

test('canonical observation evidence stores provenance but not provider payload', async()=>{
 const ledger=new InMemoryActionLedger()
 const envelope=createObservationEnvelope({
  observationId:'obs-evidence-1',
  subjectId:'host:example',
  source:{provider:'shodan',capability:'host.read',adapterVersion:'1',sourceRef:'shodan:host.read:host:example'},
  provenance:{observedAt:'2026-09-20T00:00:00.000Z',receivedAt:'2026-09-20T00:00:01.000Z',evidenceRefs:['shodan:host.read:host:example']},
  payload:{secretProviderField:'must-not-enter-ledger'},
  limitations:{freshness:'unknown',limitations:['passive observation']},
 })
 await appendObservationEvidence({ledger,actorId:'actor-1',envelope})
 const serialized=JSON.stringify(ledger.list())
 assert.match(serialized,/observation\.shodan\.host\.read/)
 assert.match(serialized,/trustEffect":"NONE/)
 assert.equal(serialized.includes('must-not-enter-ledger'),false)
})

test('observation evidence remains actor scoped', async()=>{
 const ledger=new InMemoryActionLedger()
 const envelope=createObservationEnvelope({
  observationId:'obs-evidence-2',
  subjectId:'host:example',
  source:{provider:'shodan',capability:'internetdb.read',adapterVersion:'1'},
  provenance:{observedAt:'2026-09-20T00:00:00.000Z',receivedAt:'2026-09-20T00:00:01.000Z',evidenceRefs:[]},
  payload:{},
 })
 await appendObservationEvidence({ledger,actorId:'verified-user',envelope})
 assert.equal(ledger.list()[0]?.userId,'verified-user')
 assert.equal(ledger.list()[0]?.metadata?.authorizationEffect,'NONE')
})

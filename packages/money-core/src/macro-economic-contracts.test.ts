import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertEconomicObservation, observationWasAvailableAt, selectEconomicObservationsAtCutoff, assertEconomicVintage, calculateMacroSurprise, buildMacroSnapshot } from './macro-economic-contracts.js'

const ref={evidenceId:'e1',sourceId:'macro-source',observedAt:'2026-01-01T00:00:00Z',receivedAt:'2026-01-01T00:01:00Z',quality:'HIGH' as const,inputHash:'h'}
const observation={observationId:'o1',indicatorId:'cpi-us',value:3.1,unit:'percent',observedAt:'2026-01-01T00:00:00Z',publishedAt:'2026-01-10T13:30:00Z',availableAt:'2026-01-10T13:30:00Z',receivedAt:'2026-01-10T13:31:00Z',status:'VALID' as const,evidenceRefs:[ref],provenanceHash:'p'}

test('rejects impossible observation clock ordering',()=>assert.throws(()=>assertEconomicObservation({...observation,availableAt:'2026-01-10T13:29:00Z'})))
test('enforces point-in-time availability',()=>{ assert.equal(observationWasAvailableAt(observation,'2026-01-10T13:29:59Z'),false); assert.equal(observationWasAvailableAt(observation,'2026-01-10T13:30:00Z'),true) })
test('does not leak future macro observations',()=>assert.equal(selectEconomicObservationsAtCutoff([observation], '2026-01-10T13:29:59Z').length,0))
test('validates vintage ordering',()=>assert.throws(()=>assertEconomicVintage({vintageId:'v1',indicatorId:'cpi-us',observationId:'o1',publishedAt:'2026-01-10T13:30:00Z',availableAt:'2026-01-10T13:29:00Z',revisionNumber:0,evidenceRefs:[ref],provenanceHash:'p'})))
test('computes surprise only when expected and actual exist',()=>{ assert.equal(calculateMacroSurprise({...({eventId:'e',jurisdiction:'US',scheduledAt:'2026-01-01T00:00:00Z',eventType:'CPI',evidenceRefs:[ref],provenanceHash:'p'})}),undefined); const s=calculateMacroSurprise({eventId:'e',jurisdiction:'US',scheduledAt:'2026-01-01T00:00:00Z',eventType:'CPI',consensusValue:2.9,actualValue:3.1,evidenceRefs:[ref],provenanceHash:'p'}); assert.equal(s?.surprise,0.2) })
test('snapshot includes only observations available at cutoff',()=>{ const snap=buildMacroSnapshot([observation],[], '2026-01-10T13:30:00Z',undefined,[],[],'macro-v1',[ref],'p'); assert.deepEqual(snap.observationIds,['o1']) })

import {describe,expect,it} from 'vitest'
import {createSignalHypothesis,ingestExternalSignal} from '../external-signal-ingest'
describe('external signal ingestion',()=>{
 it('extracts social token/transaction candidates but never creates trade authority',()=>{
  const o=ingestExternalSignal({observationId:'tg1',platform:'TELEGRAM',sourceHandle:'channel',text:'new pool https://solscan.io/tx/5HueCGU8rMjxEXxiPuD5BDuRaKzy1EdD4JtT2x1xQpQ1 and 11111111111111111111111111111111',observedAt:'2026-09-21T20:00:00Z',availableAt:'2026-09-21T20:00:01Z'})
  expect(o.memoryTier).toBe('KNOWN');expect(o.canAuthorizeTrade).toBe(false);expect(o.candidates.some(x=>x.kind==='SOLSCAN_TX')).toBe(true)
  const h=createSignalHypothesis({observation:o,tokenCandidate:'11111111111111111111111111111111',rationale:'candidate mentioned by source',evidenceIds:['tg1']})
  expect(h.memoryTier).toBe('INFERRED');expect(h.canAuthorizeTrade).toBe(false)
 })
 it('rejects impossible availability',()=>expect(()=>ingestExternalSignal({observationId:'x',platform:'X',sourceHandle:'a',text:'abc',observedAt:'2026-09-21T20:00:01Z',availableAt:'2026-09-21T20:00:00Z'})).toThrow('availability_invalid'))
})
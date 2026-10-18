import {describe,expect,it} from 'vitest'
import {createAlphaEvidenceV2} from '../alpha-evidence-v2'

const base={
  sourceEventId:'provider:post:1',sourceFamily:'SOCIAL' as const,
  sourceHandle:'source-a',occurredAt:'2026-10-17T18:00:00Z',
  publishedAt:'2026-10-17T18:00:00Z',
  receivedAt:'2026-10-17T18:06:00Z',
  availableAt:'2026-10-17T18:06:01Z',evidenceIds:['receipt-1'],
}
describe('SHARK alpha evidence V2',()=>{
  it('counts a forwarded older post from its availability, not its claimed publication time',()=>{
    const v=createAlphaEvidenceV2({...base,originalEventId:'original-post',contentFingerprint:'same-call'})
    expect(v.latencyMs).toBe(361000)
    expect(v.originalEventId).toBe('original-post')
    expect(v.contentFingerprint).toBe('same-call')
    expect(v.providerAttestation).toBe('UNVERIFIED')
    expect(v.canAuthorizeTrade).toBe(false)
    expect(Object.isFrozen(v)).toBe(true)
  })
  it('rejects decisions before receipt, future publication, and backward source time',()=>{
    expect(()=>createAlphaEvidenceV2({...base,availableAt:'2026-10-17T18:05:00Z'})).toThrow('clock_order')
    expect(()=>createAlphaEvidenceV2({...base,publishedAt:'2026-10-17T19:00:00Z'})).toThrow('publication_clock')
    expect(()=>createAlphaEvidenceV2({...base,occurredAt:'2026-10-17T19:00:00Z'})).toThrow('clock_order')
    expect(()=>createAlphaEvidenceV2({...base,receivedAt:'yesterday'})).toThrow('received_at_invalid')
  })
  it('does not invent publication time or attest provenance',()=>{
    const v=createAlphaEvidenceV2({...base,publishedAt:undefined,sourceFamily:'CHAIN'})
    expect(v.publicationStatus).toBe('UNVERIFIED')
    expect(v.authority).toBe('EVIDENCE_ONLY')
    expect(v.canAutoCopy).toBe(false)
  })
  it('deduplicates only identical evidence references and never guesses an origin',()=>{
    const v=createAlphaEvidenceV2({...base,evidenceIds:['b','a','a']})
    expect(v.evidenceIds).toEqual(['a','b'])
    expect(v.originalEventId).toBeUndefined()
  })
})

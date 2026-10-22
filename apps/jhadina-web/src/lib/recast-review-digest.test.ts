import {describe,expect,it} from 'vitest'
import {canonicalRecastEvidence,sealRecastEvidence,verifyRecastEvidenceSeal} from './recast-review-digest'
describe('Recast canonical evidence seals',()=>{
  it('hashes JSON object order independently, across nested objects',()=>{
    const a={project:'p',nested:{z:[1,true,'x'],a:'verified'}}
    const b={nested:{a:'verified',z:[1,true,'x']},project:'p'}
    expect(canonicalRecastEvidence(a)).toBe(canonicalRecastEvidence(b))
    expect(sealRecastEvidence(a)).toBe(sealRecastEvidence(b))
    expect(verifyRecastEvidenceSeal(b,sealRecastEvidence(a))).toBe(true)
  })
  it('catches alteration of retained approval or source rights payload',()=>{
    const receipt={approved:true,rightsReceiptId:'trusted:1',sourceVideoSha256:'a'.repeat(64)}
    const seal=sealRecastEvidence(receipt)
    expect(verifyRecastEvidenceSeal({...receipt,approved:false},seal)).toBe(false)
    expect(verifyRecastEvidenceSeal({...receipt,rightsReceiptId:'forged'},seal)).toBe(false)
    expect(verifyRecastEvidenceSeal(receipt,'b'.repeat(64))).toBe(false)
  })
  it('refuses noncanonical undefined, NaN, cyclic, or excessive input',()=>{
    expect(()=>sealRecastEvidence({note:undefined})).toThrow('DIRECTOR_RECAST_EVIDENCE_NON_JSON_VALUE')
    expect(()=>sealRecastEvidence({score:Number.NaN})).toThrow('DIRECTOR_RECAST_EVIDENCE_NON_JSON_VALUE')
    const cycle:any={};cycle.self=cycle
    expect(()=>sealRecastEvidence(cycle)).toThrow('DIRECTOR_RECAST_EVIDENCE_DEPTH_EXCEEDED')
    expect(()=>sealRecastEvidence({text:'x'.repeat(250001)})).toThrow()
    expect(verifyRecastEvidenceSeal({oops:undefined},'a'.repeat(64))).toBe(false)
  })
})
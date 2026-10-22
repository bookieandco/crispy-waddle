import {describe,expect,it} from 'vitest'
import {splitSamGatewayBatches} from './sam-safe-batches'

describe('SAM gateway bounded writes',()=>{
  it('splits catalog payloads on UTF-8 bytes and row counts',()=>{
    const rows=Array.from({length:23},(_,i)=>({id:i,raw:'ñ'.repeat(800)}))
    const batches=splitSamGatewayBatches(rows,10,5000)
    expect(batches.length).toBeGreaterThan(2)
    expect(batches.flat()).toEqual(rows)
    expect(batches.every(b=>b.length<=10)).toBe(true)
    expect(batches.every(b=>new TextEncoder().encode(JSON.stringify(b)).byteLength<=5000)).toBe(true)
  })
  it('fails closed on a single poison record',()=>{
    expect(()=>splitSamGatewayBatches([{raw:'a'.repeat(8000)}],40,2000))
      .toThrow('SAM_SINGLE_ROW_EXCEEDS_GATEWAY_BUDGET')
  })
  it('preserves an empty scan as zero writes',()=>{
    expect(splitSamGatewayBatches([])).toEqual([])
  })
})

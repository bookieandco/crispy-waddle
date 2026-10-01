import { describe, expect, it } from 'vitest'
import { VentureScoutRegistry, createReadOnlyVentureScout } from './venture-scout-registry'

describe('venture scout registry',()=>{
  it('registers bounded read-only scouts',async()=>{
    const registry=new VentureScoutRegistry()
    const registered=createReadOnlyVentureScout({
      descriptor:{
        id:'scout:market',
        label:'Market scout',
        sourceKind:'marketplace',
        enabled:true,
        maxSignalsPerRun:5,
        maxRuntimeMs:1000,
        readOnly:true,
      },
      async scan({capturedAt}){
        return {
          source:'fixture-market',
          signals:[{
            id:'signal:1',
            kind:'sales',
            sourceRef:'source:1',
            observedAt:capturedAt,
            note:'Paid demand',
            confidence:0.8,
          }],
          evidenceRefs:['scan:1'],
        }
      },
    })
    registry.register(registered)
    expect(registry.enabled()).toHaveLength(1)
    const batch=await registry.enabled()[0].scan({
      opportunity:{
        id:'opportunity:1',
        title:'Fixture',
        family:'business',
        type:'commercial',
        sourceUrl:'https://example.test',
        sourceName:'Fixture',
        claims:[],
        evidence:[],
        verificationStatus:'unverified',
        sourceConfidence:0.8,
        riskFlags:[],
        status:'discovered',
        createdAt:'2026-10-01T17:00:00.000Z',
        updatedAt:'2026-10-01T17:00:00.000Z',
      },
      capturedAt:'2026-10-01T17:05:00.000Z',
    })
    expect(batch.externalMutationPerformed).toBe(false)
    expect(batch.scoutId).toBe('scout:market')
  })

  it('rejects duplicate scout ids',()=>{
    const registry=new VentureScoutRegistry()
    const registered=createReadOnlyVentureScout({
      descriptor:{id:'scout:x',label:'X',sourceKind:'other',enabled:true,maxSignalsPerRun:1,maxRuntimeMs:1000,readOnly:true},
      async scan(){return {source:'x',signals:[],evidenceRefs:['x']}},
    })
    registry.register(registered)
    expect(()=>registry.register(registered)).toThrow(/already registered/)
  })

  it('rejects mutable descriptors',()=>{
    expect(()=>createReadOnlyVentureScout({
      descriptor:{id:'scout:x',label:'X',sourceKind:'other',enabled:true,maxSignalsPerRun:1,maxRuntimeMs:1000,readOnly:false as true},
      async scan(){return {source:'x',signals:[],evidenceRefs:['x']}},
    })).toThrow(/read-only/)
  })
})

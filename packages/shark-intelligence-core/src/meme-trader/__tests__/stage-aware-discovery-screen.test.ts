import {describe,expect,it} from 'vitest'
import {
  SHARK_DISCOVERY_PRESETS,evaluateSharkDiscoveryScreen,
  type SharkDiscoveryObservation,type SharkDiscoveryPresetId,
} from '../stage-aware-discovery-screen'

const date='2026-10-21T19:01:00Z'
const base:SharkDiscoveryObservation={
  chainId:'solana',mint:'Mint1',stage:'NEW_PAIR',protocol:'pump',
  observedAt:'2026-10-21T19:00:00Z',availableAt:date,evaluatedAsOf:date,
  volumeUsd:1000,socialLinksCount:1,
  fee:{kind:'GLOBAL_FEES_PAID',unit:'SOL',amount:0.2,venue:'terminal-a',
    observedAt:'2026-10-21T19:00:30Z',evidenceId:'fee-a'},
  evidenceIds:['mint-a','fee-a'],
}
const screen=(input:SharkDiscoveryObservation,id:SharkDiscoveryPresetId)=>
  evaluateSharkDiscoveryScreen(input,id)

describe('source-derived SHARK discovery screens',()=>{
  it('keeps five presets research-only without claiming rug protection',()=>{
    expect(SHARK_DISCOVERY_PRESETS).toHaveLength(5)
    expect(SHARK_DISCOVERY_PRESETS.every(p=>p.status==='UNVALIDATED_SOURCE_HYPOTHESIS'&&!p.canAuthorizeTrade)).toBe(true)
    const result=screen(base,'VIDEO1_NEW_PAIR_SOL_V1')
    expect(result.disposition).toBe('MATCH')
    expect(result.canLabelRug).toBe(false)
    expect(result.canAuthorizeTrade).toBe(false)
    expect(result.authority).toBe('DISCOVERY_RESEARCH_ONLY')
  })

  it('filters low fee observations as SKIP, never as confirmed rugs',()=>{
    const result=screen({...base,fee:{...base.fee!,amount:.008}},'VIDEO1_NEW_PAIR_SOL_V1')
    expect(result.disposition).toBe('SKIP')
    expect(result.failedRules).toContain('feePaidSol')
    expect(result.canLabelRug).toBe(false)
  })

  it('treats absent and wrong-kind or wrong-currency fees as missing',()=>{
    for(const fee of [
      undefined,
      {...base.fee!,kind:'TOTAL_FEES_PAID' as const},
      {...base.fee!,unit:'ETH' as const},
    ]){
      const result=screen({...base,fee},'VIDEO1_NEW_PAIR_SOL_V1')
      expect(result.disposition).toBe('REVIEW')
      expect(result.missingRules).toContain('feePaidSol')
    }
  })

  it('matches source first-video final-stretch bounds, including fast variant',()=>{
    const candidate:SharkDiscoveryObservation={
      ...base,stage:'FINAL_STRETCH',ageMinutes:25,
      holderCount:100,marketCapUsd:3000,
      fee:{...base.fee!,amount:4},
    }
    expect(screen(candidate,'VIDEO1_FINAL_STRETCH_SOL_V1').disposition).toBe('MATCH')
    const fast=screen(candidate,'VIDEO1_FINAL_STRETCH_FAST_SOL_V1')
    expect(fast.disposition).toBe('SKIP')
    expect(fast.failedRules).toContain('ageMinutes')
    expect(screen({...candidate,ageMinutes:20},'VIDEO1_FINAL_STRETCH_FAST_SOL_V1').disposition).toBe('MATCH')
    expect(screen({...candidate,holderCount:undefined},'VIDEO1_FINAL_STRETCH_SOL_V1').disposition).toBe('REVIEW')
  })

  it('applies migrated thresholds without inventing an age limit',()=>{
    const token:SharkDiscoveryObservation={
      ...base,stage:'MIGRATED',ageMinutes:9999,marketCapUsd:15000,
      fee:{...base.fee!,amount:5},
    }
    expect(screen(token,'VIDEO1_MIGRATED_SOL_V1').disposition).toBe('MATCH')
    expect(screen({...token,socialLinksCount:0},'VIDEO1_MIGRATED_SOL_V1').disposition).toBe('SKIP')
  })

  it('keeps the second video Solana trending fee definition separate',()=>{
    const token:SharkDiscoveryObservation={
      ...base,stage:'TRENDING',ageMinutes:2880,marketCapUsd:100000,
      fee:{...base.fee!,kind:'TOTAL_FEES_PAID',amount:15},
      socialLinksCount:undefined,
    }
    expect(screen(token,'VIDEO2_TRENDING_SOL_V1').disposition).toBe('MATCH')
    const globalFees=screen({...token,fee:{...token.fee!,kind:'GLOBAL_FEES_PAID'}},'VIDEO2_TRENDING_SOL_V1')
    expect(globalFees.disposition).toBe('REVIEW')
    expect(globalFees.missingRules).toContain('feePaidSol')
    expect(screen({...token,ageMinutes:2881},'VIDEO2_TRENDING_SOL_V1').disposition).toBe('SKIP')
  })

  it('preserves independent defensive blocks over even a matching token',()=>{
    const result=screen({...base,defensiveBlockReasons:['known-sell-disabled','LP-withdraw-risk','LP-withdraw-risk']},'VIDEO1_NEW_PAIR_SOL_V1')
    expect(result.disposition).toBe('BLOCKED')
    expect(result.defensiveBlockReasons).toEqual(['LP-withdraw-risk','known-sell-disabled'])
  })

  it('fails closed on future or unproven fee receipts and wrong stage',()=>{
    expect(()=>screen({...base,evaluatedAsOf:'2026-10-21T18:59:00Z'},'VIDEO1_NEW_PAIR_SOL_V1'))
      .toThrow('future_evidence')
    expect(()=>screen({...base,fee:{...base.fee!,observedAt:'2026-10-21T19:02:00Z'}},'VIDEO1_NEW_PAIR_SOL_V1'))
      .toThrow('future_fee')
    expect(()=>screen({...base,fee:{...base.fee!,evidenceId:'not-in-evidence'}},'VIDEO1_NEW_PAIR_SOL_V1'))
      .toThrow('fee_provenance_required')
    expect(()=>screen({...base,stage:'MIGRATED'},'VIDEO1_NEW_PAIR_SOL_V1'))
      .toThrow('stage_mismatch')
  })

  it('requires valid counts, timestamps, and source identities',()=>{
    expect(()=>screen({...base,holderCount:-1},'VIDEO1_NEW_PAIR_SOL_V1')).toThrow('holderCount_invalid')
    expect(()=>screen({...base,socialLinksCount:1.5},'VIDEO1_NEW_PAIR_SOL_V1')).toThrow('socials_fractional')
    expect(()=>screen({...base,evidenceIds:[]},'VIDEO1_NEW_PAIR_SOL_V1')).toThrow('evidence_required')
    expect(()=>screen({...base,availableAt:'bad'},'VIDEO1_NEW_PAIR_SOL_V1')).toThrow('available_at_invalid')
  })
})

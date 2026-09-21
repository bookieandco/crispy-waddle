import {describe,expect,it} from 'vitest'
import {mergePumpLaunchFeatures,normalizePumpLaunchFeatures} from '../pump-v2-launch-features'

describe('Pump 2 launch feature semantics',()=>{
  it('treats holder-reward creator replacement as protocol semantics, not a creator-mismatch risk signal',()=>{
    const f=normalizePumpLaunchFeatures({observationKind:'CREATE_V2',observedAt:'2026-09-21T20:00:00Z',evidenceIds:['pump:create:1'],isHolderReward:true,isCashbackCoin:false,creatorArgument:'human-creator',recordedCreator:'pump-controlled-holder-pda'})
    expect(f.holderReward).toBe('ENABLED')
    expect(f.creatorFeeRecipientSemantics).toBe('HOLDER_REWARDS_PROTOCOL')
    expect(f.creatorMismatchIsRiskSignal).toBe(false)
  })
  it('rejects cashback enabled on a new create_v2 launch',()=>{
    expect(()=>normalizePumpLaunchFeatures({observationKind:'CREATE_V2',observedAt:'2026-09-21T20:00:00Z',evidenceIds:['pump:create:2'],isCashbackCoin:true})).toThrow('pump_create_v2_cashback_deprecated')
  })
  it('allows legacy cashback state observations for existing coins',()=>{
    const f=normalizePumpLaunchFeatures({observationKind:'BONDING_CURVE_STATE',observedAt:'2026-09-21T20:00:00Z',evidenceIds:['pump:curve:1'],isCashbackCoin:true})
    expect(f.cashback).toBe('LEGACY_ENABLED')
  })
  it('merges backward-compatible account observations without inventing absent fields',()=>{
    const old=normalizePumpLaunchFeatures({observationKind:'BONDING_CURVE_STATE',observedAt:'2026-09-21T19:00:00Z',evidenceIds:['old'],isHolderReward:undefined})
    const current=normalizePumpLaunchFeatures({observationKind:'CREATE_EVENT',observedAt:'2026-09-21T20:00:00Z',evidenceIds:['new'],isHolderReward:true})
    const merged=mergePumpLaunchFeatures([old,current])!
    expect(merged.holderReward).toBe('ENABLED')
    expect(merged.evidenceIds).toEqual(['new','old'])
  })
})

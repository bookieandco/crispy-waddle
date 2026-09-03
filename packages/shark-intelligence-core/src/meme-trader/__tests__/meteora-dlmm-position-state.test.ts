import { describe, expect, it } from 'vitest'
import { applyDlmmPositionTransition, type DlmmPositionState } from '../meteora-dlmm-position-state'

const base = (action: 'OPEN'|'ADD'|'REMOVE'|'REBALANCE'|'CLAIM_FEE'|'CLOSE', extra: Record<string, unknown> = {}) => ({
  eventId:`e-${action}`, signature:'sig', positionAddress:'position', poolAddress:'pool', action,
  observedAt:'2026-09-03T12:00:00.000Z', evidenceIds:['evidence'], confidence:1, semantic:'EXPLICIT' as const, ...extra,
})

describe('applyDlmmPositionTransition',()=>{
  it('creates an empty position and then funds it',()=>{
    const opened=applyDlmmPositionTransition(undefined,base('OPEN',{fromBinId:1,toBinId:10}))
    expect(opened.rejected).toBeUndefined()
    const funded=applyDlmmPositionTransition(opened.state,base('ADD',{tokenXDeltas:100n,tokenYDeltas:50n}))
    expect(funded.state?.lifecycle).toBe('ACTIVE')
    expect(funded.state?.tokenXRaw).toBe(100n)
    expect(funded.state?.tokenYRaw).toBe(50n)
  })

  it('applies rebalance withdrawal/addition without emitting a withdrawal',()=>{
    const current: DlmmPositionState={positionAddress:'position',poolAddress:'pool',lifecycle:'ACTIVE',liquidityState:'FUNDED',tokenXRaw:100n,tokenYRaw:50n,lowerBinId:1,upperBinId:10,lastObservedAt:'2026-09-03T11:59:00.000Z',evidenceIds:['old']}
    const result=applyDlmmPositionTransition(current,base('REBALANCE',{fromBinId:20,toBinId:30,activeBinId:25,tokenXWithdrawnRaw:40n,tokenXAddedRaw:10n,tokenYWithdrawnRaw:20n,tokenYAddedRaw:30n}))
    expect(result.withdrawal).toBeUndefined()
    expect(result.state?.tokenXRaw).toBe(70n)
    expect(result.state?.tokenYRaw).toBe(60n)
    expect(result.state?.lowerBinId).toBe(20)
    expect(result.state?.upperBinId).toBe(30)
  })

  it('rejects a close while principal remains',()=>{
    const current: DlmmPositionState={positionAddress:'position',poolAddress:'pool',lifecycle:'ACTIVE',liquidityState:'FUNDED',tokenXRaw:1n,tokenYRaw:0n,lastObservedAt:'2026-09-03T11:59:00.000Z',evidenceIds:['old']}
    expect(applyDlmmPositionTransition(current,base('CLOSE')).rejected).toBe('CLOSE_WITH_LIQUIDITY')
  })
})

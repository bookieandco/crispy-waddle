import {describe,expect,it} from 'vitest'
import {
  PUMP_EVENT_DISCRIMINATORS,
  PumpDecodedEventLifecycleTracker,
  type PumpDecodedStreamEvent,
} from '../pump-decoded-event-stream'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const base=(overrides:Partial<PumpDecodedStreamEvent>):PumpDecodedStreamEvent=>({
  eventId:'event:1',
  programId:PUMP_PROGRAM_ID,
  eventName:'CreateEvent',
  signature:'sig:1',
  slot:100,
  observedAt:'2026-10-03T05:00:00Z',
  availableAt:'2026-10-03T05:00:00.250Z',
  source:'helius-parsed-stream',
  data:{},
  ...overrides,
})

describe('decoded Pump event lifecycle stream',()=>{
  it('turns CreateEvent into a Pump-qualified launch and exact initial curve baseline',async()=>{
    const tracker=new PumpDecodedEventLifecycleTracker()
    const result=await tracker.ingest(base({
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CreateEvent,
      data:{
        mint,
        bonding_curve:'CURVE',
        user:'USER',
        creator:'CREATOR',
        real_token_reserves:'1000',
        quote_mint:'QUOTE',
        is_mayhem_mode:false,
        is_cashback_enabled:false,
        is_holder_reward:false,
      },
    }))
    expect(result.launchObservation?.launchpad).toBe('pump.fun')
    expect(result.launchObservation?.tokenAddress).toBe(mint)
    expect(result.observation.initialRealTokenReserves).toBe(1000n)
    expect(result.observation.realTokenReserves).toBe(1000n)
    expect(result.radar.stage).toBe('DISCOVERED')
    expect(result.canAuthorizeTrade).toBe(false)
  })

  it('tracks reserve progress across TradeEvent and reaches approaching graduation',async()=>{
    const tracker=new PumpDecodedEventLifecycleTracker()
    await tracker.ingest(base({
      data:{mint,bonding_curve:'CURVE',real_token_reserves:'1000'},
    }))
    const result=await tracker.ingest(base({
      eventId:'event:2',
      eventName:'TradeEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.TradeEvent,
      signature:'sig:2',
      slot:101,
      observedAt:'2026-10-03T05:00:01Z',
      availableAt:'2026-10-03T05:00:01.100Z',
      data:{mint,real_token_reserves:'50',is_buy:true},
    }))
    expect(result.observation.initialRealTokenReserves).toBe(1000n)
    expect(result.observation.realTokenReserves).toBe(50n)
    expect(result.radar.graduationProgress).toBe(.95)
    expect(result.radar.stage).toBe('APPROACHING_GRADUATION')
  })

  it('uses explicit CompleteEvent as curve completion evidence',async()=>{
    const tracker=new PumpDecodedEventLifecycleTracker()
    const result=await tracker.ingest(base({
      eventName:'CompleteEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CompleteEvent,
      data:{mint,bonding_curve:'CURVE',quote_mint:'QUOTE'},
    }))
    expect(result.observation.complete).toBe(true)
    expect(result.radar.stage).toBe('CURVE_COMPLETE')
  })

  it('keeps migration pool events unverified until the canonical migration verifier binds the pool',async()=>{
    const tracker=new PumpDecodedEventLifecycleTracker()
    const result=await tracker.ingest(base({
      eventName:'CompletePumpAmmMigrationEvent',
      eventDiscriminator:PUMP_EVENT_DISCRIMINATORS.CompletePumpAmmMigrationEvent,
      data:{mint,bonding_curve:'CURVE',pool:'POOL',quote_mint:'QUOTE'},
    }))
    expect(result.migrationPoolHint).toBe('POOL')
    expect(result.migrationPoolVerified).toBe(false)
    expect(result.observation.pumpSwapPoolVerified).toBe(false)
    expect(result.radar.stage).toBe('CURVE_COMPLETE')
    expect(result.radar.missingChecks).toContain('pumpswap-pool-verification')
  })

  it('rejects another program or a mismatched provider discriminator',async()=>{
    const tracker=new PumpDecodedEventLifecycleTracker()
    await expect(tracker.ingest(base({programId:'OTHER',data:{mint,real_token_reserves:'1'}})))
      .rejects.toThrow('program_invalid')
    await expect(tracker.ingest(base({
      eventDiscriminator:[0,0,0,0,0,0,0,0],
      data:{mint,real_token_reserves:'1'},
    }))).rejects.toThrow('discriminator_invalid')
  })
})

import {describe,expect,it} from 'vitest'
import {decodeBase58} from '../solana-pda'
import {
  buildPumpLogsSubscribeRequest,
  decodePumpAnchorEventLog,
  decodePumpLogsNotification,
} from '../pump-anchor-log-decoder'
import {PUMP_EVENT_DISCRIMINATORS} from '../pump-decoded-event-stream'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const user='11111111111111111111111111111111'
const parts=(...values:Uint8Array[])=>{
  const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let offset=0
  for(const value of values){out.set(value,offset);offset+=value.length}
  return out
}
const u32=(value:number)=>Uint8Array.of(value&255,(value>>8)&255,(value>>16)&255,(value>>24)&255)
const u64=(value:bigint)=>{
  const out=new Uint8Array(8);let n=value
  for(let i=0;i<8;i++){out[i]=Number(n&255n);n>>=8n}
  return out
}
const str=(value:string)=>{const bytes=new TextEncoder().encode(value);return parts(u32(bytes.length),bytes)}
const key=(value:string)=>decodeBase58(value)
const b64=(value:Uint8Array)=>btoa(String.fromCharCode(...value))
const log=(disc:readonly number[],payload:Uint8Array)=>'Program data: '+b64(parts(Uint8Array.from(disc),payload))
const meta={signature:'sig1',slot:123,eventIndex:0,receivedAt:'2026-10-03T05:00:01Z'}

describe('Pump Anchor log decoder',()=>{
  it('decodes CreateEvent baseline fields and later Pump v2 flags',()=>{
    const payload=parts(
      str('Name'),str('SYM'),str('https://example.test'),
      key(mint),key(PUMP_PROGRAM_ID),key(user),key(user),
      u64(1791003600n),u64(2000n),u64(3000n),u64(1000n),u64(1_000_000n),
      key(PUMP_PROGRAM_ID),Uint8Array.of(1),Uint8Array.of(0),new Uint8Array(32),u64(4000n),u64(25n),Uint8Array.of(1),
    )
    const event=decodePumpAnchorEventLog(log(PUMP_EVENT_DISCRIMINATORS.CreateEvent,payload),meta)!
    expect(event.eventName).toBe('CreateEvent')
    expect(event.data.mint).toBe(mint)
    expect(event.data.bonding_curve).toBe(PUMP_PROGRAM_ID)
    expect(event.data.real_token_reserves).toBe('1000')
    expect(event.data.is_mayhem_mode).toBe(true)
    expect(event.data.quote_mint).toBeUndefined()
    expect(event.data.creator_fee_bps).toBe('25')
    expect(event.data.is_holder_reward).toBe(true)
    expect(event.observedAt).toBe('2026-10-03T05:00:00.000Z')
  })

  it('decodes the fixed TradeEvent prefix needed by graduation tracking',()=>{
    const payload=parts(
      key(mint),u64(100n),u64(200n),Uint8Array.of(1),key(user),u64(1791003600n),
      u64(300n),u64(400n),u64(500n),u64(50n),
    )
    const event=decodePumpAnchorEventLog(log(PUMP_EVENT_DISCRIMINATORS.TradeEvent,payload),meta)!
    expect(event.eventName).toBe('TradeEvent')
    expect(event.data.is_buy).toBe(true)
    expect(event.data.real_token_reserves).toBe('50')
  })

  it('decodes completion and migration pool evidence without verifying the pool',()=>{
    const complete=decodePumpAnchorEventLog(log(PUMP_EVENT_DISCRIMINATORS.CompleteEvent,parts(
      key(user),key(mint),key(PUMP_PROGRAM_ID),u64(1791003600n),new Uint8Array(32),
    )),meta)!
    expect(complete.data.bonding_curve).toBe(PUMP_PROGRAM_ID)

    const migration=decodePumpAnchorEventLog(log(PUMP_EVENT_DISCRIMINATORS.CompletePumpAmmMigrationEvent,parts(
      key(user),key(mint),u64(100n),u64(200n),u64(3n),key(PUMP_PROGRAM_ID),u64(1791003600n),key(user),new Uint8Array(32),
    )),{...meta,eventIndex:1})!
    expect(migration.eventName).toBe('CompletePumpAmmMigrationEvent')
    expect(migration.data.pool).toBe(user)
  })

  it('ignores unrelated log lines and unknown Pump events',()=>{
    expect(decodePumpAnchorEventLog('Program log: hello',meta)).toBeNull()
    expect(decodePumpAnchorEventLog(log([1,2,3,4,5,6,7,8],new Uint8Array()),meta)).toBeNull()
  })

  it('builds a confirmed standard Solana logs subscription for the Pump program',()=>{
    expect(buildPumpLogsSubscribeRequest()).toEqual({
      jsonrpc:'2.0',id:1,method:'logsSubscribe',
      params:[{mentions:[PUMP_PROGRAM_ID]},{commitment:'confirmed'}],
    })
  })

  it('decodes only Program data emitted while Pump is the active invocation',()=>{
    const tradePayload=parts(
      key(mint),u64(100n),u64(200n),Uint8Array.of(1),key(user),u64(1791003600n),
      u64(300n),u64(400n),u64(500n),u64(50n),
    )
    const pumpLog=log(PUMP_EVENT_DISCRIMINATORS.TradeEvent,tradePayload)
    const result=decodePumpLogsNotification({
      method:'logsNotification',
      params:{result:{context:{slot:123},value:{
        signature:'sig-stack',err:null,
        logs:[
          `Program ${PUMP_PROGRAM_ID} invoke [1]`,
          `Program ${user} invoke [2]`,
          pumpLog,
          `Program ${user} success`,
          pumpLog,
          `Program ${PUMP_PROGRAM_ID} success`,
        ],
      }}},
    },'2026-10-03T05:00:01Z')
    expect(result).toHaveLength(1)
    expect(result[0]?.eventName).toBe('TradeEvent')
    expect(result[0]?.signature).toBe('sig-stack')
  })

  it('ignores failed transaction notifications before event admission',()=>{
    const result=decodePumpLogsNotification({
      method:'logsNotification',
      params:{result:{context:{slot:123},value:{signature:'sig-failed',err:{InstructionError:[0,'Custom']},logs:[]}}},
    },'2026-10-03T05:00:01Z')
    expect(result).toEqual([])
  })

})

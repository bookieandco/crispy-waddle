import {describe,expect,it,vi} from 'vitest'
import {
  PUMP_BONDING_CURVE_DISCRIMINATOR,
  PumpBondingCurveRpcSource,
  derivePumpBondingCurveAddress,
  parsePumpBondingCurveAccount,
} from '../pump-bonding-curve-rpc'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'

const putU64=(data:Uint8Array,offset:number,value:bigint)=>{
  let n=value
  for(let i=0;i<8;i++){data[offset+i]=Number(n&255n);n>>=8n}
}
const fixture=()=>{
  const data=new Uint8Array(125)
  PUMP_BONDING_CURVE_DISCRIMINATOR.forEach((v,i)=>data[i]=v)
  putU64(data,8,1000n)
  putU64(data,16,2000n)
  putU64(data,24,100n)
  putU64(data,32,300n)
  putU64(data,40,1_000_000n)
  data[48]=0
  data[81]=1
  for(let i=83;i<115;i++)data[i]=1
  return data
}
const base64=(data:Uint8Array)=>btoa(String.fromCharCode(...data))

describe('Pump bonding curve RPC source',()=>{
  it('derives the official bonding-curve PDA bump from mint without a Solana SDK dependency',async()=>{
    const derived=await derivePumpBondingCurveAddress('3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump')
    expect(derived.bump).toBe(251)
    expect(derived.address.length).toBeGreaterThan(30)
  })

  it('parses current Pump bonding-curve account layout and later fields',()=>{
    const state=parsePumpBondingCurveAccount({data:fixture(),owner:PUMP_PROGRAM_ID})
    expect(state.realTokenReserves).toBe(100n)
    expect(state.virtualQuoteReserves).toBe(2000n)
    expect(state.complete).toBe(false)
    expect(state.mayhemMode).toBe(true)
    expect(state.quoteMint).toBeTruthy()
  })

  it('accepts legacy-short accounts and leaves appended fields unknown',()=>{
    const data=fixture().slice(0,81)
    const state=parsePumpBondingCurveAccount({data,owner:PUMP_PROGRAM_ID})
    expect(state.realTokenReserves).toBe(100n)
    expect(state.mayhemMode).toBeUndefined()
    expect(state.quoteMint).toBeUndefined()
  })

  it('reads a curve through Solana getAccountInfo without inferring migration',async()=>{
    const fetchImpl=vi.fn(async(_url:any,init:any)=>{
      const request=JSON.parse(String(init.body))
      expect(request.method).toBe('getAccountInfo')
      expect(request.params[0]).toBe('CURVE')
      return new Response(JSON.stringify({
        jsonrpc:'2.0',id:1,result:{context:{slot:123},value:{owner:PUMP_PROGRAM_ID,data:[base64(fixture()),'base64']}},
      }),{status:200,headers:{'content-type':'application/json'}})
    })
    const source=new PumpBondingCurveRpcSource({
      rpcUrl:'https://rpc.example.test',
      fetchImpl:fetchImpl as any,
      now:()=> '2026-10-03T04:30:00Z',
    })
    const observation=await source.observe({
      mint:'MINT',
      bondingCurveAddress:'CURVE',
      initialRealTokenReserves:1000n,
      evidenceIds:['launch:e1'],
    })
    expect(observation.realTokenReserves).toBe(100n)
    expect(observation.initialRealTokenReserves).toBe(1000n)
    expect(observation.complete).toBe(false)
    expect(observation.pumpSwapPoolAddress).toBeUndefined()
    expect(observation.evidenceIds).toContain('solana-slot:123')
  })

  it('rejects non-Pump ownership and malformed discriminators',()=>{
    expect(()=>parsePumpBondingCurveAccount({data:fixture(),owner:'OTHER'})).toThrow('owner_invalid')
    const data=fixture();data[0]=0
    expect(()=>parsePumpBondingCurveAccount({data,owner:PUMP_PROGRAM_ID})).toThrow('discriminator_invalid')
  })
})

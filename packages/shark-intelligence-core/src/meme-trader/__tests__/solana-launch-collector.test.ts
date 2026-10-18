import {describe,expect,it} from 'vitest'
import {collectHeliusLaunch} from '../solana-launch-collector'
import {decodeBase58} from '../solana-pda'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'
import {PUMP_EVENT_DISCRIMINATORS} from '../pump-decoded-event-stream'
import {derivePumpBondingCurveAddress} from '../pump-bonding-curve-rpc'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const owner='11111111111111111111111111111111'
const signature='2'.repeat(64)
const seconds=1791003600
const receivedAt='2026-10-03T05:00:02Z'
const parts=(...xs:Uint8Array[])=>{
  const result=new Uint8Array(xs.reduce((sum,x)=>sum+x.length,0))
  let pos=0;for(const x of xs){result.set(x,pos);pos+=x.length}return result
}
const u32=(n:number)=>Uint8Array.of(n&255,(n>>8)&255,(n>>16)&255,(n>>24)&255)
const u64=(value:bigint)=>{
  const bytes=new Uint8Array(8);let n=value
  for(let i=0;i<8;i++){bytes[i]=Number(n&255n);n>>=8n}
  return bytes
}
const str=(s:string)=>parts(u32(s.length),new TextEncoder().encode(s))
const key=(s:string)=>decodeBase58(s)
const b64=(data:Uint8Array)=>btoa(String.fromCharCode(...data))
async function launchEvent(curveOverride?:string){
  const curve=curveOverride??(await derivePumpBondingCurveAddress(mint)).address
  const payload=parts(
    str('Name'),str('SYM'),str('https://example.test'),
    key(mint),key(curve),key(owner),key(owner),
    u64(BigInt(seconds)),u64(2000n),u64(3000n),u64(1000n),u64(1000000n),
  )
  const data='Program data: '+b64(parts(Uint8Array.from(PUMP_EVENT_DISCRIMINATORS.CreateEvent),payload))
  return {
    type:'TOKEN_MINT',timestamp:seconds,slot:123,signature,
    events:{token:{mint}},
    programLogs:[
      'Program '+PUMP_PROGRAM_ID+' invoke [1]',
      data,
      'Program '+PUMP_PROGRAM_ID+' success',
    ],
  }
}
describe('Solana Helius Pump-qualified launch collector',()=>{
  it('admits only decoded Pump CreateEvent with valid canonical curve and actual receipt clock',async()=>{
    const item=await collectHeliusLaunch(await launchEvent(),{},receivedAt)
    expect(item?.observation.tokenAddress).toBe(mint)
    expect(item?.observation.launchpad).toBe('pump.fun')
    expect(item?.provenance.occurredAt).toBe('2026-10-03T05:00:00.000Z')
    expect(item?.provenance.availableAt).toBe(receivedAt)
    expect(item?.provenance.providerAttestation).toBe('UNVERIFIED')
    expect(item?.provenance.canAuthorizeTrade).toBe(false)
    expect(item?.ingested.launch.outcome).toBe('UNKNOWN')
    expect(item?.ingested.graph.edges.some(edge=>edge.relation==='deployed')).toBe(true)
  })
  it('rejects transfer-only, missing logs, and arbitrary TOKEN_MINT labels',async()=>{
    expect(await collectHeliusLaunch({
      type:'TOKEN_MINT',timestamp:seconds,slot:123,signature,
      tokenTransfers:[{mint,tokenAmount:1000000}],
    },{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({
      type:'TOKEN_MINT',timestamp:seconds,slot:123,signature,
      events:{token:{mint}},programLogs:['Program log: random'],
    },{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({signature}, {},receivedAt)).toBeNull()
  })
  it('ignores a Pump-looking log emitted inside the wrong program or a failed transaction',async()=>{
    const event=await launchEvent()
    expect(await collectHeliusLaunch({
      ...event,programLogs:['Program '+owner+' invoke [1]',event.programLogs[1]!, 'Program '+owner+' success'],
    },{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({...event,transactionError:{InstructionError:[0,'Custom']}},{},receivedAt)).toBeNull()
  })
  it('rejects a forged bonding curve, mismatched mint, or future provider time',async()=>{
    await expect(collectHeliusLaunch(await launchEvent(owner),{},receivedAt)).rejects.toThrow('curve_binding_invalid')
    const event=await launchEvent()
    expect(await collectHeliusLaunch({...event,events:{token:{mint:owner}}},{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({...event,timestamp:seconds+3600},{},receivedAt)).toBeNull()
  })
  it('rejects missing signature/slot/time and cannot fabricate liquidity',async()=>{
    const event=await launchEvent()
    expect(await collectHeliusLaunch({...event,signature:''},{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({...event,slot:undefined},{},receivedAt)).toBeNull()
    expect(await collectHeliusLaunch({...event,timestamp:undefined},{},receivedAt)).toBeNull()
    const item=await collectHeliusLaunch(event,{},receivedAt)
    expect(item?.observation.initialLiquidityUsd).toBeUndefined()
    expect(item?.provenance.canAutoCopy).toBe(false)
  })
})

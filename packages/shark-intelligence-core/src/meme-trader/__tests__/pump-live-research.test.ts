import {describe,expect,it,vi} from 'vitest'
import {decodeBase58} from '../solana-pda'
import {PUMP_EVENT_DISCRIMINATORS} from '../pump-decoded-event-stream'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'
import {derivePumpBondingCurveAddress} from '../pump-bonding-curve-rpc'
import {PumpLiveResearchEngine} from '../pump-live-research'

const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const wallet='11111111111111111111111111111111'
const at='2026-10-17T18:00:00Z'
const epoch=BigInt(Date.parse(at)/1000)
const parts=(...arr:Uint8Array[])=>{
 const out=new Uint8Array(arr.reduce((n,x)=>n+x.length,0));let offset=0
 for(const x of arr){out.set(x,offset);offset+=x.length}return out
}
const u32=(v:number)=>Uint8Array.of(v&255,(v>>8)&255,(v>>16)&255,(v>>24)&255)
const u64=(v:bigint)=>{const b=new Uint8Array(8);for(let i=0;i<8;i++){b[i]=Number(v&255n);v>>=8n}return b}
const str=(s:string)=>{const b=new TextEncoder().encode(s);return parts(u32(b.length),b)}
const key=(s:string)=>decodeBase58(s)
const log=(disc:readonly number[],bytes:Uint8Array)=>'Program data: '+btoa(String.fromCharCode(...parts(Uint8Array.from(disc),bytes)))
async function notification(kind:'create'|'trade',remaining=50n){
 const curve=(await derivePumpBondingCurveAddress(mint)).address
 const data=kind==='create'?parts(
   str('test'),str('TST'),str('uri'),key(mint),key(curve),key(wallet),key(wallet),
   u64(epoch),u64(1000n),u64(1000n),u64(1000n),u64(1_000_000n),
 ):parts(key(mint),u64(10n),u64(10n),Uint8Array.of(1),key(wallet),
   u64(epoch+1n),u64(1200n),u64(800n),u64(500n),u64(remaining))
 return {method:'logsNotification',params:{result:{context:{slot:kind==='create'?100:101},value:{
   signature:(kind==='create'?'2':'3').repeat(64),err:null,
   logs:['Program '+PUMP_PROGRAM_ID+' invoke [1]',
     log(kind==='create'?PUMP_EVENT_DISCRIMINATORS.CreateEvent:PUMP_EVENT_DISCRIMINATORS.TradeEvent,data),
     'Program '+PUMP_PROGRAM_ID+' success'],
 }}}}
}
describe('live Pump research fusion and owner notification',()=>{
 it('tracks an authentic curve baseline then flags fresh 95% graduation with bounded risk and indicative quotes',async()=>{
  let now='2026-10-17T18:00:00.200Z'
  const messages:string[]=[]
  const engine=new PumpLiveResearchEngine({
    now:()=>now,notificationsEnabled:true,ownerAuthenticated:true,
    onOwnerMessage:async(text)=>{messages.push(text)},
    riskResearch:async(mintId,stamp)=>({
      mint:mintId,availableAt:stamp,evidenceIds:['watchkeeper-risk'],
      rugBlocked:false,creatorRiskScore:.1,clusterRiskScore:.1,sniperInventoryRisk:.1,
      holderCount:500,uniqueBuyerCount:350,volumeAccelerationScore:1,buyPressureScore:1,holderGrowthScore:1,
    }),
    quoteResearch:async(mintId,stamp)=>({
      mint:mintId,observedAt:stamp,receivedAt:stamp,
      receiptId:'watchkeeper-quote',source:'WATCHKEEPER_INDICATIVE_PAIR',hasForwardAndReverseQuotes:true,
    }),
  })
  const first=await engine.acceptNotification(await notification('create'),'2026-10-17T18:00:00.100Z')
  expect(first).toHaveLength(1)
  expect(first[0]?.alert).toBeUndefined()
  now='2026-10-17T18:00:01.200Z'
  const second=await engine.acceptNotification(await notification('trade'),'2026-10-17T18:00:01.100Z')
  expect(second[0]?.alert?.kind).toBe('NEAR_CURVE')
  expect(second[0]?.alert?.progressPercent).toBe(95)
  expect(second[0]?.alert?.paperFeasibility).toBe('PAPER_REVIEW_ONLY')
  expect(second[0]?.safety).toBe('RESEARCH_WATCH')
  expect(second[0]?.providerFinality).toBe('UNVERIFIED')
  expect(second[0]?.canTrade).toBe(false)
  expect(messages).toHaveLength(1)
  expect(messages[0]).toContain('No automatic snipe')
  const duplicate=await engine.acceptNotification(await notification('trade'),'2026-10-17T18:00:01.100Z')
  expect(duplicate).toHaveLength(0)
  expect(engine.counters().duplicate).toBe(1)
 })
 it('refuses to invent a missing CreateEvent, or backdate replayed events into new owner calls',async()=>{
  const send=vi.fn(async()=>{})
  const engine=new PumpLiveResearchEngine({now:()=> '2026-10-17T18:00:02Z',notificationsEnabled:true,ownerAuthenticated:true,onOwnerMessage:send})
  expect(await engine.acceptNotification(await notification('trade'),'2026-10-17T18:00:01.100Z')).toEqual([])
  expect(engine.counters().missingBaseline).toBe(1)
  await engine.acceptNotification(await notification('create'),'2026-10-17T18:00:00.100Z','RETROSPECTIVE')
  await engine.acceptNotification(await notification('trade'),'2026-10-17T18:00:01.100Z','RETROSPECTIVE')
  expect(send).not.toHaveBeenCalled()
  expect(engine.counters().accepted).toBe(2)
 })
 it('flags risk blocks and degrades missing WATCHKEEPER evidence to review-only',async()=>{
  const message=vi.fn(async()=>{})
  const engine=new PumpLiveResearchEngine({
    now:()=> '2026-10-17T18:00:02Z',notificationsEnabled:false,ownerAuthenticated:true,
    onOwnerMessage:message,
    riskResearch:async(m,stamp)=>({mint:m,availableAt:stamp,evidenceIds:['rug-warning'],rugBlocked:true}),
  })
  await engine.acceptNotification(await notification('create'),'2026-10-17T18:00:00.100Z')
  const decisions=await engine.acceptNotification(await notification('trade'),'2026-10-17T18:00:01.100Z')
  expect(decisions[0]?.alert?.kind).toBe('RISK_BLOCKED')
  expect(decisions[0]?.safety).toBe('RISK_BLOCKED')
  expect(decisions[0]?.alert?.paperFeasibility).toBe('BLOCKED')
  expect(message).not.toHaveBeenCalled()
 })
 it('quarantines invalid or delayed evidence without promoting retrospective opportunities',async()=>{
  const engine=new PumpLiveResearchEngine({
    now:()=> '2026-10-17T18:10:00Z',notificationsEnabled:true,ownerAuthenticated:true,
    onOwnerMessage:vi.fn(async()=>{}),
  })
  const results=await engine.acceptNotification(await notification('create'),'2026-10-17T18:10:00Z')
  expect(results).toHaveLength(1)
  expect(results[0]?.alert).toBeUndefined()
  const late=await engine.acceptNotification(await notification('trade'),'2026-10-17T18:10:01Z')
  expect(late[0]?.alert).toBeUndefined()
 })
})

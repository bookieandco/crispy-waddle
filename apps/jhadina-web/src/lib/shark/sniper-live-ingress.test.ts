import {describe,expect,it} from 'vitest'
import {SniperFastpathDiscoveryIntake} from '@jhadina/shark-intelligence-core/meme-trader'
import {persistSniperHeliusBatch} from './sniper-live-ingress'

const ev=(signature:string)=>({
 type:'TOKEN_MINT',signature,slot:101,timestamp:1788307200,
 events:{token:{mint:'3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'}},
})
const receivedAt='2026-09-02T00:00:00.600Z'

describe('authorized Helius sniper ingress composition',()=>{
 it('persists supported mint only, counts duplicate and does not authorize trading',async()=>{
  const persisted:string[]=[]
  let t=0
  const receipt=await persistSniperHeliusBatch({
   events:[ev('sig:1'),ev('sig:1'),{signature:'transfer',slot:101,timestamp:1788307200,tokenTransfers:[{mint:'OTHER'}]}],
   receivedAt,intake:new SniperFastpathDiscoveryIntake(),clock:()=>++t,
   persist:async collection=>{
    persisted.push(collection.observation.tokenAddress)
    return {launchId:collection.ingested.launch.launchId,persistedEdges:0}
   },
  })
  expect(receipt.received).toBe(3)
  expect(receipt.accepted).toBe(1)
  expect(receipt.duplicates).toBe(1)
  expect(receipt.ignored).toBe(1)
  expect(receipt.persisted).toBe(1)
  expect(receipt.launches[0].localProcessingMs).toBeGreaterThan(0)
  expect(receipt.launches[0].verification).toBe('PROVISIONAL_UNVERIFIED')
  expect(receipt.canExecute).toBe(false)
  expect(persisted).toHaveLength(1)
 })
 it('awaits durable writes and permits a provider retry after a failed persist',async()=>{
  const intake=new SniperFastpathDiscoveryIntake()
  let attempts=0
  const args={events:[ev('sig:unique')],receivedAt,intake,clock:()=>2}
  await expect(persistSniperHeliusBatch({
   ...args,persist:async()=>{attempts++;throw new Error('database unavailable')},
  })).rejects.toThrow('database unavailable')
  const retried=await persistSniperHeliusBatch({
   ...args,persist:async collection=>{
    attempts++
    return {launchId:collection.ingested.launch.launchId,persistedEdges:0}
   },
  })
  expect(retried.persisted).toBe(1)
  expect(retried.duplicates).toBe(0)
  expect(attempts).toBe(2)
 })
 it('rejects missing chain event identity and oversized batches',async()=>{
  const receipt=await persistSniperHeliusBatch({
   events:[{type:'TOKEN_MINT',slot:12,timestamp:1788307200,events:{token:{mint:'M'}}}],
   receivedAt,intake:new SniperFastpathDiscoveryIntake(),clock:()=>5,
   persist:async()=>({launchId:'nope',persistedEdges:0}),
  })
  expect(receipt.accepted).toBe(0)
  await expect(persistSniperHeliusBatch({
   events:Array(501).fill(null),receivedAt,intake:new SniperFastpathDiscoveryIntake(),clock:()=>5,
   persist:async()=>({launchId:'nope',persistedEdges:0}),
  })).rejects.toThrow('SNIPER_INGRESS_BOUNDS_INVALID')
 })
})

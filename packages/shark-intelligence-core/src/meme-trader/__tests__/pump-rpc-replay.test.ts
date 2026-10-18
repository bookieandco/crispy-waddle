import {describe,expect,it,vi} from 'vitest'
import {readPumpRpcReplay,createReadOnlyPumpRpcSender} from '../pump-rpc-replay'
import {PUMP_PROGRAM_ID} from '../pump-migration-verifier'

const a='2'.repeat(64),b='3'.repeat(64)
describe('bounded Solana Pump retrospective replay',()=>{
 it('fetches bounded signatures, matches transaction identity and does not claim complete gap recovery',async()=>{
  const methods:string[]=[]
  const request=vi.fn(async(q:{method:string;params:readonly unknown[]})=>{
    methods.push(q.method)
    if(q.method==='getSignaturesForAddress') {
      expect(q.params[0]).toBe(PUMP_PROGRAM_ID)
      return {result:[{signature:b,slot:101,err:null},{signature:a,slot:100,err:null}]}
    }
    return {result:{slot:(q.params[0]===a?100:101),meta:{err:null,logMessages:[
      'Program '+PUMP_PROGRAM_ID+' invoke [1]',
      'Program '+PUMP_PROGRAM_ID+' success',
    ]}}}
  })
  const result=await readPumpRpcReplay({request,afterSlot:100,receivedAt:'2026-10-17T18:00:00Z',limit:2})
  expect(result.requested).toBe(2)
  expect(result.recovered).toBe(2)
  expect(result.notifications[0]?.params?.result?.value?.signature).toBe(a)
  expect(result.gapStatus).toBe('PARTIAL_UNVERIFIED')
  expect(result.retrospectiveOnly).toBe(true)
  expect(result.canAlertAsEarly).toBe(false)
  expect(result.canAuthorizeTrade).toBe(false)
  expect(methods).toEqual(['getSignaturesForAddress','getTransaction','getTransaction'])
 })
 it('marks a provider null transaction missing, never an early signal or fabricated transaction',async()=>{
  const request=async(q:{method:string})=>q.method==='getSignaturesForAddress'
    ?{result:[{signature:a,slot:100,err:null}]}:{result:null}
  const result=await readPumpRpcReplay({request,receivedAt:'2026-10-17T18:00:00Z'})
  expect(result.notifications).toHaveLength(0)
  expect(result.missing).toBe(1)
  expect(result.gapStatus).toBe('PARTIAL_UNVERIFIED')
 })
 it('rejects unauthenticated identities, unexpected oversized batches, bad replay times and insecure RPC',async()=>{
  const request=async()=>({result:[{signature:'fake',slot:2,err:null}]})
  await expect(readPumpRpcReplay({request,receivedAt:'2026-10-17T18:00:00Z'})).rejects.toThrow('identity_invalid')
  await expect(readPumpRpcReplay({request,receivedAt:'yesterday'})).rejects.toThrow('clock_invalid')
  await expect(readPumpRpcReplay({request,receivedAt:'2026-10-17T18:00:00Z',limit:65})).rejects.toThrow('limit_invalid')
  expect(()=>createReadOnlyPumpRpcSender('http://publicnode.test')).toThrow('url_invalid')
  expect(()=>createReadOnlyPumpRpcSender('https://user:password@publicnode.test')).toThrow('url_invalid')
 })
})

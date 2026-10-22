import {describe,expect,it} from 'vitest'
import {SniperFastpathDiscoveryIntake} from '../sniper-fastpath-discovery'

const event={type:'TOKEN_MINT',signature:'sig-1',slot:123,timestamp:1788307200,events:{token:{mint:'MINT111'}}}
const clock={receivedAt:'2026-09-02T00:00:00.600Z',startedMonotonicMs:100,finishedMonotonicMs:103}
describe('SHARK sniper event-first intake',()=>{
 it('records a distinct 600ms provider-to-receipt interval, not a fill claim',()=>{
  const intake=new SniperFastpathDiscoveryIntake()
  const result=intake.ingest(event,clock)
  expect(result.disposition).toBe('OBSERVED')
  expect(result.receipt?.discoveryDelayMs).toBe(600)
  expect(result.receipt?.elapsedProcessingMs).toBe(3)
  expect(result.receipt?.verification).toBe('PROVISIONAL_UNVERIFIED')
  expect(result.canTrade).toBe(false)
  expect(intake.ingest(event,clock).disposition).toBe('DUPLICATE')
 })
 it('refuses mint-only tips and untrusted/future event timestamps',()=>{
  const intake=new SniperFastpathDiscoveryIntake()
  expect(intake.ingest({events:{token:{mint:'TOKEN'}}},clock).disposition).toBe('INVALID')
  expect(intake.ingest({...event,timestamp:1788307300},clock).reasonCodes).toContain('PROVIDER_TIMESTAMP_IN_FUTURE')
 })
 it('respects bounded deduplication capacity and TTL without assuming an executable order',()=>{
  const intake=new SniperFastpathDiscoveryIntake({maxKeys:1,dedupeTtlMs:1000})
  expect(intake.ingest(event,clock).disposition).toBe('OBSERVED')
  expect(intake.ingest({...event,signature:'sig-2'},clock).disposition).toBe('DROPPED_CAPACITY')
  expect(intake.ingest({...event,signature:'sig-2'},{...clock,receivedAt:'2026-09-02T00:00:01.601Z'}).disposition).toBe('OBSERVED')
 })
})

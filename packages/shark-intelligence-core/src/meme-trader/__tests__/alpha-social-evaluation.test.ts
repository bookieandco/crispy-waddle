import {describe,expect,it} from 'vitest'
import {createAlphaEvidenceV2} from '../alpha-evidence-v2'
import {ingestExternalSignal} from '../external-signal-ingest'
import {compareAlphaSocialWithPumpCreate,summarizeAlphaSourceHealth} from '../alpha-social-evaluation'
const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const launch={mint,eventId:'pump-log:1',signature:'sig-1',observedAt:'2026-10-17T19:00:00Z',
  availableAt:'2026-10-17T19:00:05Z',evidenceIds:['chain-log'],eventKind:'PUMP_CREATE_EVENT' as const,mode:'LIVE' as const}
function mention(id:string,platform:'X'|'REDDIT'|'BLUESKY',handle:string,receivedAt:string,origin?:string){
 const published='2026-10-17T18:59:00Z'
 const provenance=createAlphaEvidenceV2({sourceEventId:id,sourceFamily:'SOCIAL',sourceHandle:handle,
   originalEventId:origin,occurredAt:published,publishedAt:published,
   receivedAt,availableAt:receivedAt,evidenceIds:[id]})
 return {...ingestExternalSignal({observationId:id,platform,sourceHandle:handle,
   text:'See mint '+mint,observedAt:published,availableAt:receivedAt}),provenance}
}
describe('SHARK cross-source point-in-time comparison',()=>{
 it('counts independent observations and availability lead without claiming alpha returns',()=>{
  const a=mention('bsky:1','BLUESKY','person-a','2026-10-17T19:00:02Z')
  const b=mention('x:1','X','person-b','2026-10-17T19:00:04Z','crosspost:1')
  const c=mention('reddit:1','REDDIT','person-c','2026-10-17T19:00:04Z','crosspost:1')
  const joined=compareAlphaSocialWithPumpCreate({chain:launch,signals:[c,b,a],asOf:'2026-10-17T19:00:05Z'})
  expect(joined.matchCount).toBe(3)
  expect(joined.independentOriginCount).toBe(2)
  expect(joined.timing).toBe('SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT')
  expect(joined.firstAvailabilityLeadMs).toBe(3000)
  expect(joined.canAuthorizeTrade).toBe(false)
  expect(joined.canAutoCopy).toBe(false)
 })
 it('does not backdate a late-forwarded mention based on an earlier publication timestamp',()=>{
  const late=mention('x:late','X','late-source','2026-10-17T19:00:11Z')
  const joined=compareAlphaSocialWithPumpCreate({chain:launch,signals:[late],asOf:'2026-10-17T19:00:12Z'})
  expect(joined.timing).toBe('CHAIN_RECEIPT_FIRST')
  expect(joined.firstAvailabilityLeadMs).toBe(-6000)
 })
 it('excludes future unavailable evidence and wrong mints',()=>{
  const other=ingestExternalSignal({observationId:'wrong',platform:'X',sourceHandle:'source',
    text:'11111111111111111111111111111111',observedAt:'2026-10-17T18:59:00Z',
    availableAt:'2026-10-17T19:00:03Z'})
  const future=mention('future','X','person','2026-10-17T19:00:20Z')
  const comparison=compareAlphaSocialWithPumpCreate({chain:launch,signals:[
    {...other,provenance:createAlphaEvidenceV2({
      sourceEventId:'wrong',sourceFamily:'SOCIAL',sourceHandle:'source',
      occurredAt:'2026-10-17T18:59:00Z',receivedAt:'2026-10-17T19:00:03Z',
      availableAt:'2026-10-17T19:00:03Z',evidenceIds:['wrong'],
    })},future,
  ],asOf:'2026-10-17T19:00:05Z'})
  expect(comparison.matchCount).toBe(0)
  expect(comparison.timing).toBe('NO_SOCIAL_EVIDENCE')
 })
 it('marks retrospective replay and missing providers as unverified research',()=>{
  const joined=compareAlphaSocialWithPumpCreate({
    chain:{...launch,mode:'RETROSPECTIVE'},signals:[],asOf:'2026-10-17T20:00:00Z'})
  expect(joined.retrospectiveOnly).toBe(true)
  expect(joined.caveats.join(' ')).toContain('Retrospective')
  expect(joined.independentOriginCount).toBe(0)
 })
})
describe('SHARK source health descriptive metrics',()=>{
 it('displays unknown coverage and never interprets missing source as zero social activity',()=>{
  const missing=summarizeAlphaSourceHealth('REDDIT',[])
  expect(missing.status).toBe('NOT_CONNECTED')
  expect(missing.coverage).toBe('UNKNOWN_NOT_ALL_PLATFORM_POSTS')
  expect(missing.acceptanceRate).toBeUndefined()
  const result=summarizeAlphaSourceHealth('BLUESKY',[
    {platform:'BLUESKY',capturedAt:'2026-10-17T19:00:01Z',status:'PARTIAL',requested:4,
      admitted:2,ignored:2,accessEvidenceIds:['api-read-1']},
  ])
  expect(result.acceptanceRate).toBe(.5)
  expect(result.postsAdmitted).toBe(2)
  expect(result.authority).toBe('DESCRIPTIVE_ONLY')
  expect(result.canTrade).toBe(false)
 })
 it('rejects impossible source receipts',()=>{
  expect(()=>summarizeAlphaSourceHealth('X',[{
    platform:'X',capturedAt:'not-a-time',status:'OK',requested:1,admitted:2,ignored:0,
    accessEvidenceIds:['bad'],
  }])).toThrow('receipt_invalid')
 })
})

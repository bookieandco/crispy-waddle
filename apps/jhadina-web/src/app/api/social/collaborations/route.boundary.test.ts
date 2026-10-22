import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const mock=vi.hoisted(()=>({
 verify:vi.fn(),identityFactory:vi.fn(),clientFactory:vi.fn(),from:vi.fn(),
 insert:vi.fn(),update:vi.fn(),upsert:vi.fn(),single:vi.fn(),maybeSingle:vi.fn(),
 query:vi.fn(),results:vi.fn()
}))
vi.mock('@/lib/auth/request-identity',()=>({createRequestIdentityVerifier:mock.identityFactory}))
vi.mock('@/lib/supabase/server',()=>({createClient:mock.clientFactory}))
import {GET,POST,PATCH} from './route'
import {POST as IMPORT} from './import/route'

const path='/api/social/collaborations'
const at='2026-10-21T20:00:00Z'
const draft={kind:'creator',brandId:'pupsonstuff',sourceKey:'instagram:sample',campaignRef:'campaign:sample',
 payload:{handle:'sample',source:'owner_supplied_unverified'},evidenceRefs:['owner:manual'],
 observedAt:at}
const row={record_id:'c4c45d1a-7554-4141-bb85-19ea6bf57111',kind:'creator',brand_id:'pupsonstuff',
 source_key:'instagram:sample',campaign_ref:'campaign:sample',payload:draft.payload,
 evidence_refs:['owner:manual'],observed_at:at,revision:1,updated_at:at,archived_at:null}
const make=(route:string,method:'GET'|'POST'|'PATCH',body?:unknown,origin='http://localhost')=>
 new NextRequest('http://localhost'+route,{method,headers:{origin,'content-type':'application/json'},
 ...(method==='GET'?{}:{body:JSON.stringify(body)})})
beforeEach(()=>{
 vi.clearAllMocks()
 mock.identityFactory.mockResolvedValue({verify:mock.verify})
 mock.verify.mockResolvedValue({userId:'e0e0e0e0-0011-4111-8111-111111111111'})
 mock.clientFactory.mockResolvedValue({from:mock.from})
 const chain:any={eq:vi.fn(),is:vi.fn(),select:vi.fn(),order:vi.fn(),limit:vi.fn(),
  insert:mock.insert,update:mock.update,upsert:mock.upsert,single:mock.single,
  maybeSingle:mock.maybeSingle,returns:mock.results}
 for(const key of ['eq','is','select','order','limit'])chain[key].mockReturnValue(chain)
 mock.from.mockReturnValue(chain);mock.insert.mockReturnValue(chain);mock.update.mockReturnValue(chain)
 mock.upsert.mockReturnValue(chain)
 mock.single.mockResolvedValue({data:row,error:null})
 mock.maybeSingle.mockResolvedValue({data:row,error:null})
 mock.results.mockResolvedValue({data:[row],error:null})
})
describe('SOCIAL-FREE-FINAL owner-draft API commissioning',()=>{
 it('creates a draft with server-authenticated owner; no external authority',async()=>{
  const response=await POST(make(path,'POST',draft))
  expect(response.status).toBe(201)
  expect(mock.verify).toHaveBeenCalledOnce()
  expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
   owner_user_id:'e0e0e0e0-0011-4111-8111-111111111111',
   external_action_authorized:false,money_movement_authorized:false,status:'DRAFT_ONLY'}))
  const json=await response.json()
  expect(json.record.authority).toBe('DRAFT_ONLY')
  expect(json.record.externalActionAuthorized).toBe(false)
 })
 it('requires a verified application session for creation',async()=>{
  mock.verify.mockRejectedValue(Error('Authenticated session required'))
  const response=await POST(make(path,'POST',draft))
  expect(response.status).toBe(401)
  expect(mock.insert).not.toHaveBeenCalled()
 })
 it('rejects cross-site writes, even for logged-in owners',async()=>{
  const response=await POST(make(path,'POST',draft,'https://untrusted.invalid'))
  expect(response.status).toBe(403)
  expect(mock.insert).not.toHaveBeenCalled()
 })
 it('rejects client-provided authorization flags and secret payloads',async()=>{
  let r=await POST(make(path,'POST',{...draft,externalActionAuthorized:true}))
  expect(r.status).toBe(400)
  r=await POST(make(path,'POST',{...draft,payload:{accessToken:'do-not-store'}}))
  expect(r.status).toBe(400)
  expect(mock.insert).not.toHaveBeenCalled()
 })
 it('rejects forged advanced collaboration stages',async()=>{
  const r=await POST(make(path,'POST',{...draft,kind:'collaboration',payload:{lifecycleStage:'completed_recorded'}}))
  expect(r.status).toBe(400);expect(mock.insert).not.toHaveBeenCalled()
 })
 it('lists only owner-filtered non-archived records',async()=>{
  const response=await GET(make(path,'GET'))
  expect(response.status).toBe(200)
  const json=await response.json()
  expect(json.records).toHaveLength(1)
  expect(json.records[0].externalActionAuthorized).toBe(false)
  expect(mock.from).toHaveBeenCalledWith('jhadina_creator_campaign_records')
 })
 it('imports manual leads without changing existing opt-outs',async()=>{
  mock.results.mockResolvedValueOnce({data:[{record_id:row.record_id,source_key:'instagram:sample'}],error:null})
  const response=await IMPORT(make(path+'/import','POST',{brandId:'pupsonstuff',leads:[{
   platform:'instagram',handle:'@sample',nicheTags:['dogs'],productAffinitySignals:['dog owner'],
   sourceRef:'user:manual',observedAt:at,contactPermission:'unknown',evidenceRefs:['manual:1']}] }))
  expect(response.status).toBe(200)
  expect(mock.upsert).toHaveBeenCalled()
  const opts=mock.upsert.mock.calls[0]?.[1]
  expect(opts).toEqual({onConflict:'owner_user_id,kind,brand_id,source_key',ignoreDuplicates:true})
  expect((await response.json()).externalActionAuthorized).toBe(false)
 })
 it('requires an authenticated session for import',async()=>{
  mock.verify.mockRejectedValue(Error('Authenticated session required'))
  const response=await IMPORT(make(path+'/import','POST',{brandId:'pupsonstuff',leads:[{
   platform:'instagram',handle:'sample',sourceRef:'source:1',observedAt:at,
   nicheTags:[],productAffinitySignals:[],contactPermission:'unknown',evidenceRefs:['source:1']}] }))
  expect(response.status).toBe(401)
  expect(mock.upsert).not.toHaveBeenCalled()
 })
 it('requires revision and owner scope before update',async()=>{
  const response=await PATCH(make(path,'PATCH',{...draft,id:row.record_id,revision:1,
   payload:{...draft.payload,stage:'draft'}}))
  expect(response.status).toBe(200)
  expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({revision:2,
   external_action_authorized:false,money_movement_authorized:false}))
 })
})

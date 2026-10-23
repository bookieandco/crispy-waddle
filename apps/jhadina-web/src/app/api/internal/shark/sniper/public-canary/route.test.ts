import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const mocks=vi.hoisted(()=>({
 claims:vi.fn(),profiles:vi.fn(),pair:vi.fn(),
}))
vi.mock('@/lib/supabase/server',()=>({
 createClient:async()=>({auth:{getClaims:mocks.claims}}),
}))
vi.mock('@/lib/shark/sniper-live-paper-feed',()=>({
 readPublicSniperProfilesOnce:mocks.profiles,
 readPublicSniperPairOnce:mocks.pair,
}))
import {GET} from './route'
const req=(search='?mode=profiles')=>new NextRequest('https://jhadina.example/api/internal/shark/sniper/public-canary'+search)
describe('LIVE-PAPER.10 owner-only canary boundary',()=>{
 beforeEach(()=>{
  vi.stubEnv('SHARK_SNIPER_PUBLIC_CANARY_ENABLED','true')
  vi.stubEnv('JHADINA_OWNER_USER_ID','owner-1')
  mocks.claims.mockReset().mockResolvedValue({data:{claims:{sub:'owner-1'}},error:null})
  mocks.profiles.mockReset().mockResolvedValue([])
  mocks.pair.mockReset().mockResolvedValue({status:'NO_MATCH_OR_UNVERIFIED_PAIR',
   mint:'2'.repeat(32),receivedAt:'2026-10-22T20:00:00Z',
   authority:'PUBLIC_RESEARCH_ONLY',canSign:false,canTrade:false})
 })
 afterEach(()=>vi.unstubAllEnvs())
 it('defaults off without operator commissioning',async()=>{
  vi.stubEnv('SHARK_SNIPER_PUBLIC_CANARY_ENABLED','false')
  const response=await GET(req())
  expect(response.status).toBe(503)
  expect(mocks.claims).not.toHaveBeenCalled()
  expect(mocks.profiles).not.toHaveBeenCalled()
 })
 it('denies signed-out, wrong-owner and missing owner settings',async()=>{
  mocks.claims.mockResolvedValueOnce({data:{claims:null},error:null})
  expect((await GET(req())).status).toBe(401)
  mocks.claims.mockResolvedValueOnce({data:{claims:{sub:'intruder'}},error:null})
  expect((await GET(req())).status).toBe(403)
  vi.stubEnv('JHADINA_OWNER_USER_ID','')
  expect((await GET(req())).status).toBe(503)
  expect(mocks.profiles).not.toHaveBeenCalled()
 })
 it('provides a manual fixed-host public-only observation to the owner',async()=>{
  const response=await GET(req())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  const body=await response.json()
  expect(body.canTrade).toBe(false)
  expect(body.chainProof).toBe(false)
  expect(mocks.profiles).toHaveBeenCalledTimes(1)
 })
 it('limits mode and fails provider error closed',async()=>{
  expect((await GET(req('?mode=invalid'))).status).toBe(400)
  mocks.pair.mockRejectedValueOnce(new Error('provider down'))
  expect((await GET(req('?mode=pair&mint=222&pair=333'))).status).toBe(502)
 })
})

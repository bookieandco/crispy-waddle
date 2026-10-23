import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const mocks=vi.hoisted(()=>({claims:vi.fn(),verify:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({
 createClient:async()=>({auth:{getClaims:mocks.claims}}),
}))
vi.mock('@/lib/shark/sniper-chain-receipt',()=>({
 verifySniperMintTransaction:mocks.verify,
}))
import {GET} from './route'
const req=(q='?signature='+ '4'.repeat(87)+'&mint='+'2'.repeat(32)+'&slot=99')=>
 new NextRequest('https://jhadina.example/api/internal/shark/sniper/verify-chain'+q)
describe('COMMISSION.16 owner-only chain cross-check',()=>{
 beforeEach(()=>{
  vi.stubEnv('SHARK_SNIPER_RPC_CANARY_ENABLED','true')
  vi.stubEnv('JHADINA_OWNER_USER_ID','owner')
  mocks.claims.mockReset().mockResolvedValue({data:{claims:{sub:'owner'}},error:null})
  mocks.verify.mockReset().mockResolvedValue({
   status:'CONFIRMED_MINT_INSTRUCTION',canTrade:false,canSign:false,
  })
 })
 afterEach(()=>vi.unstubAllEnvs())
 it('remains disabled before explicit commissioning',async()=>{
  vi.stubEnv('SHARK_SNIPER_RPC_CANARY_ENABLED','false')
  expect((await GET(req())).status).toBe(503)
  expect(mocks.verify).not.toHaveBeenCalled()
 })
 it('requires signed-in intended owner, never a general authenticated user',async()=>{
  mocks.claims.mockResolvedValueOnce({data:{claims:null},error:null})
  expect((await GET(req())).status).toBe(401)
  mocks.claims.mockResolvedValueOnce({data:{claims:{sub:'another-user'}},error:null})
  expect((await GET(req())).status).toBe(403)
  expect(mocks.verify).not.toHaveBeenCalled()
 })
 it('allows manual owner RPC proof without promoting it to live webhook latency',async()=>{
  const response=await GET(req())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.verify).toHaveBeenCalledTimes(1)
  const b=await response.json()
  expect(b.observationKind).toBe('MANUAL_RPC_CHECK_NOT_WEBHOOK_DELIVERY')
  expect(b.canTrade).toBe(false)
 })
 it('rejects malformed/extra request and fails closed during provider outage',async()=>{
  expect((await GET(req('?mint=2&slot=99'))).status).toBe(400)
  expect((await GET(req('?signature=x&mint=2&slot=0'))).status).toBe(400)
  mocks.verify.mockRejectedValueOnce(new Error('upstream unavailable'))
  expect((await GET(req())).status).toBe(503)
 })
})

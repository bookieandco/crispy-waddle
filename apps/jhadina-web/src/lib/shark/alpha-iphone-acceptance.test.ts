import {describe,expect,it} from 'vitest'
import {ALPHA_IPHONE_CHECKS,createAlphaLocalAcceptance} from './alpha-iphone-acceptance'
describe('iPhone owner acceptance .16',()=>{
 it('keeps local checkbox completion separate from independent device/source commissioning',()=>{
   const checked=ALPHA_IPHONE_CHECKS.map(c=>c.id)
   const r=createAlphaLocalAcceptance({selected:checked,recordedAt:'2026-10-17T20:00:00Z'})
   expect(r.passed).toBe(8)
   expect(r.total).toBe(8)
   expect(r.status).toBe('LOCAL_SELF_CHECK_NOT_CERTIFIED')
   expect(r.independentDeviceAcceptanceVerified).toBe(false)
   expect(r.realProviderDeliveryVerified).toBe(false)
   expect(r.productionCommissioned).toBe(false)
   expect(r.canTrade).toBe(false)
 })
 it('rejects duplicate, invalid, and invented owner proof',()=>{
   expect(()=>createAlphaLocalAcceptance({
      selected:['tap','tap'],recordedAt:'2026-10-17T20:00:00Z',
   })).toThrow('acceptance_invalid')
   expect(()=>createAlphaLocalAcceptance({selected:['tap'],recordedAt:'yesterday'})).toThrow('acceptance_invalid')
   const r=createAlphaLocalAcceptance({selected:[],recordedAt:'2026-10-17T20:00:00Z'})
   expect(r.passed).toBe(0)
   expect(r.checks.no_trade).toBe(false)
 })
})

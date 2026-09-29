import { describe,it } from 'node:test'
import assert from 'node:assert/strict'
import { certifyDexRouterFinal,type DexVenueCommissionEvidence } from './dex-router-final.js'

function evidence(provider:DexVenueCommissionEvidence['provider'],overrides:Partial<DexVenueCommissionEvidence>={}):DexVenueCommissionEvidence{
 return {
  provider,
  implementationId:'impl:'+provider,
  implementationKind:provider==='jupiter-ultra'?'JUPITER_ULTRA_MANAGED':'VENDOR_SDK',
  implementationVersion:'1.0.0',
  transactionBuilderVerified:true,
  mainnetBindingVerified:true,
  slippageBindingVerified:true,
  quoteBindingVerified:true,
  signedBroadcastVerified:true,
  evidenceClass:'REAL_INTEGRATION',
  evidenceIds:['e:'+provider],
  authority:'ROUTER_COMMISSION_EVIDENCE_ONLY',
  canAuthorizeTrade:false,
  ...overrides,
 }
}

describe('DEX-ROUTER.FINAL commissioning',()=>{
 it('fails closed when only the routing surface exists and direct builders are not commissioned',()=>{
  const report=certifyDexRouterFinal({venueEvidence:[evidence('jupiter-ultra')]})
  assert.equal(report.passed,false)
  assert.equal(report.status,'ROUTER_SURFACE_READY_DIRECT_BUILDERS_REQUIRED')
  assert.equal(report.jupiterPrimaryVerified,true)
  assert.equal(report.raydiumDirectVerified,false)
  assert.equal(report.meteoraDirectVerified,false)
  assert.ok(report.blockerCodes.includes('DEX_ROUTER_RAYDIUM_DIRECT_BUILDER_NOT_COMMISSIONED'))
  assert.ok(report.blockerCodes.includes('DEX_ROUTER_METEORA_DIRECT_BUILDER_NOT_COMMISSIONED'))
 })
 it('does not accept test fixtures as venue commissioning evidence',()=>{
  const report=certifyDexRouterFinal({venueEvidence:[
   evidence('jupiter-ultra'),
   evidence('raydium-direct',{evidenceClass:'TEST_FIXTURE'}),
   evidence('meteora-direct',{evidenceClass:'TEST_FIXTURE'}),
  ]})
  assert.equal(report.passed,false)
  assert.equal(report.raydiumDirectVerified,false)
  assert.equal(report.meteoraDirectVerified,false)
 })
 it('passes only when all three venues are real-integration verified in Jupiter -> Raydium -> Meteora order',()=>{
  const report=certifyDexRouterFinal({venueEvidence:[
   evidence('jupiter-ultra'),
   evidence('raydium-direct'),
   evidence('meteora-direct'),
  ]})
  assert.equal(report.passed,true)
  assert.equal(report.status,'DEX_ROUTER_COMMISSIONED')
  assert.deepEqual(report.fallbackOrder,['jupiter-ultra','raydium-direct','meteora-direct'])
  assert.equal(report.unrestrictedLiveAuthorized,false)
  assert.equal(report.canAuthorizeTrade,false)
 })
})

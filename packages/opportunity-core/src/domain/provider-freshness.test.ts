import assert from 'node:assert/strict'
import type { FulfillmentProvider } from './fulfillment-provider.js'
import { evaluateProviderFreshness, providerIsFreshForContracting } from './provider-freshness.js'
const p:FulfillmentProvider={id:'p',legalName:'P',identifiers:[],serviceAreas:[],capabilities:[],credentials:[{id:'lic',kind:'license',name:'L',expiresAt:'2026-10-01T00:00:00Z',verified:true,evidenceRefs:['lic-e']}],pastPerformance:[],capacity:{status:'available',evidenceRefs:['cap-e']},evidence:[{id:'lic-e',kind:'license_record',relationship:'supports_credential',sourceId:'s',capturedAt:'2026-09-15T00:00:00Z',confidence:1},{id:'cap-e',kind:'capacity_record',relationship:'supports_capacity',sourceId:'s',capturedAt:'2026-09-18T00:00:00Z',confidence:1}],sourceIds:['s'],verificationStatus:'partially_verified',stage:'capability_verified',riskFlags:[],createdAt:'x',updatedAt:'x'}
const fresh=evaluateProviderFreshness(p,'2026-09-20T00:00:00Z');assert.equal(fresh.status,'fresh');assert.equal(providerIsFreshForContracting(fresh),true)
const stale=evaluateProviderFreshness(p,'2026-11-20T00:00:00Z');assert.equal(stale.status,'blocked');assert.ok(stale.expiredCredentialIds.includes('lic'));assert.ok(stale.staleEvidenceIds.includes('cap-e'))
console.log('provider-freshness tests passed')

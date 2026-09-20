import assert from 'node:assert/strict'
import { qualifyProviders } from './provider-qualification-team.js'
import type { FulfillmentProvider } from './fulfillment-provider.js'
const provider:FulfillmentProvider={id:'p',legalName:'P',identifiers:[],serviceAreas:[],capabilities:[],credentials:[{id:'lic',kind:'license',name:'License',expiresAt:'2026-01-01T00:00:00Z',verified:true,evidenceRefs:['e']}],pastPerformance:[],capacity:{status:'unavailable',evidenceRefs:[]},evidence:[{id:'e',kind:'license_record',relationship:'supports_credential',sourceId:'s',capturedAt:'2025-01-01T00:00:00Z',confidence:1}],sourceIds:['s'],verificationStatus:'unverified',stage:'discovered',riskFlags:[],createdAt:'2025-01-01T00:00:00Z',updatedAt:'2025-01-01T00:00:00Z'}
const set={opportunityId:'o',generatedAt:'2026-09-20T00:00:00Z',unresolved:[],requirements:[]}
const q=qualifyProviders(set,[provider],'2026-09-20T00:00:00Z')[0]
assert.equal(q.status,'blocked');assert.ok(q.blockers.some(x=>x.includes('Expired')));assert.ok(q.blockers.some(x=>x.includes('unavailable')))

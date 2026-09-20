import assert from 'node:assert/strict'
import { discoverFulfillmentProviders, observationsToFulfillmentProviders } from './provider-discovery.js'

{
  // keeps discovery observations unverified and non-authorizing
  {
    const result=observationsToFulfillmentProviders([{
      source:'entity_directory',sourceId:'directory:1',observedAt:'2026-09-20T00:00:00Z',
      legalName:'Example Federal Services LLC',uei:'UEI123',evidenceRef:'e:entity',
      capabilities:[{name:'cloud migration',naicsCodes:['541512'],keywords:['cloud']}],
      capacity:{status:'available',workforceSize:12},
    }])
    assert.equal(result.authority,'DISCOVERY_ONLY')
    assert.equal(result.engagementAuthorized,false)
    assert.equal(result.providers[0].verificationStatus,'unverified')
    assert.equal(result.providers[0].capabilities[0].verified,false)
    assert.deepEqual(result.providers[0].capabilities[0].evidenceRefs,['e:entity:cap:1'])
    assert.deepEqual(result.providers[0].capacity.evidenceRefs,['e:entity'])
  }

  // fails soft per source while preserving successful discovery
  {
    const result=await discoverFulfillmentProviders([
      {id:'ok',source:'manual',async discover(){return [{source:'manual',sourceId:'manual:1',observedAt:'2026-09-20T00:00:00Z',legalName:'A',evidenceRef:'m:1'}]}},
      {id:'down',source:'web_search',async discover(){throw new Error('offline')}},
    ],{keywords:['security'],naicsCodes:[],pscCodes:[]})
    assert.equal(result.providers.length,1)
    assert.ok(result.warnings.includes('down: offline'))
  }
}

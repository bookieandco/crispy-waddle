import { describe,expect,it } from 'vitest'
import { discoverFulfillmentProviders, observationsToFulfillmentProviders } from './provider-discovery.js'

describe('SAM-PROD provider discovery',()=>{
  it('keeps discovery observations unverified and non-authorizing',()=>{
    const result=observationsToFulfillmentProviders([{
      source:'entity_directory',sourceId:'directory:1',observedAt:'2026-09-20T00:00:00Z',
      legalName:'Example Federal Services LLC',uei:'UEI123',evidenceRef:'e:entity',
      capabilities:[{name:'cloud migration',naicsCodes:['541512'],keywords:['cloud']}],
      capacity:{status:'available',workforceSize:12},
    }])
    expect(result.authority).toBe('DISCOVERY_ONLY')
    expect(result.engagementAuthorized).toBe(false)
    expect(result.providers[0].verificationStatus).toBe('unverified')
    expect(result.providers[0].capabilities[0].verified).toBe(false)
    expect(result.providers[0].capabilities[0].evidenceRefs).toEqual(['e:entity:cap:1'])
    expect(result.providers[0].capacity.evidenceRefs).toEqual(['e:entity'])
  })

  it('fails soft per source while preserving successful discovery',async()=>{
    const result=await discoverFulfillmentProviders([
      {id:'ok',source:'manual',async discover(){return [{source:'manual',sourceId:'manual:1',observedAt:'2026-09-20T00:00:00Z',legalName:'A',evidenceRef:'m:1'}]}},
      {id:'down',source:'web_search',async discover(){throw new Error('offline')}},
    ],{keywords:['security'],naicsCodes:[],pscCodes:[]})
    expect(result.providers).toHaveLength(1)
    expect(result.warnings).toContain('down: offline')
  })
})

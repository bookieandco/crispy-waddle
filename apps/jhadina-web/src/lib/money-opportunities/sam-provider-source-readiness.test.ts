import { describe,expect,it } from 'vitest'
import { collectSamProviderSourceReadiness,summarizeSamProviderSourceReadiness } from './sam-provider-source-readiness'

describe('SAM provider source readiness',()=>{
  it('reports booleans and modes without exposing credential values',()=>{
    const readiness=collectSamProviderSourceReadiness({
      SAM_GOV_API_KEY:'sam-secret-value',
      EXA_API_KEY:'exa-secret-value',
      INEGI_DENUE_TOKEN:'denue-secret-value',
      FMCSA_APP_TOKEN:'fmcsa-secret-value',
      FSIS_MPI_CSV_URL:'https://fsis.example/directory.csv',
      CANADA_ODBUS_CSV_URL:'https://cache.example/odbus.csv',
    })
    const summary=summarizeSamProviderSourceReadiness(readiness)
    expect(summary.providerVerificationConfigured).toContain('sam_entity')
    expect(summary.providerVerificationConfigured).toContain('fmcsa')
    expect(summary.providerDiscoveryConfigured).toContain('exa')
    expect(summary.providerDiscoveryConfigured).toContain('denue')
    expect(summary.providerDiscoveryConfigured).toContain('canada_importer')
    const serialized=JSON.stringify(summary)
    expect(serialized).not.toContain('sam-secret-value')
    expect(serialized).not.toContain('exa-secret-value')
    expect(serialized).not.toContain('denue-secret-value')
    expect(serialized).not.toContain('fmcsa-secret-value')
  })

  it('distinguishes keyless sources from optional/configured sources',()=>{
    const summary=summarizeSamProviderSourceReadiness(collectSamProviderSourceReadiness({}))
    expect(summary.providerVerificationConfigured).toEqual(expect.arrayContaining(['usaspending','fmcsa']))
    expect(summary.providerDiscoveryConfigured).toContain('canada_importer')
    expect(summary.unavailable).toEqual(expect.arrayContaining(['sam_entity','exa','fsis','denue','canada_odbusiness','paca','sba_dsbs']))
  })
})

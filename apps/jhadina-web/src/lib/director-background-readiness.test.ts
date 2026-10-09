import {describe,expect,it} from 'vitest'
import {
  classifyDirectorBackgroundStorageBlocker,
  directorBackgroundConfiguration,
} from './director-background-readiness'

function fixture(overrides:Partial<Parameters<typeof directorBackgroundConfiguration>[0]>={}) {
  return directorBackgroundConfiguration({
    directSupabaseUrl:false,
    directServiceRoleKey:false,
    publicSupabaseBootstrap:true,
    schedulerBearerIdentity:true,
    watchWorkerUrl:false,
    watchWorkerToken:false,
    watchCallbackUrl:false,
    watchCallbackSecret:false,
    ...overrides,
  })
}

describe('Director background readiness diagnostics',()=>{
  it('recognizes scheduler OIDC proxy without demanding Vercel service-role secrets',()=>{
    const result=fixture()
    expect(result.credentialMode).toBe('scheduler-oidc-proxy')
    expect(result.hasSupabaseUrl).toBe(false)
    expect(result.hasSupabaseServiceRoleKey).toBe(false)
    expect(result.hasPublicSupabaseBootstrap).toBe(true)
  })

  it('prefers direct credentials only when both required pieces exist',()=>{
    expect(fixture({directSupabaseUrl:true,directServiceRoleKey:true}).credentialMode)
      .toBe('direct-service-role')
    expect(fixture({directSupabaseUrl:true,directServiceRoleKey:false}).credentialMode)
      .toBe('scheduler-oidc-proxy')
  })

  it('does not grant proxy authority without the authenticated scheduler identity',()=>{
    expect(fixture({schedulerBearerIdentity:false}).credentialMode).toBe('unavailable')
    expect(fixture({publicSupabaseBootstrap:false}).credentialMode).toBe('unavailable')
  })

  it('does not misreport missing optional Watch direct configuration as runtime failure',()=>{
    const result=fixture()
    expect(result.watchWorkerRequiresRuntimeResolution).toBe(true)
    expect(result.watchWorkerReady).toBe('not-probed')
    expect(result.hasWatchWorkerUrl).toBe(false)
  })

  it('classifies permission, schema and unavailable PostgREST errors without raw messages',()=>{
    expect(classifyDirectorBackgroundStorageBlocker({code:'42P01',message:'private schema info'}))
      .toBe('DIRECTOR_BACKGROUND_STORAGE_SCHEMA_UNAVAILABLE')
    expect(classifyDirectorBackgroundStorageBlocker({code:'42501'}))
      .toBe('DIRECTOR_BACKGROUND_STORAGE_AUTHORITY_REJECTED')
    expect(classifyDirectorBackgroundStorageBlocker({code:'57P03'}))
      .toBe('DIRECTOR_BACKGROUND_STORAGE_SERVICE_UNAVAILABLE')
    expect(classifyDirectorBackgroundStorageBlocker({code:'53100'}))
      .toBe('DIRECTOR_BACKGROUND_STORAGE_SERVICE_UNAVAILABLE')
    expect(classifyDirectorBackgroundStorageBlocker({code:'',message:'sensitive provider details'}))
      .toBe('DIRECTOR_BACKGROUND_STORAGE_PROBE_FAILED')
  })
})

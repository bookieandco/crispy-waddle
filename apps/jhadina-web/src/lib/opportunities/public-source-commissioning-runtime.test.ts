import { describe, expect, it } from 'vitest'
import {
  SOURCE_DISCOVERY_RETRY_EXHAUSTED_ATTEMPTS,
  sourceDiscoveryFailureDisposition,
} from './public-source-commissioning-runtime'

describe('public source retry exhaustion',()=>{
  it('terminalizes repeated external transport failures without losing the cause',()=>{
    expect(sourceDiscoveryFailureDisposition({
      message:'fetch failed',
      attemptCount:SOURCE_DISCOVERY_RETRY_EXHAUSTED_ATTEMPTS,
      previousStatus:'deferred',
    })).toEqual({
      status:'blocked',
      storedError:'SOURCE_DISCOVERY_RETRY_EXHAUSTED:fetch failed',
      terminal:true,
      retryExhausted:true,
    })
  })

  it('keeps fresh deferred transport failures retryable',()=>{
    expect(sourceDiscoveryFailureDisposition({
      message:'The operation was aborted due to timeout',
      attemptCount:SOURCE_DISCOVERY_RETRY_EXHAUSTED_ATTEMPTS-1,
      previousStatus:'deferred',
    }).status).toBe('deferred')
  })

  it('does not hide internal database failures behind discovery exhaustion',()=>{
    const result=sourceDiscoveryFailureDisposition({
      message:'public_source_discovery_job_update_failed:canceling statement due to statement timeout',
      attemptCount:99,
      previousStatus:'deferred',
    })
    expect(result.status).toBe('deferred')
    expect(result.retryExhausted).toBe(false)
    expect(result.terminal).toBe(false)
  })

  it('still terminalizes a deterministic missing-source condition immediately',()=>{
    const result=sourceDiscoveryFailureDisposition({
      message:'PUBLIC_SOURCE_NO_OFFICIAL_DOMAIN_AND_SEARCH_NOT_CONFIGURED',
      attemptCount:1,
      previousStatus:'pending',
    })
    expect(result.status).toBe('blocked')
    expect(result.terminal).toBe(true)
  })
})

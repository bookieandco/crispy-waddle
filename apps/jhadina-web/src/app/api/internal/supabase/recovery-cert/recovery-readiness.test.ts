import {describe,expect,it} from 'vitest'
import {assessReadOnlyRecoveryProbes} from './recovery-readiness'

describe('SUPABASE-DB.2 read-only certification truth',()=>{
  it('never grants cross-system recovery even with every read probe healthy',()=>{
    const outcome=assessReadOnlyRecoveryProbes([
      {id:'memory',ready:true},
      {id:'auth-admin',ready:true},
      {id:'storage-api',ready:true},
      {id:'director-runtime-config',ready:true},
      {id:'director-storage-object-sample',ready:true},
    ])
    expect(outcome).toMatchObject({
      ok:false,
      ready:false,
      canMutate:false,
      canDeclareCrossSystemReady:false,
      readOnlyProbesHealthy:true,
      state:'REVIEW_REQUIRED',
      certification:'NOT_ISSUED',
      blocker:'LIVE_WRITE_RESTORE_AND_OWNER_AUTH_PROOF_REQUIRED',
    })
    expect(outcome.missingEvidence).toEqual(expect.arrayContaining([
      'SWLC_READ_WRITE_TRANSACTION',
      'POSTGREST_AUTHENTICATED_RLS_ALLOW_AND_DENY',
      'ENCRYPTED_BACKUP_INDEPENDENT_ISOLATED_RESTORE',
      'STORAGE_OBJECT_BYTE_HASH_AND_READBACK',
    ]))
  })

  it('blocks any failed read probe and never issues a certificate',()=>{
    const outcome=assessReadOnlyRecoveryProbes([
      {id:'memory',ready:true},
      {id:'storage-api',ready:false},
    ])
    expect(outcome.state).toBe('BLOCKED')
    expect(outcome.blocker).toBe('READ_ONLY_PROBE_FAILED')
    expect(outcome.ready).toBe(false)
  })

  it('does not treat empty or malformed probe batches as healthy',()=>{
    for(const probes of [
      [],
      [{id:'',ready:true}],
      [{id:'table',ready:undefined as unknown as boolean}],
      [{id:'table',ready:'true' as unknown as boolean}],
    ]){
      const outcome=assessReadOnlyRecoveryProbes(probes)
      expect(outcome.readOnlyProbesHealthy).toBe(false)
      expect(outcome.certification).toBe('NOT_ISSUED')
    }
  })

  it('does not allow test callers to supply fabricated write/restore approvals',()=>{
    const spoofed=[
      {id:'read-only-table',ready:true,writeReady:true,backupRestored:true,authorized:true},
    ]
    const result=assessReadOnlyRecoveryProbes(spoofed)
    expect(result.ready).toBe(false)
    expect(result.state).toBe('REVIEW_REQUIRED')
    expect('writeReady' in result).toBe(false)
  })
})

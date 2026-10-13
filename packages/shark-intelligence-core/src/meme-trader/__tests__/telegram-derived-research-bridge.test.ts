import {describe,expect,it} from 'vitest'
import {mapDerivedTelegramToShark} from '../telegram-derived-research-bridge'
const solana='FXynyTLxTwaLZJrBuLTNafBfqBthbAxKiv7afABapump'
const evm='0x98096d17e191B3dA1d5f99a6D7b3584351b11E18'
const hash='a'.repeat(64)
const base={
  schema_version:'jhadina.telegram.token-signal.v1',
  source:'owner_authorized_telegram',
  reader_mode:'forwarded_bot',
  chain_id:'solana_candidate',
  token_address:solana,
  message_fingerprint:hash,
  source_fingerprint:'b'.repeat(64),
  text_hmac_sha256:'c'.repeat(64),
  upstream_channel_fingerprint:null,
  message_time_utc:'2026-10-12T18:00:00Z',
  collected_at_utc:'2026-10-12T18:02:00Z',
  forward_origin_date_utc:'2026-09-18T12:00:00Z',
  mentioned_tags:['MIGRATION_CLAIM','PUMPSWAP_MENTION'],
  identity_verified:false,
  migration_verified_onchain:false,
  scoring_eligible:false,
  can_authorize_trade:false,
} as const

describe('owner-authorized Telegram derived research bridge',()=>{
  it('preserves collected availability and refuses to backdate forwarded predictions',()=>{
    const result=mapDerivedTelegramToShark(base)
    expect(result.status).toBe('EVIDENCE_ONLY')
    if(result.status!=='EVIDENCE_ONLY')throw new Error('unexpected')
    expect(result.observation.observedAt).toBe('2026-10-12T18:00:00Z')
    expect(result.observation.availableAt).toBe('2026-10-12T18:02:00Z')
    expect(result.observation.textHash).toBe('hmac-sha256:'+'c'.repeat(64))
    expect(result.sourceAttribution).toBe('FORWARD_ORIGIN_UNKNOWN')
    expect(result.migrationClaimOnly).toBe(true)
    expect(result.observation.authority).toBe('EVIDENCE_ONLY')
    expect(result.observation.canAuthorizeTrade).toBe(false)
  })
  it('keeps pseudonymous upstream evidence distinct without asserting independent callers',()=>{
    const result=mapDerivedTelegramToShark({...base,upstream_channel_fingerprint:'d'.repeat(64)})
    expect(result.status).toBe('EVIDENCE_ONLY')
    if(result.status!=='EVIDENCE_ONLY')throw new Error('unexpected')
    expect(result.sourceAttribution).toBe('FORWARDED_CHANNEL_PSEUDONYM')
    expect(result.observation.sourceHandle).toBe('telegram:derived:'+'d'.repeat(64))
    expect(JSON.stringify(result)).not.toContain('123456789')
  })
  it('holds unknown EVM network out of Solana evidence contracts',()=>{
    const result=mapDerivedTelegramToShark({...base,chain_id:'evm_unresolved',token_address:evm})
    expect(result).toEqual({status:'CHAIN_UNRESOLVED',tokenAddress:evm,
      authority:'RESEARCH_ONLY',canAuthorizeTrade:false})
  })
  it('rejects backwards availability and fabricated onchain verification',()=>{
    expect(()=>mapDerivedTelegramToShark({...base,collected_at_utc:'2026-10-12T17:00:00Z'}))
      .toThrow('shark_telegram_derived_evidence_invalid')
    expect(()=>mapDerivedTelegramToShark({...base,migration_verified_onchain:true}))
      .toThrow('shark_telegram_derived_evidence_invalid')
    expect(()=>mapDerivedTelegramToShark({...base,scoring_eligible:true}))
      .toThrow('shark_telegram_derived_evidence_invalid')
    expect(()=>mapDerivedTelegramToShark({...base,can_authorize_trade:true}))
      .toThrow('shark_telegram_derived_evidence_invalid')
  })
  it('rejects injected or malformed candidate data',()=>{
    expect(()=>mapDerivedTelegramToShark({...base,chain_id:'ethereum',token_address:solana}))
      .toThrow('shark_telegram_derived_chain_invalid')
    expect(()=>mapDerivedTelegramToShark({...base,source_fingerprint:'not-a-real-hmac'}))
      .toThrow('shark_telegram_derived_evidence_invalid')
  })
})

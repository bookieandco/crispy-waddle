import type {ExternalSignalObservation} from './external-signal-ingest'

/**
 * Research bridge from the private Python Telegram reader's derived JSONL rows.
 * Does NOT read Telegram, perform networking, persist to Supabase, or execute trades.
 * The upstream source is pseudonymous. Forward receipt != original publication time.
 */
type EvidenceOnlyResult=Readonly<{
  status:'EVIDENCE_ONLY'
  observation:ExternalSignalObservation
  sourceAttribution:'AUTHORIZED_CHAT'|'FORWARDED_CHANNEL_PSEUDONYM'|'FORWARD_ORIGIN_UNKNOWN'
  migrationClaimOnly:boolean
}>
type ReviewResult=Readonly<{
  status:'CHAIN_UNRESOLVED'
  tokenAddress:string
  authority:'RESEARCH_ONLY'
  canAuthorizeTrade:false
}>
const sha=/^[a-f0-9]{64}$/i
const solana=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const evm=/^0x[a-fA-F0-9]{40}$/
const iso=(value:unknown):value is string=>
  typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value)&&Number.isFinite(Date.parse(value))
const record=(value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==='object'&&!Array.isArray(value)

export function mapDerivedTelegramToShark(
  input:unknown,
):EvidenceOnlyResult|ReviewResult {
  if(!record(input)
     ||input.schema_version!=='jhadina.telegram.token-signal.v1'
     ||input.source!=='owner_authorized_telegram'
     ||input.scoring_eligible!==false
     ||input.can_authorize_trade!==false
     ||input.migration_verified_onchain!==false
     ||input.identity_verified!==false
     ||!sha.test(String(input.message_fingerprint??''))
     ||!sha.test(String(input.source_fingerprint??''))
     ||!sha.test(String(input.text_hmac_sha256??''))
     ||!iso(input.message_time_utc)
     ||!iso(input.collected_at_utc)
     ||Date.parse(input.message_time_utc)>Date.parse(input.collected_at_utc)
     ||typeof input.token_address!=='string'
     ||!Array.isArray(input.mentioned_tags)
     ||!input.mentioned_tags.every(tag=>typeof tag==='string')
     ||!['backfill','live','forwarded_bot'].includes(String(input.reader_mode))){
    throw new Error('shark_telegram_derived_evidence_invalid')
  }
  const tokenAddress=input.token_address
  if(input.chain_id==='evm_unresolved'&&evm.test(tokenAddress)){
    return Object.freeze({status:'CHAIN_UNRESOLVED',tokenAddress,
      authority:'RESEARCH_ONLY',canAuthorizeTrade:false})
  }
  if(input.chain_id!=='solana_candidate'||!solana.test(tokenAddress))
    throw new Error('shark_telegram_derived_chain_invalid')
  const viaForward=input.reader_mode==='forwarded_bot'
  const upstream=typeof input.upstream_channel_fingerprint==='string'
                 &&sha.test(input.upstream_channel_fingerprint)
                 ?input.upstream_channel_fingerprint:null
  const pseudonym=viaForward?(upstream??'unattributed'):String(input.source_fingerprint)
  const sourceAttribution=viaForward?(upstream?'FORWARDED_CHANNEL_PSEUDONYM':'FORWARD_ORIGIN_UNKNOWN'):'AUTHORIZED_CHAT'
  const observation:ExternalSignalObservation=Object.freeze({
    observationId:'telegram-hmac:'+input.message_fingerprint+':'+tokenAddress,
    platform:'TELEGRAM',
    sourceHandle:'telegram:derived:'+pseudonym,
    observedAt:input.message_time_utc,
    availableAt:input.collected_at_utc,
    textHash:'hmac-sha256:'+input.text_hmac_sha256,
    candidates:Object.freeze([Object.freeze({
      kind:'SOLANA_ADDRESS' as const,value:tokenAddress,confidence:0.55,
    })]),
    memoryTier:'KNOWN',authority:'EVIDENCE_ONLY',canAuthorizeTrade:false,
  })
  return Object.freeze({status:'EVIDENCE_ONLY',observation,sourceAttribution,
    migrationClaimOnly:input.mentioned_tags.includes('MIGRATION_CLAIM')})
}

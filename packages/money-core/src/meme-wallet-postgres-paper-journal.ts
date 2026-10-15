import type { MemeWalletPaperJournal } from './meme-wallet-paper-runtime.js'
import type { MemeWalletPaperDecision, MemeWalletPaperReceipt } from './meme-wallet-paper-gate.js'

/**
 * Private, dedicated PostgreSQL *paper-only* journal. The caller must supply
 * a least-privilege research client with SELECT/INSERT on migration 035 tables
 * only. No Coffer, Phantom, RPC, swap, exchange or signer object is accepted.
 */
export interface MemeWalletPaperSql {
  query(sql:string,params?:readonly unknown[]):Promise<{rows:Record<string,unknown>[];rowCount?:number|null}>
}
const encoded=(v:unknown)=>JSON.stringify(v,(_,value)=>typeof value==='bigint'?value.toString():value)
function body(v:unknown):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('MEME_PAPER_JOURNAL_PAYLOAD_INVALID')
  return v as Record<string,unknown>
}
function rawBig(v:unknown){
  if(typeof v!=='string'||!/^\d+$/.test(v))throw Error('MEME_PAPER_JOURNAL_AMOUNT_INVALID')
  return BigInt(v)
}
function parseDecision(raw:unknown):MemeWalletPaperDecision{
  const x=body(raw)
  if(typeof x.decisionId!=='string'||!x.decisionId.startsWith('meme-wallet:paper:')||
    typeof x.walletId!=='string'||typeof x.candidateCaseId!=='string'||
    !Array.isArray(x.reasonCodes)||!x.reasonCodes.every(s=>typeof s==='string')||
    !['PAPER_ADMIT','PAPER_BLOCK'].includes(String(x.disposition))||
    x.authority!=='PAPER_SIMULATION_ONLY'||x.canSign!==false||x.canExecute!==false||
    x.canMoveMoney!==false||x.signerLeaseId!==null||x.executionPermitId!==null||
    x.requiresFreshOwnerApprovalForLive!==true)throw Error('MEME_PAPER_JOURNAL_DECISION_AUTHORITY_INVALID')
  return Object.freeze({
    decisionId:x.decisionId,walletId:x.walletId,candidateCaseId:x.candidateCaseId,
    proposedEntryMinor:rawBig(x.proposedEntryMinor),
    reasonCodes:Object.freeze([...x.reasonCodes] as string[]),
    disposition:x.disposition as MemeWalletPaperDecision['disposition'],
    authority:'PAPER_SIMULATION_ONLY',canSign:false,canExecute:false,canMoveMoney:false,
    signerLeaseId:null,executionPermitId:null,requiresFreshOwnerApprovalForLive:true,
  })
}
function parseReceipt(raw:unknown):MemeWalletPaperReceipt{
  const x=body(raw)
  if(typeof x.decisionId!=='string'||!['PAPER_FILLED','PAPER_FAILED','PAPER_UNKNOWN'].includes(String(x.state))||
    x.authority!=='SIMULATED_SETTLEMENT_ONLY'||x.canExecute!==false||
    !Array.isArray(x.evidenceIds)||!x.evidenceIds.length||
    !x.evidenceIds.every(s=>typeof s==='string'&&s.length>0)||
    typeof x.observedAt!=='string'||!Number.isFinite(Date.parse(x.observedAt))||
    (x.outputAtomic!==null&&(typeof x.outputAtomic!=='string'||!/^\d+$/.test(x.outputAtomic)))||
    (x.state==='PAPER_FILLED'&&x.outputAtomic===null)||
    (x.state!=='PAPER_FILLED'&&x.outputAtomic!==null))throw Error('MEME_PAPER_JOURNAL_RECEIPT_AUTHORITY_INVALID')
  return Object.freeze({
    decisionId:x.decisionId,state:x.state as MemeWalletPaperReceipt['state'],
    inputMinor:rawBig(x.inputMinor),outputAtomic:x.outputAtomic as string|null,
    simulatedFeeMinor:rawBig(x.simulatedFeeMinor),
    observedAt:x.observedAt,evidenceIds:Object.freeze([...x.evidenceIds] as string[]),
    authority:'SIMULATED_SETTLEMENT_ONLY',canExecute:false,
  })
}
export function createMemeWalletPostgresPaperJournal(db:MemeWalletPaperSql):MemeWalletPaperJournal{
  return Object.freeze({
    async getByCase(walletId:string,caseId:string){
      if(!walletId||!caseId)throw Error('MEME_PAPER_JOURNAL_LOOKUP_INVALID')
      const result=await db.query(
        `SELECT d.decision_json,r.receipt_json FROM runpod_meme_wallet_paper_decisions d
         LEFT JOIN runpod_meme_wallet_paper_receipts r ON r.decision_id=d.decision_id
         WHERE d.wallet_id=$1 AND d.candidate_case_id=$2 LIMIT 1`,[walletId,caseId])
      if(!result.rows.length)return null
      if(result.rows.length!==1)throw Error('MEME_PAPER_JOURNAL_DUPLICATE_LOOKUP')
      const record=result.rows[0]!
      const decision=parseDecision(record.decision_json)
      if(decision.walletId!==walletId||decision.candidateCaseId!==caseId)
        throw Error('MEME_PAPER_JOURNAL_CASE_BINDING_MISMATCH')
      const receipt=record.receipt_json===null||record.receipt_json===undefined
        ? null : parseReceipt(record.receipt_json)
      if(receipt&&(receipt.decisionId!==decision.decisionId||
        receipt.inputMinor!==decision.proposedEntryMinor||
        decision.disposition!=='PAPER_ADMIT'))
        throw Error('MEME_PAPER_JOURNAL_SETTLEMENT_BINDING_MISMATCH')
      return Object.freeze({decision,receipt})
    },
    async appendDecision(input:MemeWalletPaperDecision){
      const row=parseDecision(JSON.parse(encoded(input)))
      if(row.proposedEntryMinor<=0n)throw Error('MEME_PAPER_JOURNAL_ENTRY_INVALID')
      const result=await db.query(
        `INSERT INTO runpod_meme_wallet_paper_decisions(
          decision_id,wallet_id,candidate_case_id,disposition,proposed_entry_minor,
          decision_json,authority,can_sign,can_execute,can_move_money
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,'PAPER_SIMULATION_ONLY',false,false,false)
         ON CONFLICT DO NOTHING RETURNING decision_id`,
        [row.decisionId,row.walletId,row.candidateCaseId,row.disposition,
         row.proposedEntryMinor.toString(),encoded(row)])
      // An exact retry should use getByCase and recover existing row, not
      // claim an INSERT after a database race or mutate prior research.
      if(result.rowCount!==1)throw Error('MEME_PAPER_JOURNAL_CONFLICT_RETRY_READ')
    },
    async appendReceipt(input:MemeWalletPaperReceipt){
      const row=parseReceipt(JSON.parse(encoded(input)))
      const result=await db.query(
        `INSERT INTO runpod_meme_wallet_paper_receipts(
           decision_id,receipt_state,receipt_json,simulated_at,authority,can_execute
         ) VALUES($1,$2,$3::jsonb,$4,'SIMULATED_SETTLEMENT_ONLY',false)
         ON CONFLICT DO NOTHING RETURNING decision_id`,
        [row.decisionId,row.state,encoded(row),row.observedAt])
      if(result.rowCount!==1)throw Error('MEME_PAPER_JOURNAL_SETTLEMENT_CONFLICT')
    },
  })
}

/** Must be called before any paper record insert; never run with SHARK/Coffer
 * executor credentials. This checks DB privileges but not network isolation. */
export async function assertMemeWalletPaperDbRole(db:MemeWalletPaperSql){
  const q=await db.query(`
    SELECT current_user AS role_name,r.rolsuper AS is_superuser,
      r.rolcreaterole AS can_create_role,r.rolcreatedb AS can_create_db,
      has_schema_privilege(current_user,'public','CREATE') AS can_create_schema,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_decisions','SELECT') AS can_read_decisions,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_decisions','INSERT') AS can_insert_decisions,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_receipts','SELECT') AS can_read_receipts,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_receipts','INSERT') AS can_insert_receipts,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_decisions','UPDATE,DELETE,TRUNCATE') AS can_mutate_decisions,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_receipts','UPDATE,DELETE,TRUNCATE') AS can_mutate_receipts,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p')
        AND c.relname NOT IN ('runpod_meme_wallet_paper_decisions','runpod_meme_wallet_paper_receipts',
          'runpod_meme_wallet_paper_cycle_claims','runpod_meme_wallet_paper_halts')
        AND has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
      ) AS can_mutate_other_money
    FROM pg_roles r WHERE r.rolname=current_user`)
  const x=q.rows[0]
  if(q.rows.length!==1||!x||typeof x.role_name!=='string'||
    x.is_superuser!==false||x.can_create_role!==false||x.can_create_db!==false||
    x.can_create_schema!==false||x.can_read_decisions!==true||x.can_insert_decisions!==true||
    x.can_read_receipts!==true||x.can_insert_receipts!==true||
    x.can_mutate_decisions!==false||x.can_mutate_receipts!==false||
    x.can_mutate_other_money!==false)throw Error('MEME_PAPER_DATABASE_ROLE_UNSAFE')
  return Object.freeze({admitted:true as const,canSign:false as const,
    canExecute:false as const,financialAuthority:'NONE' as const})
}

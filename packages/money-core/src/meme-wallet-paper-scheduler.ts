import { createHash } from 'node:crypto'
import type { MemeWalletPaperState } from './meme-wallet-paper-gate.js'
import { assertMemeWalletPaperDbRole, type MemeWalletPaperSql } from './meme-wallet-postgres-paper-journal.js'

/** MEME-WALLET.13–.15: research-only at-most-once scheduler claim, a
 * persistent kill latch and conservative budget recovery from the paper
 * journal. Neither service calls a wallet or grants any signing authority.
 */
const str=(value:unknown):value is string=>typeof value==='string'&&value.length>0
const UTC_DAY=/^\d{4}-\d{2}-\d{2}$/
const MAX_DAY_ROWS=1000
function boundedDay(day:string){
  if(!UTC_DAY.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00.000Z'))||
    new Date(day+'T00:00:00.000Z').toISOString().slice(0,10)!==day)
    throw Error('MEME_PAPER_UTC_DAY_INVALID')
  return [day+'T00:00:00.000Z',new Date(Date.parse(day+'T00:00:00.000Z')+86400000).toISOString()]
}
export function memePaperSlotId(walletId:string,now:string){
  const when=Date.parse(now)
  if(!str(walletId)||!Number.isFinite(when))throw Error('MEME_PAPER_SLOT_INPUT_INVALID')
  const bucket=new Date(Math.floor(when/60000)*60000).toISOString()
  const digest=createHash('sha256').update(JSON.stringify([walletId,bucket])).digest('hex')
  return Object.freeze({claimId:'meme-paper-slot:'+digest,minute:bucket})
}
function paperHaltId(walletId:string,reason:string,at:string){
  return 'paper-halt:'+createHash('sha256').update(JSON.stringify([walletId,reason,at])).digest('hex')
}
export async function isMemePaperHalted(db:MemeWalletPaperSql,walletId:string){
  if(!str(walletId))throw Error('MEME_PAPER_WALLET_REQUIRED')
  const result=await db.query(
    `SELECT halt_id FROM runpod_meme_wallet_paper_halts WHERE wallet_id=$1 LIMIT 1`,
    [walletId],
  )
  return result.rows.length>0
}
export async function haltMemeWalletPaper(db:MemeWalletPaperSql,input:Readonly<{
  walletId:string;reason:string;now:string
}>){
  if(!str(input.walletId)||!str(input.reason)||input.reason.length>128||
    !Number.isFinite(Date.parse(input.now)))throw Error('MEME_PAPER_HALT_INVALID')
  const haltId=paperHaltId(input.walletId,input.reason,input.now)
  await db.query(
    `INSERT INTO runpod_meme_wallet_paper_halts
      (halt_id,wallet_id,reason_code,requested_at,authority,can_execute)
     VALUES ($1,$2,$3,$4,'PAPER_HALT_ONLY',false)
     ON CONFLICT DO NOTHING`,
    [haltId,input.walletId,input.reason,input.now],
  )
  if(!await isMemePaperHalted(db,input.walletId))
    throw Error('MEME_PAPER_HALT_NOT_DURABLE')
  return Object.freeze({haltId,halted:true as const,canExecute:false as const})
}
export async function claimMemeWalletPaperCycle(db:MemeWalletPaperSql,input:Readonly<{
  walletId:string;ownerPolicyId:string;sourceBatchId:string;now:string
}>){
  const {claimId,minute}=memePaperSlotId(input.walletId,input.now)
  const day=minute.slice(0,10)
  if(!str(input.ownerPolicyId)||!str(input.sourceBatchId)||
    input.sourceBatchId.length>256)throw Error('MEME_PAPER_CLAIM_IDENTITY_INVALID')
  if(await isMemePaperHalted(db,input.walletId))
    throw Error('MEME_PAPER_PERSISTENT_HALT')
  const result=await db.query(
    `INSERT INTO runpod_meme_wallet_paper_cycle_claims
       (claim_id,wallet_id,utc_minute,utc_day,owner_policy_id,source_batch_id,authority,can_execute)
     VALUES ($1,$2,$3,$4,$5,$6,'PAPER_CYCLE_CLAIM_ONLY',false)
     ON CONFLICT DO NOTHING RETURNING claim_id`,
    [claimId,input.walletId,minute,day,input.ownerPolicyId,input.sourceBatchId],
  )
  if(result.rowCount!==1 || result.rows[0]?.claim_id!==claimId)
    throw Error('MEME_PAPER_SLOT_ALREADY_CLAIMED')
  // Halt can be inserted concurrently with claiming. Recheck before any
  // further paper proposal is admitted. A consumed slot stays consumed.
  if(await isMemePaperHalted(db,input.walletId))
    throw Error('MEME_PAPER_HALTED_AFTER_CLAIM')
  return Object.freeze({
    claimId,minute,utcDay:day,
    status:'PAPER_SLOT_CLAIMED' as const,
    canExecute:false as const,
    canRetryAutomatically:false as const,
  })
}
export type MemePaperRecovery=Readonly<{
  state:MemeWalletPaperState
  candidates:number
  blocked:number
  simulatedFailed:number
  simulatedFilled:number
  simulatedUnknown:number
  pending:number
  costMinor:bigint
  realizedProfitMinor:null
  drawdownBps:null
  performanceCertified:false
  authority:'PAPER_JOURNAL_OBSERVATION_ONLY'
  canExecute:false
}>
/**
 * Paper journal snapshots do not contain marked-to-market valuations or
 * proven exits. Treat ANY filled/unknown/pending entry as unresolved; never
 * release gross exposure or advertise realized profit without a separate
 * immutable exit/valuation research protocol.
 */
export async function recoverMemePaperDay(db:MemeWalletPaperSql,input:Readonly<{
  walletId:string;utcDay:string
}>):Promise<MemePaperRecovery>{
  if(!str(input.walletId))throw Error('MEME_PAPER_WALLET_REQUIRED')
  const [from,through]=boundedDay(input.utcDay)
  const [rows,halted,olderUnresolved]=await Promise.all([
    db.query(
      `SELECT d.decision_json,r.receipt_json FROM runpod_meme_wallet_paper_decisions d
       LEFT JOIN runpod_meme_wallet_paper_receipts r ON r.decision_id=d.decision_id
       WHERE d.wallet_id=$1 AND d.created_at >= $2 AND d.created_at < $3
       ORDER BY d.created_at ASC,d.decision_id ASC LIMIT $4`,
      [input.walletId,from,through,MAX_DAY_ROWS+1],
    ),
    isMemePaperHalted(db,input.walletId),
    db.query(
      `SELECT d.decision_id FROM runpod_meme_wallet_paper_decisions d
       LEFT JOIN runpod_meme_wallet_paper_receipts r ON r.decision_id=d.decision_id
       WHERE d.wallet_id=$1 AND d.created_at < $2 AND d.disposition='PAPER_ADMIT'
         AND (r.decision_id IS NULL OR r.receipt_state IN ('PAPER_UNKNOWN','PAPER_FILLED'))
       ORDER BY d.created_at ASC LIMIT 1`,[input.walletId,from],
    ),
  ])
  if(rows.rows.length>MAX_DAY_ROWS)throw Error('MEME_PAPER_RECOVERY_TRUNCATED')
  const seen=new Set<string>()
  let spent=0n,orders=0,blocked=0,failed=0,filled=0,unknown=0,pending=0,cost=0n
  const unresolved:string[]=[]
  for(const row of rows.rows){
    const d=row.decision_json as Record<string,unknown>|undefined
    if(!d||!str(d.decisionId)||!str(d.walletId)||d.walletId!==input.walletId||
      seen.has(d.decisionId)||d.authority!=='PAPER_SIMULATION_ONLY'||
      d.canExecute!==false||d.canSign!==false||d.canMoveMoney!==false||
      d.signerLeaseId!==null||d.executionPermitId!==null)
      throw Error('MEME_PAPER_RECOVERY_DECISION_TAMPER')
    seen.add(d.decisionId)
    if(d.disposition==='PAPER_BLOCK'){
      if(row.receipt_json!==null&&row.receipt_json!==undefined)
        throw Error('MEME_PAPER_RECOVERY_BLOCKED_SETTLEMENT')
      blocked++;continue
    }
    if(d.disposition!=='PAPER_ADMIT'||typeof d.proposedEntryMinor!=='string'||
      !/^\d+$/.test(d.proposedEntryMinor)||BigInt(d.proposedEntryMinor)<=0n)
      throw Error('MEME_PAPER_RECOVERY_DECISION_INVALID')
    const amount=BigInt(d.proposedEntryMinor)
    spent+=amount;orders++
    const receipt=row.receipt_json as Record<string,unknown>|null|undefined
    if(receipt===null||receipt===undefined){pending++;unresolved.push(d.decisionId);continue}
    if(receipt.decisionId!==d.decisionId||receipt.authority!=='SIMULATED_SETTLEMENT_ONLY'||
      receipt.canExecute!==false||receipt.inputMinor!==d.proposedEntryMinor||
      typeof receipt.simulatedFeeMinor!=='string'||!/^\d+$/.test(receipt.simulatedFeeMinor))
      throw Error('MEME_PAPER_RECOVERY_SETTLEMENT_TAMPER')
    cost+=BigInt(receipt.simulatedFeeMinor)
    if(receipt.state==='PAPER_FAILED'){
      if(receipt.outputAtomic!==null)throw Error('MEME_PAPER_RECOVERY_FAILED_OUTPUT_INVALID')
      failed++
    }else if(receipt.state==='PAPER_UNKNOWN'){
      if(receipt.outputAtomic!==null)throw Error('MEME_PAPER_RECOVERY_UNKNOWN_OUTPUT_INVALID')
      unknown++;unresolved.push(d.decisionId)
    }else if(receipt.state==='PAPER_FILLED'){
      if(typeof receipt.outputAtomic!=='string'||!/^\d+$/.test(receipt.outputAtomic))
        throw Error('MEME_PAPER_RECOVERY_FILLED_OUTPUT_INVALID')
      filled++;unresolved.push(d.decisionId)
    }else throw Error('MEME_PAPER_RECOVERY_RECEIPT_STATE_INVALID')
  }
  // Prior-day paper fills still represent open simulated inventory. Since an
  // exit/cost basis ledger is not commissioned, they block new admission.
  const older=olderUnresolved.rows[0]?.decision_id
  if(older!==undefined){
    if(!str(older))throw Error('MEME_PAPER_RECOVERY_PRIOR_OUTCOME_INVALID')
    unresolved.push(older)
  }
  return Object.freeze({
    state:Object.freeze({
      day:input.utcDay,enteredMinor:spent,grossExposureMinor:spent,
      realizedLossMinor:0n,orders,unresolvedIds:Object.freeze(unresolved),halted,
    }),
    candidates:rows.rows.length,blocked,simulatedFailed:failed,
    simulatedFilled:filled,simulatedUnknown:unknown,pending,costMinor:cost,
    realizedProfitMinor:null,drawdownBps:null,
    performanceCertified:false,authority:'PAPER_JOURNAL_OBSERVATION_ONLY',
    canExecute:false,
  })
}

/** Must pass against real restricted DB before any scheduler claim. */
export async function assertMemePaperSchedulerDbRole(db:MemeWalletPaperSql){
  await assertMemeWalletPaperDbRole(db)
  const result=await db.query(`
    SELECT
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_cycle_claims','SELECT') AS claims_read,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_cycle_claims','INSERT') AS claims_insert,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_cycle_claims','UPDATE,DELETE,TRUNCATE') AS claims_mutate,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_halts','SELECT') AS halts_read,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_halts','INSERT') AS halts_insert,
      has_table_privilege(current_user,'public.runpod_meme_wallet_paper_halts','UPDATE,DELETE,TRUNCATE') AS halts_mutate
  `)
  const v=result.rows[0]
  if(result.rows.length!==1||!v||v.claims_read!==true||v.claims_insert!==true||
    v.claims_mutate!==false||v.halts_read!==true||v.halts_insert!==true||
    v.halts_mutate!==false)throw Error('MEME_PAPER_SCHEDULER_DATABASE_ROLE_UNSAFE')
  return Object.freeze({checked:true as const,canExecute:false as const,
    authority:'PAPER_ONLY_ROLE_ADMISSION' as const})
}

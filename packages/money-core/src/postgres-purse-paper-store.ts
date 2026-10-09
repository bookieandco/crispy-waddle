import {createHash} from 'node:crypto'
import type {SqlClient} from './postgres-idempotency-store.js'
import type {PursePaperCycle,PursePaperCycleStore,PursePaperLease} from './purse-paper-autonomy.js'

const json=(x:unknown)=>JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)
const digest=(x:unknown)=>createHash('sha256').update(json(x)).digest('hex')
const valid=(s:string)=>Boolean(s)&&!Number.isNaN(Date.parse(s))
const cycleEconomics=(x:PursePaperCycle)=>({
 cycleId:x.cycleId,charterId:x.charterId,portfolioSnapshotId:x.portfolioSnapshotId,allocationPlanId:x.allocationPlanId,
 decisionSetId:x.decisionSetId,rebalancePlanId:x.rebalancePlanId,informationCutoff:x.informationCutoff,
 createdAt:x.createdAt,expiresAt:x.expiresAt,paperIntents:x.paperIntents,rejectedOpportunityIds:x.rejectedOpportunityIds,
 learningProfileIds:x.learningProfileIds,evidenceIds:x.evidenceIds,status:x.status,authority:x.authority,
 canExecute:x.canExecute,canSign:x.canSign,canBroadcast:x.canBroadcast,canMoveMoney:x.canMoveMoney,
})
export function fingerprintPursePaperCycle(x:PursePaperCycle):string{return digest(cycleEconomics(x))}
export type PursePaperLedgerReadback=Readonly<{
 cycleId:string
 economicSha256:string
 ownerUserId:string
 workerId:string
 fencingToken:number
 recordedAt:string
 matching:boolean
 authority:'PAPER_LEDGER_READBACK_ONLY'
 canExecute:false
}>
type CycleRow={cycle_id:string;user_id:string;worker_id:string;fencing_token:string|number;economic_sha256:string;payload_json:unknown;recorded_at:string|Date;authority:string;can_execute:boolean;can_sign:boolean;can_broadcast:boolean;can_move_money:boolean}
type LeaseRow={charter_id:string;user_id:string;worker_id:string;fencing_token:string|number;acquired_at:string|Date;expires_at:string|Date;evidence_ids:string[]}
const iso=(x:string|Date)=>x instanceof Date?x.toISOString():new Date(x).toISOString()

/** Use only a trusted internal SQL client; no browser callable mutation endpoint. */
export class PostgresPursePaperStore implements PursePaperCycleStore{
 constructor(private readonly sql:SqlClient,private readonly userId:string){
  if(!userId?.trim())throw new Error('PURSE_STORE_OWNER_REQUIRED')
 }
 async acquireLease(x:{charterId:string;workerId:string;acquiredAt:string;expiresAt:string;evidenceIds:readonly string[]}):Promise<PursePaperLease>{
  if(!x.charterId||!x.workerId||!x.evidenceIds.length||!valid(x.acquiredAt)||!valid(x.expiresAt)||x.expiresAt<=x.acquiredAt)throw new Error('PURSE_STORE_LEASE_INPUT_INVALID')
  const q=await this.sql.query<LeaseRow>(`
   INSERT INTO public.money_purse_paper_leases
    (charter_id,user_id,worker_id,fencing_token,acquired_at,expires_at,evidence_ids)
   SELECT charter_id,user_id,$3,1,$4,$5,$6
   FROM public.money_purse_charters WHERE charter_id=$1 AND user_id=$2 AND autonomy_mode IN ('PAPER_AUTONOMOUS','SHADOW_AUTONOMOUS')
   ON CONFLICT (charter_id) DO UPDATE SET
    worker_id=EXCLUDED.worker_id,
    fencing_token=public.money_purse_paper_leases.fencing_token+1,
    acquired_at=EXCLUDED.acquired_at,expires_at=EXCLUDED.expires_at,evidence_ids=EXCLUDED.evidence_ids
   WHERE public.money_purse_paper_leases.user_id=EXCLUDED.user_id
     AND public.money_purse_paper_leases.expires_at<=EXCLUDED.acquired_at
   RETURNING charter_id,user_id,worker_id,fencing_token,acquired_at,expires_at,evidence_ids
  `,[x.charterId,this.userId,x.workerId,x.acquiredAt,x.expiresAt,[...x.evidenceIds]])
  if(q.rows.length!==1)throw new Error('PURSE_STORE_LEASE_BUSY_OR_UNAUTHORIZED')
  const row=q.rows[0]!
  return Object.freeze({workerId:row.worker_id,fencingToken:Number(row.fencing_token),acquiredAt:iso(row.acquired_at),expiresAt:iso(row.expires_at),evidenceIds:Object.freeze([...row.evidence_ids]),authority:'PAPER_LEASE_EVIDENCE_ONLY' as const})
 }
 private async checkLease(cycle:PursePaperCycle){
  const lease=await this.sql.query<{fencing_token:string|number}>(`
   SELECT fencing_token FROM public.money_purse_paper_leases
   WHERE charter_id=$1 AND user_id=$2 AND worker_id=$3 AND fencing_token=$4
     AND acquired_at<=$5 AND expires_at>$5 AND expires_at>=$6
  `,[cycle.charterId,this.userId,cycle.workerId,cycle.leaseFencingToken,cycle.createdAt,cycle.expiresAt])
  if(lease.rows.length!==1)throw new Error('PURSE_STORE_FENCING_OR_LEASE_EXPIRED')
 }
 async appendOnce(cycle:PursePaperCycle):Promise<'INSERTED'|'REPLAY'>{
  if(cycle.authority!=='PAPER_CYCLE_ONLY'||cycle.status!=='PAPER_PLANNED'||cycle.canExecute!==false||
     cycle.canSign!==false||cycle.canBroadcast!==false||cycle.canMoveMoney!==false||!cycle.cycleId||!cycle.charterId||!cycle.workerId||
     !cycle.evidenceIds.length||!Number.isSafeInteger(cycle.leaseFencingToken)||cycle.leaseFencingToken<=0||
     !valid(cycle.createdAt)||!valid(cycle.expiresAt)||!valid(cycle.informationCutoff))throw new Error('PURSE_STORE_PAPER_CYCLE_INVALID')
  await this.checkLease(cycle)
  const sha=fingerprintPursePaperCycle(cycle)
  const payload=json(cycleEconomics(cycle))
  const write=await this.sql.query<{cycle_id:string}>(`
   INSERT INTO public.money_purse_paper_cycles
    (cycle_id,charter_id,user_id,worker_id,fencing_token,economic_sha256,payload_json,information_cutoff,created_at_evidence,expires_at)
   SELECT $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10
   FROM public.money_purse_paper_leases
   WHERE charter_id=$2 AND user_id=$3 AND worker_id=$4 AND fencing_token=$5
     AND acquired_at<=$9 AND expires_at>$9 AND expires_at>=$10
   ON CONFLICT (cycle_id) DO NOTHING RETURNING cycle_id
  `,[cycle.cycleId,cycle.charterId,this.userId,cycle.workerId,cycle.leaseFencingToken,sha,payload,cycle.informationCutoff,cycle.createdAt,cycle.expiresAt])
  if(write.rows.length===1)return 'INSERTED'
  const old=await this.sql.query<CycleRow>(`SELECT cycle_id,user_id,worker_id,fencing_token,economic_sha256,payload_json,recorded_at,authority,can_execute,can_sign,can_broadcast,can_move_money FROM public.money_purse_paper_cycles WHERE cycle_id=$1 AND user_id=$2`,[cycle.cycleId,this.userId])
  if(old.rows.length!==1)throw new Error('PURSE_STORE_CONCURRENT_LEASE_REVOKED')
  if(old.rows[0]!.economic_sha256!==sha||digest(old.rows[0]!.payload_json)!==sha)throw new Error('PURSE_STORE_ECONOMIC_REPLAY_CONFLICT')
  return 'REPLAY'
 }
 async readBack(cycle:PursePaperCycle):Promise<PursePaperLedgerReadback>{
  const q=await this.sql.query<CycleRow>(`SELECT cycle_id,user_id,worker_id,fencing_token,economic_sha256,payload_json,recorded_at,authority,can_execute,can_sign,can_broadcast,can_move_money FROM public.money_purse_paper_cycles WHERE cycle_id=$1 AND user_id=$2`,[cycle.cycleId,this.userId])
  if(q.rows.length!==1)throw new Error('PURSE_STORE_READBACK_MISSING')
  const row=q.rows[0]!
  const expected=fingerprintPursePaperCycle(cycle)
  const matching=row.economic_sha256===expected&&digest(row.payload_json)===expected&&row.authority==='PAPER_CYCLE_ONLY'&&
     row.can_execute===false&&row.can_sign===false&&row.can_broadcast===false&&row.can_move_money===false
  if(!matching)throw new Error('PURSE_STORE_READBACK_INTEGRITY_FAILED')
  return Object.freeze({cycleId:row.cycle_id,economicSha256:expected,ownerUserId:row.user_id,workerId:row.worker_id,
   fencingToken:Number(row.fencing_token),recordedAt:iso(row.recorded_at),matching,authority:'PAPER_LEDGER_READBACK_ONLY' as const,canExecute:false as const})
 }
}

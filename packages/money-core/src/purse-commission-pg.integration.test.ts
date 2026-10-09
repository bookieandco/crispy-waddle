import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {Pool} from 'pg'
import {PostgresPursePaperStore} from './postgres-purse-paper-store.js'
import type {PursePaperCycle} from './purse-paper-autonomy.js'
import type {SqlClient} from './postgres-idempotency-store.js'

const pgUrl=process.env.PURSE_EPHEMERAL_PG_TEST_URL
if(!pgUrl){test('PURSE-COMMISSION ephemeral PostgreSQL', {skip:'PURSE_EPHEMERAL_PG_TEST_URL not supplied'},()=>{})}
else test('PURSE-COMMISSION.01 actual ephemeral PostgreSQL enforces fencing, client reconnection and immutable replay',async()=>{
 const user='purse-ci-'+randomUUID()
 const coffer='coffer-'+randomUUID()
 const charter='charter-'+randomUUID()
 const now=new Date()
 const iso=(deltaMs:number)=>new Date(now.getTime()+deltaMs).toISOString()
 const pool=new Pool({connectionString:pgUrl,max:3})
 let conn:Pool|undefined
 try{
  await pool.query(`INSERT INTO public.money_coffers(coffer_id,user_id,currency,principal_capital_minor,hard_stop_floor_minor,survival_floor_minor,defensive_floor_minor,state)
   VALUES($1,$2,'USD',100000,100,200,500,'ACTIVE')`,[coffer,user])
  await pool.query(`INSERT INTO public.money_purse_charters(charter_id,charter_version,user_id,coffer_id,reporting_currency,autonomy_mode,verified_owner_payout_destination_id,config_json,effective_at,evidence_ids)
   VALUES($1,'v1',$2,$3,'USD','PAPER_AUTONOMOUS','owner-bank:test','{}'::jsonb,$4,ARRAY['owner:test'])`,[charter,user,coffer,iso(-60000)])
  const store=new PostgresPursePaperStore(pool as SqlClient,user)
  const lease=await store.acquireLease({charterId:charter,workerId:'ci-worker-a',acquiredAt:iso(-1000),expiresAt:iso(120000),evidenceIds:['ci:fence:1']})
  assert.equal(lease.fencingToken,1)
  await assert.rejects(store.acquireLease({charterId:charter,workerId:'ci-worker-b',acquiredAt:iso(-1000),expiresAt:iso(120000),evidenceIds:['ci:fence:2']}),/LEASE_BUSY/)
  const cycle:PursePaperCycle={cycleId:'paper-economics:'+randomUUID(),charterId:charter,portfolioSnapshotId:'portfolio:test',
   allocationPlanId:'plan:test',decisionSetId:'decision:test',rebalancePlanId:'rebalance:test',workerId:lease.workerId,
   leaseFencingToken:lease.fencingToken,informationCutoff:iso(-2000),createdAt:iso(0),expiresAt:iso(30000),
   paperIntents:[],rejectedOpportunityIds:[],learningProfileIds:[],evidenceIds:['ci:verified:source'],
   status:'PAPER_PLANNED',authority:'PAPER_CYCLE_ONLY',canExecute:false,canSign:false,canBroadcast:false,canMoveMoney:false}
  assert.equal(await store.appendOnce(cycle),'INSERTED')
  assert.equal(await store.appendOnce(cycle),'REPLAY')
  conn=new Pool({connectionString:pgUrl,max:1})
  const second=new PostgresPursePaperStore(conn as SqlClient,user)
  assert.equal((await second.readBack(cycle)).matching,true)
  assert.equal(await second.appendOnce(cycle),'REPLAY')
  await assert.rejects(second.appendOnce({...cycle,learningProfileIds:['tampered']}),/REPLAY_CONFLICT/)
  const other=new PostgresPursePaperStore(conn as SqlClient,'another-user')
  await assert.rejects(other.appendOnce(cycle),/FENCING_OR_LEASE_EXPIRED/)
  await pool.query(`UPDATE public.money_purse_paper_leases SET expires_at=clock_timestamp()-interval '1 second' WHERE charter_id=$1`,[charter])
  await assert.rejects(store.appendOnce(cycle),/FENCING_OR_LEASE_EXPIRED/)
  const later=await store.acquireLease({charterId:charter,workerId:'ci-worker-c',
   acquiredAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),evidenceIds:['ci:fence:3']})
  assert.equal(later.fencingToken,2)
  const sameEconomic={...cycle,workerId:later.workerId,leaseFencingToken:later.fencingToken}
  assert.equal(await store.appendOnce(sameEconomic),'REPLAY')
  await pool.query(`UPDATE public.money_purse_paper_cycles SET economic_sha256=repeat('0',64) WHERE cycle_id=$1`,[cycle.cycleId])
  await assert.rejects(second.readBack(cycle),/READBACK_INTEGRITY_FAILED/)
 }finally{
  await conn?.end()
  await pool.query('DELETE FROM public.money_purse_paper_cycles WHERE charter_id=$1',[charter])
  await pool.query('DELETE FROM public.money_purse_paper_leases WHERE charter_id=$1',[charter])
  await pool.query('DELETE FROM public.money_purse_charters WHERE charter_id=$1',[charter])
  await pool.query('DELETE FROM public.money_coffers WHERE coffer_id=$1',[coffer])
  await pool.end()
 }
})

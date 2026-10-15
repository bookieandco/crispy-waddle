import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMemeWalletPostgresPaperJournal,type MemeWalletPaperSql,
} from './meme-wallet-postgres-paper-journal.js'
import {
  claimMemeWalletPaperCycle,haltMemeWalletPaper,recoverMemePaperDay,
} from './meme-wallet-paper-scheduler.js'
import {
  memePaperSourceDigest,runMemeWalletPaperDailyCycle,
  type MemeWalletPaperSourceBatch,
} from './meme-wallet-paper-daily-cycle.js'
import type { MemeWalletCandidate,MemeWalletPaperPolicy } from './meme-wallet-paper-gate.js'
const wallet='So11111111111111111111111111111111111111112'
const mint='11111111111111111111111111111111'
const at='2026-10-14T22:00:05.000Z'
const candidate=(id:string):MemeWalletCandidate=>({
  caseId:id,strategyId:'SHARK_PAPER_ONLY',tokenMint:wallet,quoteMint:mint,
  observedAt:'2026-10-14T22:00:01.000Z',
  quoteReceivedAt:'2026-10-14T22:00:03.000Z',
  evidenceIds:['shark:assessment:one','chain:sell-probe:one'],
  liquidityVerified:true,sellabilityVerified:true,
  tokenPermissionsSafe:true,holderConcentrationSafe:true,
  rugVeto:false,expectedSlippageBps:50,estimatedTotalCostsMinor:4n,
  authority:'SHARK_RESEARCH_ONLY',canAuthorizeTrade:false,
})
const policy:MemeWalletPaperPolicy={
  policyId:'OWNER_PAPER_POLICY_1',ownerReview:'APPROVED_FOR_PAPER_ONLY',
  paperOnly:true,liveExecutionEnabled:false,
  maxPaperEntryMinor:100n,maxPaperDailyNotionalMinor:200n,
  maxPaperGrossExposureMinor:100n,maxPaperDailyLossMinor:50n,
  maxPaperOrdersPerDay:1,maxSlippageBps:100,maxQuoteAgeMs:10000,
  allowedQuoteMints:[mint],authority:'PAPER_RISK_POLICY_ONLY',
}
function dbFixture(){
  const decisions=new Map<string,{id:string;wallet:string;caseId:string;body:Record<string,unknown>}>()
  const receipts=new Map<string,Record<string,unknown>>()
  const claims=new Map<string,{wallet:string;day:string;id:string}>()
  const halts=new Set<string>()
  const calls:string[]=[]
  const privilege={
    role_name:'meme_paper_worker',is_superuser:false,can_create_role:false,
    can_create_db:false,can_create_schema:false,can_read_decisions:true,
    can_insert_decisions:true,can_read_receipts:true,can_insert_receipts:true,
    can_mutate_decisions:false,can_mutate_receipts:false,
    can_mutate_other_money:false,
  }
  const db:MemeWalletPaperSql={async query(sql,params=[]){
    calls.push(sql)
    if(sql.includes('FROM pg_roles r'))return{rows:[privilege],rowCount:1}
    if(sql.includes(' AS claims_read'))return{rows:[{
      claims_read:true,claims_insert:true,claims_mutate:false,
      halts_read:true,halts_insert:true,halts_mutate:false,
    }],rowCount:1}
    if(sql.includes('SELECT halt_id FROM runpod_meme_wallet_paper_halts')){
      const yes=halts.has(String(params[0]))
      return{rows:yes?[{halt_id:'halted'}]:[],rowCount:yes?1:0}
    }
    if(sql.includes('INSERT INTO runpod_meme_wallet_paper_halts')){
      halts.add(String(params[1]));return{rows:[],rowCount:1}
    }
    if(sql.includes('INSERT INTO runpod_meme_wallet_paper_cycle_claims')){
      const key=String(params[1])+'|'+String(params[3])
      if(claims.has(key))return{rows:[],rowCount:0}
      claims.set(key,{wallet:String(params[1]),day:String(params[3]),id:String(params[0])})
      return{rows:[{claim_id:params[0]}],rowCount:1}
    }
    if(sql.startsWith('SELECT d.decision_json,r.receipt_json FROM')){
      const daily=sql.includes('d.created_at')
      const matching=[...decisions.values()].filter(v=>
        v.wallet===params[0] &&
        (daily?String(params[1])==='2026-10-14T00:00:00.000Z':v.caseId===params[1]))
      const results=matching.map(v=>({decision_json:v.body,receipt_json:receipts.get(v.id)??null}))
      return{rows:sql.includes('LIMIT $4')?results:results.slice(0,1),rowCount:results.length}
    }
    if(sql.includes('SELECT d.decision_id FROM runpod_meme_wallet_paper_decisions')){
      return{rows:[],rowCount:0}
    }
    if(sql.includes('INSERT INTO runpod_meme_wallet_paper_decisions')){
      const id=String(params[0]);const wallet=String(params[1]),caseId=String(params[2])
      if(decisions.has(id)||[...decisions.values()].some(v=>v.wallet===wallet&&v.caseId===caseId))
        return{rows:[],rowCount:0}
      decisions.set(id,{id,wallet,caseId,body:JSON.parse(String(params[5]))})
      return{rows:[{decision_id:id}],rowCount:1}
    }
    if(sql.includes('INSERT INTO runpod_meme_wallet_paper_receipts')){
      receipts.set(String(params[0]),JSON.parse(String(params[2])))
      return{rows:[{decision_id:params[0]}],rowCount:1}
    }
    throw Error('UNEXPECTED_SQL:'+sql.slice(0,50))
  }}
  return {db,claims,decisions,receipts,halts,calls}
}
function inputs(db:MemeWalletPaperSql,requests:MemeWalletCandidate[]=[candidate('shark:1'),candidate('shark:2')]){
  const base={batchId:'persisted:assessment-batch:1',availableAt:'2026-10-14T22:00:04.000Z',candidates:requests}
  const batch:MemeWalletPaperSourceBatch={
    ...base,contentHash:memePaperSourceDigest(base),
    authority:'PERSISTED_SHARK_RESEARCH_BATCH_ONLY',canExecute:false,
  }
  return{
    db,journal:createMemeWalletPostgresPaperJournal(db),
    walletAddress:wallet,otherOwnerAddresses:[],cofferAddresses:[],
    phantomMcpAddresses:[],policy,batch,entryMinor:100n,
    now:at,commissionedPaperOnly:true,ownerApprovalReference:'test-owner-paper-only',
  }
}
test('daily paper cycle accepts at most one entry; second candidate is blocked until exit evidence',async()=>{
  const fx=dbFixture()
  const out=await runMemeWalletPaperDailyCycle(inputs(fx.db))
  assert.equal(out.admitted,1)
  assert.equal(out.blocked,1)
  assert.equal(out.evaluated,2)
  assert.equal(out.canExecute,false)
  assert.equal(out.canFund,false)
  assert.equal(fx.claims.size,1)
  assert.equal(fx.decisions.size,2)
  const snap=await recoverMemePaperDay(fx.db,{
    walletId:'jhadina-owner-created:solana:'+wallet,utcDay:'2026-10-14',
  })
  assert.equal(snap.state.enteredMinor,100n)
  assert.equal(snap.state.unresolvedIds.length,1)
  assert.equal(snap.realizedProfitMinor,null)
  assert.equal(snap.performanceCertified,false)
  await assert.rejects(runMemeWalletPaperDailyCycle(inputs(fx.db)),/MEME_PAPER_SLOT_ALREADY_CLAIMED/)
  assert.equal(fx.decisions.size,2)
  assert.ok(fx.calls.every(sql=>!/\bexecuteSigned\b|\bsignVersionedTransaction\b/.test(sql)))
})
test('halt is durable and prevents a new daily paper claim after restart',async()=>{
  const fx=dbFixture()
  const id='jhadina-owner-created:solana:'+wallet
  const latch=await haltMemeWalletPaper(fx.db,{walletId:id,reason:'OWNER_KILL',now:at})
  assert.equal(latch.halted,true)
  await assert.rejects(runMemeWalletPaperDailyCycle(inputs(fx.db)),/MEME_PAPER_PERSISTENT_HALT/)
  assert.equal(fx.claims.size,0)
})
test('input integrity, paper approval and stale feed fail before claiming a day',async()=>{
  const fx=dbFixture();const base=inputs(fx.db)
  await assert.rejects(runMemeWalletPaperDailyCycle({
    ...base,commissionedPaperOnly:false,
  }),/MEME_PAPER_OWNER_COMMISSIONING_REQUIRED/)
  await assert.rejects(runMemeWalletPaperDailyCycle({
    ...base,batch:{...base.batch,contentHash:'0'.repeat(64)},
  }),/MEME_PAPER_SOURCE_BATCH_INVALID/)
  await assert.rejects(runMemeWalletPaperDailyCycle({
    ...base,batch:{...base.batch,availableAt:'2026-10-14T21:00:04.000Z',
      contentHash:memePaperSourceDigest({...base.batch,availableAt:'2026-10-14T21:00:04.000Z'})},
  }),/MEME_PAPER_SOURCE_BATCH_STALE/)
  assert.equal(fx.claims.size,0)
})
test('claimed daily slot cannot be silently replayed at another minute',async()=>{
  const fx=dbFixture();const id='jhadina-owner-created:solana:'+wallet
  const first=await claimMemeWalletPaperCycle(fx.db,{
    walletId:id,ownerPolicyId:'paper',sourceBatchId:'batch1',now:at,
  })
  assert.equal(first.canRetryAutomatically,false)
  await assert.rejects(claimMemeWalletPaperCycle(fx.db,{
    walletId:id,ownerPolicyId:'paper',sourceBatchId:'batch2',
    now:'2026-10-14T22:07:00.000Z',
  }),/MEME_PAPER_SLOT_ALREADY_CLAIMED/)
  assert.equal(fx.claims.size,1)
})

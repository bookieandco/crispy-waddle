import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemeWalletPostgresPaperJournal,assertMemeWalletPaperDbRole,type MemeWalletPaperSql } from './meme-wallet-postgres-paper-journal.js'
import { bindOwnerCreatedMemeWallet,assessMemeWalletPaperCandidate,createMemeWalletPaperReceipt } from './meme-wallet-paper-gate.js'

const wallet=bindOwnerCreatedMemeWallet({
  solanaAddress:'So11111111111111111111111111111111111111112',
  ownerWalletAddresses:[],cofferWalletAddresses:[],mcpAgentAddresses:[],
})
const quoteMint='11111111111111111111111111111111'
const now='2026-10-14T19:00:05.000Z'
const candidate={
  caseId:'shark:canonical:persisted:1',strategyId:'sniper-paper',
  tokenMint:'So11111111111111111111111111111111111111112',
  quoteMint,observedAt:now,quoteReceivedAt:now,
  evidenceIds:['shark:canonical:1'],liquidityVerified:true,
  sellabilityVerified:true,tokenPermissionsSafe:true,holderConcentrationSafe:true,
  rugVeto:false,expectedSlippageBps:125,estimatedTotalCostsMinor:5n,
  authority:'SHARK_RESEARCH_ONLY',canAuthorizeTrade:false,
} as const
const policy={
  policyId:'paper-only',ownerReview:'APPROVED_FOR_PAPER_ONLY',
  paperOnly:true,liveExecutionEnabled:false,
  maxPaperEntryMinor:1000n,maxPaperDailyNotionalMinor:2000n,
  maxPaperGrossExposureMinor:1000n,maxPaperDailyLossMinor:300n,
  maxPaperOrdersPerDay:3,maxSlippageBps:250,maxQuoteAgeMs:5000,
  allowedQuoteMints:[quoteMint],authority:'PAPER_RISK_POLICY_ONLY',
} as const
const state={
  day:'2026-10-14',enteredMinor:0n,grossExposureMinor:0n,
  realizedLossMinor:0n,orders:0,unresolvedIds:[],halted:false,
} as const
const decision=assessMemeWalletPaperCandidate({wallet,policy,candidate,state,entryMinor:200n,now})
const receipt=createMemeWalletPaperReceipt({
  decision,state:'PAPER_FILLED',outputAtomic:'33',simulatedFeeMinor:2n,
  observedAt:now,evidenceIds:['simulated:exit:1'],
})
function fake(){
  const decisions=new Map<string,Record<string,unknown>>()
  const settlements=new Map<string,Record<string,unknown>>()
  const calls:string[]=[]
  const db:MemeWalletPaperSql={
    async query(sql,params=[]){
      calls.push(sql)
      if(sql.startsWith('SELECT d.decision_json')){
        const found=[...decisions.values()].find(x=>x.walletId===params[0]&&x.candidateCaseId===params[1])
        return {rows:found?[{decision_json:found,receipt_json:settlements.get(String(found.decisionId))??null}]:[],rowCount:found?1:0}
      }
      if(sql.includes('INSERT INTO runpod_meme_wallet_paper_decisions')){
        const key=String(params[0])
        if(decisions.has(key))return {rows:[],rowCount:0}
        // ON CONFLICT walletId+caseId must also reject duplicates.
        if([...decisions.values()].some(x=>x.walletId===params[1]&&x.candidateCaseId===params[2]))return {rows:[],rowCount:0}
        decisions.set(key,JSON.parse(String(params[5])) as Record<string,unknown>)
        return {rows:[{decision_id:key}],rowCount:1}
      }
      if(sql.includes('INSERT INTO runpod_meme_wallet_paper_receipts')){
        const key=String(params[0])
        if(settlements.has(key)||!decisions.has(key))return {rows:[],rowCount:0}
        settlements.set(key,JSON.parse(String(params[2])) as Record<string,unknown>)
        return {rows:[{decision_id:key}],rowCount:1}
      }
      throw Error('UNEXPECTED_SQL')
    },
  }
  return {db,decisions,settlements,calls}
}

test('durable SQL journal admits exact paper-only decision and simulated receipt',async()=>{
  const {db,calls}=fake()
  const journal=createMemeWalletPostgresPaperJournal(db)
  assert.equal(await journal.getByCase(wallet.walletId,candidate.caseId),null)
  await journal.appendDecision(decision)
  const saved=await journal.getByCase(wallet.walletId,candidate.caseId)
  assert.equal(saved?.decision.decisionId,decision.decisionId)
  assert.equal(saved?.decision.proposedEntryMinor,200n)
  assert.equal(saved?.decision.canExecute,false)
  assert.equal(saved?.receipt,null)
  await journal.appendReceipt(receipt)
  const settled=await journal.getByCase(wallet.walletId,candidate.caseId)
  assert.equal(settled?.receipt?.inputMinor,200n)
  assert.equal(settled?.receipt?.simulatedFeeMinor,2n)
  assert.equal(settled?.receipt?.canExecute,false)
  assert.ok(calls.every(sql=>!/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|signVersionedTransaction|executeSigned/.test(sql)))
})
test('repeated proposal or simulated settlement fails closed without overwriting records',async()=>{
  const {db}=fake()
  const journal=createMemeWalletPostgresPaperJournal(db)
  await journal.appendDecision(decision)
  await assert.rejects(journal.appendDecision(decision),/MEME_PAPER_JOURNAL_CONFLICT_RETRY_READ/)
  await journal.appendReceipt(receipt)
  await assert.rejects(journal.appendReceipt(receipt),/MEME_PAPER_JOURNAL_SETTLEMENT_CONFLICT/)
})
test('tampered stored authority or wrong wallet/case binding is rejected on read',async()=>{
  const {db,decisions,settlements}=fake()
  const journal=createMemeWalletPostgresPaperJournal(db)
  await journal.appendDecision(decision)
  const original=decisions.get(decision.decisionId)!
  decisions.set(decision.decisionId,{...original,canExecute:true})
  await assert.rejects(journal.getByCase(wallet.walletId,candidate.caseId),/MEME_PAPER_JOURNAL_DECISION_AUTHORITY_INVALID/)
  decisions.set(decision.decisionId,{...original})
  await journal.appendReceipt(receipt)
  settlements.set(decision.decisionId,{...settlements.get(decision.decisionId)!,canExecute:true})
  await assert.rejects(journal.getByCase(wallet.walletId,candidate.caseId),/MEME_PAPER_JOURNAL_RECEIPT_AUTHORITY_INVALID/)
})
test('paper-only database principal rejects broad mutation and requires research-only inserts',async()=>{
  const good={
    role_name:'meme_paper_ingest',is_superuser:false,
    can_create_role:false,can_create_db:false,can_create_schema:false,
    can_read_decisions:true,can_insert_decisions:true,
    can_read_receipts:true,can_insert_receipts:true,
    can_mutate_decisions:false,can_mutate_receipts:false,
    can_mutate_other_money:false,
  }
  const db=(record:Record<string,unknown>):MemeWalletPaperSql=>({
    async query(sql){assert.match(sql,/pg_roles/);return {rows:[record],rowCount:1}},
  })
  const accepted=await assertMemeWalletPaperDbRole(db(good))
  assert.equal(accepted.canExecute,false)
  for(const elevated of [
    {is_superuser:true},{can_create_schema:true},{can_mutate_decisions:true},
    {can_mutate_receipts:true},{can_mutate_other_money:true},{can_insert_receipts:false},
  ])await assert.rejects(assertMemeWalletPaperDbRole(db({...good,...elevated})),/MEME_PAPER_DATABASE_ROLE_UNSAFE/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCofferAccountantDecision,deriveCofferSurvivalState,type CofferAccountingSnapshot,type CofferPolicy } from './coffer-accountant.js'
import { assertMoneyMovementProposal,assertMoneyMovementRequest,promoteApprovedMoneyMovement,type FundingDestination,type MoneyMovementProposal,type MoneyMovementRequest } from './funding-rail-contracts.js'
import { assertWalletTransferRequest,PHANTOM_OWNER_WALLET_BOUNDARY,type ConnectedWallet,type WalletTransferRequest } from './wallet-connector-contracts.js'
import { assertConnectorMayExecute,MONEY_LIVE1_CONNECTOR_OPENINGS } from './market-connector-contracts.js'

const policy=(o:Partial<CofferPolicy>={}):CofferPolicy=>({
 policyId:'coffer-policy:1',currency:'USD',principalCapitalMinor:100000n,hardStopFloorMinor:10000n,survivalFloorMinor:20000n,defensiveFloorMinor:40000n,maxDeployableBps:5000,
 profitSweepThresholdMinor:50000n,profitRetainMinor:10000n,planningReserveBps:2500,autoSweepEnabled:true,verifiedOwnerDestinationId:'bank:owner',standingSweepMandateId:'mandate:sweep:1',authority:'OWNER_POLICY',...o
})
const snapshot=(o:Partial<CofferAccountingSnapshot>={}):CofferAccountingSnapshot=>({
 cofferId:'coffer:1',currency:'USD',settledCashMinor:250000n,unsettledCashMinor:0n,reservedCashMinor:20000n,realizedGrossProfitMinor:150000n,realizedCostsMinor:10000n,priorSweptProfitMinor:0n,observedAt:'2026-09-27T22:00:00Z',evidenceIds:['ledger:1'],authority:'ACCOUNTING_EVIDENCE',...o
})

test('MONEY-LIVE.1 accountant sweeps only realized settled excess after reserves',()=>{
 const d=buildCofferAccountantDecision({policy:policy(),snapshot:snapshot()})
 assert.equal(d.survivalState,'ACTIVE')
 assert.equal(d.netRealizedProfitMinor,140000n)
 assert.equal(d.planningReserveMinor,35000n)
 assert.equal(d.sweepableProfitMinor,95000n)
 assert.equal(d.proposedSweepMinor,95000n)
 assert.equal(d.sweepStatus,'READY_FOR_GOVERNED_EXECUTION')
 assert.equal(d.canMoveMoney,false)
})

test('MONEY-LIVE.1 threshold does not count unrealized or unsettled profit',()=>{
 const d=buildCofferAccountantDecision({policy:policy(),snapshot:snapshot({realizedGrossProfitMinor:50000n,unsettledCashMinor:999999n})})
 assert.equal(d.sweepStatus,'BELOW_THRESHOLD')
 assert.equal(d.proposedSweepMinor,0n)
})

test('MONEY-LIVE.1 survival state blocks profit extraction before the Coffer dies',()=>{
 const p=policy()
 assert.equal(deriveCofferSurvivalState(0n,p),'RECAPITALIZATION_REQUIRED')
 assert.equal(deriveCofferSurvivalState(10000n,p),'HALTED')
 assert.equal(deriveCofferSurvivalState(15000n,p),'SURVIVAL')
 assert.equal(deriveCofferSurvivalState(30000n,p),'DEFENSIVE')
 const d=buildCofferAccountantDecision({policy:p,snapshot:snapshot({settledCashMinor:35000n,reservedCashMinor:0n})})
 assert.equal(d.sweepStatus,'BLOCKED_FOR_SURVIVAL')
 assert.equal(d.proposedSweepMinor,0n)
})

test('MONEY-LIVE.1 automatic sweep requires a verified owner destination and standing mandate',()=>{
 const a=buildCofferAccountantDecision({policy:policy({verifiedOwnerDestinationId:undefined}),snapshot:snapshot()})
 assert.equal(a.sweepStatus,'DESTINATION_REQUIRED')
 const b=buildCofferAccountantDecision({policy:policy({standingSweepMandateId:undefined}),snapshot:snapshot()})
 assert.equal(b.sweepStatus,'MANDATE_REQUIRED')
})

test('MONEY-LIVE.1 deposits withdrawals and transfers are bound to owner verified endpoints and permits',()=>{
 const source:FundingDestination={destinationId:'coffer:cash',ownerUserId:'u1',provider:'coffer',accountId:'c1',currency:'USD',verified:true,kind:'BROKER_CASH',evidenceIds:['source:e']}
 const dest:FundingDestination={destinationId:'bank:owner',ownerUserId:'u1',provider:'bank',accountId:'b1',currency:'USD',verified:true,kind:'BANK',evidenceIds:['dest:e']}
 const r:MoneyMovementRequest={movementId:'m1',kind:'WITHDRAWAL',userId:'u1',cofferId:'coffer:1',amountMinor:50000n,currency:'USD',sourceId:source.destinationId,destinationId:dest.destinationId,idempotencyKey:'idem1',requestedAt:'2026-09-27T22:00:00Z',standingMandateId:'mandate:sweep:1',authorityId:'authority:1',executionPermitId:'permit:1'}
 assert.doesNotThrow(()=>assertMoneyMovementRequest(r,{verifiedSource:source,verifiedDestination:dest}))
 assert.throws(()=>assertMoneyMovementRequest(r,{verifiedSource:source,verifiedDestination:{...dest,verified:false}}),/UNVERIFIED/)
})

test('MONEY-LIVE.1 Phantom is owner custody only; unattended execution wallet is separately bounded',()=>{
 assert.equal(PHANTOM_OWNER_WALLET_BOUNDARY.privateKeyCustody,'FORBIDDEN')
 assert.equal(PHANTOM_OWNER_WALLET_BOUNDARY.unattendedServerSigning,false)
 const owner:ConnectedWallet={connectionId:'w1',userId:'u1',provider:'phantom',network:'SOLANA',address:'owner',mode:'OWNER_WALLET',connectedAt:'2026-09-27T22:00:00Z',evidenceIds:['wallet:e'],authority:'CONNECTION_ONLY',canSign:false}
 const req:WalletTransferRequest={transferId:'t1',userId:'u1',connectionId:'w1',network:'SOLANA',assetId:'SOL',amountAtomic:'1000',destinationAddress:'allowed',authorityId:'a1',executionPermitId:'p1',idempotencyKey:'i1',requestedAt:'2026-09-27T22:00:00Z'}
 assert.throws(()=>assertWalletTransferRequest(req,{connection:owner,allowedDestinationAddresses:['allowed']}),/OWNER_WALLET_AUTOMATION_FORBIDDEN/)
 const coffer={...owner,provider:'coffer-signer',mode:'COFFER_EXECUTION_WALLET' as const}
 assert.doesNotThrow(()=>assertWalletTransferRequest(req,{connection:coffer,allowedDestinationAddresses:['allowed']}))
 assert.throws(()=>assertWalletTransferRequest(req,{connection:coffer,allowedDestinationAddresses:['different']}),/DESTINATION_NOT_ALLOWLISTED/)
})

test('MONEY-LIVE.1 stock forex and DEX openings fail closed until separately commissioned',()=>{
 assert.deepEqual(MONEY_LIVE1_CONNECTOR_OPENINGS.map(x=>x.lane),['STOCK','FOREX','DEX'])
 for(const x of MONEY_LIVE1_CONNECTOR_OPENINGS)assert.throws(()=>assertConnectorMayExecute(x),/NOT_EXECUTION_ADMITTED/)
})


import { buildProfitSweepJournalCandidate,certifyProfitSweepReconciliation,validateDoubleEntry } from './accountant-controls.js'

test('MONEY-LIVE.1 sweep journal is balanced and remains non-posting',()=>{
 const d=buildCofferAccountantDecision({policy:policy(),snapshot:snapshot()})
 const j=buildProfitSweepJournalCandidate({journalId:'journal:1',decision:d,currency:'USD',sourceAccount:'coffer:cash',destinationAccount:'owner:cash'})
 assert.equal(j.balanced,true)
 assert.equal(j.approvalRequired,true)
 assert.equal(j.canPost,false)
 assert.equal(validateDoubleEntry(j.lines).passed,true)
})

test('MONEY-LIVE.1 post-movement reconciliation must tie source destination and provider fee',()=>{
 const d=buildCofferAccountantDecision({policy:policy(),snapshot:snapshot()})
 const j=buildProfitSweepJournalCandidate({journalId:'journal:2',decision:d,currency:'USD',sourceAccount:'coffer:cash',destinationAccount:'owner:cash'})
 const ok=certifyProfitSweepReconciliation({journal:j,sourceSettledCashBeforeMinor:250000n,sourceSettledCashAfterMinor:154000n,destinationSettledCashBeforeMinor:10000n,destinationSettledCashAfterMinor:105000n,providerFeeMinor:1000n,evidenceIds:['bank:statement','coffer:statement']})
 assert.equal(ok.passed,true)
 const bad=certifyProfitSweepReconciliation({journal:j,sourceSettledCashBeforeMinor:250000n,sourceSettledCashAfterMinor:154000n,destinationSettledCashBeforeMinor:10000n,destinationSettledCashAfterMinor:104999n,providerFeeMinor:1000n,evidenceIds:['bank:statement']})
 assert.equal(bad.passed,false)
 assert.ok(bad.reasonCodes.includes('DESTINATION_CASH_DOES_NOT_TIE'))
})


test('MONEY-LIVE.1 movement proposal remains non-executing until authority is attached',()=>{
 const source:FundingDestination={destinationId:'bank:a',ownerUserId:'u1',provider:'plaid',accountId:'a',currency:'USD',verified:true,kind:'BANK',evidenceIds:['a']}
 const dest:FundingDestination={destinationId:'coffer:c1',ownerUserId:'u1',provider:'money-core',accountId:'c1',currency:'USD',verified:true,kind:'BROKER_CASH',evidenceIds:['c']}
 const p:MoneyMovementProposal={movementId:'mp1',kind:'DEPOSIT',userId:'u1',cofferId:'c1',amountMinor:2500n,currency:'USD',sourceId:source.destinationId,destinationId:dest.destinationId,idempotencyKey:'proposal:1',requestedAt:'2026-09-27T22:00:00Z',state:'PENDING_APPROVAL',authority:'PROPOSAL_ONLY',canMoveMoney:false}
 assert.doesNotThrow(()=>assertMoneyMovementProposal(p,{verifiedSource:source,verifiedDestination:dest}))
 assert.throws(()=>promoteApprovedMoneyMovement({proposal:p,authorityId:'',executionPermitId:''}),/AUTHORITY_REQUIRED/)
 const r=promoteApprovedMoneyMovement({proposal:p,authorityId:'authority:1',executionPermitId:'permit:1'})
 assert.equal(r.executionPermitId,'permit:1')
})

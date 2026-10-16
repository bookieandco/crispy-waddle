import assert from 'node:assert/strict'
import { beginPaperExitCase,advancePaperExitCase,type PaperExitCase, type PaperExitStep } from './meme-paper-exit.js'
const entry=beginPaperExitCase('study-1','owner-1')
assert.equal(entry.walletActionsEnabled,false)
assert.equal(entry.tokenSaleAuthorized,false)
assert.equal(entry.protectedLiquidity,true)
assert.throws(()=>advancePaperExitCase(entry,{action:'CLOSE_PAPER',at:'2026-10-15T00:00:00Z',note:'skip review',evidenceRefs:['e:1']}),/DENIED/)
const evt=(action:PaperExitStep['action'],at:string):PaperExitStep=>({
 action,at,note:'Paper-only documentation',evidenceRefs:['receipt:public','receipt:owner']
})
let s:PaperExitCase=advancePaperExitCase(entry,evt('PAUSE','2026-10-15T00:00:00Z'))
assert.equal(entry.receipts.length,0,'mutation of previous version prohibited')
assert.equal(s.status,'PAUSED')
assert.throws(()=>advancePaperExitCase(s,evt('OWNER_REVIEW','2026-10-16T00:00:00Z')),/OWNER_CONFIRMATION/)
s=advancePaperExitCase(s,{...evt('OWNER_REVIEW','2026-10-16T00:00:00Z'),ownerConfirmed:true})
assert.throws(()=>advancePaperExitCase(s,evt('RECORD_NOTICE','2026-10-17T00:00:00Z')),/NOTICE_AND_TERMS/)
s=advancePaperExitCase(s,{...evt('RECORD_NOTICE','2026-10-17T00:00:00Z'),
 noticeUrl:'https://example.invalid/public-notice',termsReference:'proposed-terms-01'})
assert.equal(s.status,'NOTICE_RECORDED_UNVERIFIED')
s=advancePaperExitCase(s,evt('CLOSE_PAPER','2026-10-18T00:00:00Z'))
assert.equal(s.status,'CLOSED_PAPER')
assert.equal(s.receipts.length,4)
assert.deepEqual(s.receipts.map(x=>x.sequence),[1,2,3,4])
assert(s.receipts.every(x=>x.externalActionPerformed===false))
assert.equal(s.tokenSaleAuthorized,false)
assert.equal(s.custodyMovementAuthorized,false)
assert.throws(()=>advancePaperExitCase(s,evt('PAUSE','2026-10-19T00:00:00Z')),/DENIED/)
assert.throws(()=>advancePaperExitCase({...s,tokenSaleAuthorized:true},evt('PAUSE','2026-10-19T00:00:00Z')),/AUTHORITY_INVALID/)
console.log('MEME-PROFIT.07–.10 safe paper exit lifecycle tests passed')

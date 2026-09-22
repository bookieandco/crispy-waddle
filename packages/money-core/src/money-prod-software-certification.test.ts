import assert from 'node:assert/strict'
import test from 'node:test'
import { requiredMoneyProdSoftwareCases,certifyMoneyProdSoftware,type MoneyProdSoftwareCase } from './money-prod-software-certification.js'

const certifiedAt='2026-09-22T02:00:00Z'
const good=():MoneyProdSoftwareCase[]=>requiredMoneyProdSoftwareCases().map(name=>({name,passed:true,evidenceIds:['test:'+name]}))

test('MONEY-PROD.SOFTWARE.1 all required cases produce four non-executable software receipts',()=>{
  const report=certifyMoneyProdSoftware({cases:good(),certifiedAt})
  assert.equal(report.passed,true)
  assert.equal(report.missingCases.length,0)
  assert.equal(report.laneReceiptCandidates.length,4)
  assert.ok(report.laneReceiptCandidates.every(x=>x.kind==='SOFTWARE_CERTIFICATION'&&x.environment==='SHADOW'&&x.canExecute===false))
})

test('MONEY-PROD.SOFTWARE.2 missing or failed case fails closed and emits no receipts',()=>{
  const cases=good().filter(x=>x.name!=='shark-paper-learning')
  let report=certifyMoneyProdSoftware({cases,certifiedAt})
  assert.equal(report.passed,false);assert.ok(report.missingCases.includes('shark-paper-learning'));assert.equal(report.laneReceiptCandidates.length,0)
  const full=good();full[0]={...full[0]!,passed:false}
  report=certifyMoneyProdSoftware({cases:full,certifiedAt})
  assert.equal(report.passed,false);assert.equal(report.laneReceiptCandidates.length,0)
})

test('MONEY-PROD.SOFTWARE.3 duplicate cases and evidence-free cases are rejected',()=>{
  const cases=good()
  assert.throws(()=>certifyMoneyProdSoftware({cases:[...cases,cases[0]!],certifiedAt}),/DUPLICATE_CASE/)
  assert.throws(()=>certifyMoneyProdSoftware({cases:[{name:'stock-point-in-time-reality',passed:true,evidenceIds:[]}],certifiedAt}),/CASE_EVIDENCE_REQUIRED/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bindActionCoreAuthority } from './action-core-authority-bridge.js'
import { issueExecutionPermit } from './execution-permit.js'

const action={actionId:'a1',userId:'u1',capability:'money.payment.create',provider:'p',accountId:'acct',amount:'10.00',currency:'USD'}
const request={id:'a1',userId:'u1',type:'money.payment.create',action:{},requestedAt:'2026-01-01T00:00:00Z',approvalReceiptId:'approval-1'}
const permit=issueExecutionPermit({action,policyVersion:'v1',policyHash:'h1',approvalId:'approval-1',expiresAt:'2026-01-01T00:10:00Z',now:'2026-01-01T00:00:00Z',permitId:'permit-1',nonce:'n1'})

test('binds Action Core authority to exact Money permit',()=>{const b=bindActionCoreAuthority(request,action,permit);assert.equal(b.executionPermitId,'permit-1');assert.equal(b.approvalReceiptId,'approval-1')})
test('rejects capability mismatch',()=>assert.throws(()=>bindActionCoreAuthority({...request,type:'money.transfer.create'},action,permit),/CAPABILITY_MISMATCH/))
test('rejects approval mismatch',()=>assert.throws(()=>bindActionCoreAuthority({...request,approvalReceiptId:'other'},action,permit),/APPROVAL_MISMATCH/))

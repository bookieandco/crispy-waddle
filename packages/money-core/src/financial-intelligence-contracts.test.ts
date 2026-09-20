import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIntelligenceOnly } from './financial-intelligence-contracts.js';

test('financial intelligence rejects every canonical mutation family',()=>{
  for(const capability of ['money.payment.create','money.transfer.create','money.account.change','money.order.submit','money.trade.submit','money.borrow.create','money.allocate.commit']){
    assert.throws(()=>assertIntelligenceOnly(capability),/cannot directly execute/);
  }
});

test('financial intelligence permits research/read capabilities',()=>{
  for(const capability of ['money.account.read','money.transaction.read','money.statement.read','money.debt.read']){
    assert.doesNotThrow(()=>assertIntelligenceOnly(capability));
  }
});

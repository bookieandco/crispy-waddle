import { describe, expect, it, vi } from 'vitest';
import type { ActionIdentityVerifier, AuditRpcClient } from '@jhadina/action-core';
import type { BankAdapter, MoneyAdapterContext } from './bank-adapter.js';
import { createGovernedProviderTransactionReadExecutor } from './governed-provider-transaction-read.js';

function identity(userId='u1'):ActionIdentityVerifier{return {async verify(){return {userId,sessionId:'s1'}}}}
const supabase:AuditRpcClient={async rpc(){return {data:null,error:null}}};
function provider():BankAdapter{return {provider:'plaid',async listAccounts(){return []},async listTransactions(_ctx:MoneyAdapterContext,accountId:string){return [{id:'t1',accountId,amount:12,currency:'USD',occurredAt:'2026-09-20',description:'Merchant'}]}}}
const config={plaid:{enabled:true,credentialRef:'money/plaid/default',capabilities:['money.account.read','money.transaction.read'] as const}};

describe('governed transaction read',()=>{
  it('returns transactions only for an owned account',async()=>{const executor=createGovernedProviderTransactionReadExecutor({identityVerifier:identity(),supabase,provider:provider(),providerConfig:config,ownership:(userId)=>({userId,accountIds:new Set(['acc1'])})});const result=await executor.execute({id:'r1',userId:'u1',type:'money.transaction.read',requestedAt:new Date().toISOString(),action:{capability:'money.transaction.read',accountId:'acc1'}});expect(result).toHaveLength(1)});
  it('fails closed before provider read for an unowned account',async()=>{const p=provider();const spy=vi.spyOn(p,'listTransactions');const executor=createGovernedProviderTransactionReadExecutor({identityVerifier:identity(),supabase,provider:p,providerConfig:config,ownership:(userId)=>({userId,accountIds:new Set(['other'])})});await expect(executor.execute({id:'r2',userId:'u1',type:'money.transaction.read',requestedAt:new Date().toISOString(),action:{capability:'money.transaction.read',accountId:'acc1'}})).rejects.toThrow('MONEY_ACCOUNT_ACCESS_DENIED');expect(spy).not.toHaveBeenCalled()});
  it('rejects identity mismatch',async()=>{const executor=createGovernedProviderTransactionReadExecutor({identityVerifier:identity('actual'),supabase,provider:provider(),providerConfig:config,ownership:(userId)=>({userId,accountIds:new Set(['acc1'])})});await expect(executor.execute({id:'r3',userId:'claimed',type:'money.transaction.read',requestedAt:new Date().toISOString(),action:{capability:'money.transaction.read',accountId:'acc1'}})).rejects.toThrow('Action identity mismatch')});
});

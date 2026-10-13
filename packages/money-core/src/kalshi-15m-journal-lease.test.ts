import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {acquireKalshiJournalLease} from './kalshi-15m-journal-lease.js';

test('only one writer owns a journal; clean exit releases its lease',async()=>{
  const root=await mkdtemp(join(tmpdir(),'jhadina-kalshi-lock-'));
  const journal=join(root,'ledger.jsonl');
  try{
    const lease=await acquireKalshiJournalLease(journal);
    assert.ok(lease.leaseId.length>20);
    await assert.rejects(()=>acquireKalshiJournalLease(journal),/OCCUPIED/);
    await lease.release();
    await lease.release();
    const next=await acquireKalshiJournalLease(journal);
    assert.notEqual(lease.leaseId,next.leaseId);
    await next.release();
  }finally{await rm(root,{recursive:true,force:true});}
});

test('lock replacement cannot be removed and stale locks are never stolen',async()=>{
  const root=await mkdtemp(join(tmpdir(),'jhadina-kalshi-lock-'));
  const journal=join(root,'ledger.jsonl');
  try{
    const lease=await acquireKalshiJournalLease(journal);
    await writeFile(lease.path,'{"replaced":true}\n');
    await assert.rejects(()=>lease.release(),/OWNERSHIP_LOST/);
    assert.equal(await readFile(lease.path,'utf8'),'{"replaced":true}\n');
    await assert.rejects(()=>acquireKalshiJournalLease(journal),/OCCUPIED/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('relative paths refuse a lease rather than acquiring unexpected cwd files',async()=>{
  await assert.rejects(()=>acquireKalshiJournalLease('./ledger.jsonl'),/ABSOLUTE/);
});

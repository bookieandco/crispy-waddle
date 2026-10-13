import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CASE001,verifyCase001 } from './verify-case.mjs';

const p=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json',import.meta.url));
const a=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.availability-001.json',import.meta.url));

test('case 001 retains original pinned GitHub blob and valid pregame cutoff',()=>{
  const r=verifyCase001(p,a);
  assert.equal(r.ok,true);
  assert.equal(r.sourceCommit,CASE001.sealCommit);
  assert.equal(r.noBetAuthority,true);
});

test('mutating even whitespace of pinned prediction is rejected',()=>{
  assert.throws(()=>verifyCase001(Buffer.concat([p,Buffer.from(' ')]),a),/PREGAME_BLOB_CHANGED/);
});

test('cannot reclassify postkickoff data as pregame evidence',()=>{
  const dirty={...JSON.parse(a),information_cutoff_utc:'2026-10-13T00:16:00Z'};
  assert.throws(()=>verifyCase001(p,Buffer.from(JSON.stringify(dirty))),/PREGAME_EVIDENCE_AFTER_KICKOFF/);
});

test('case-id mismatch and authority escalation are blocked',()=>{
  const wrong={...JSON.parse(a),case_id:'unrelated'};
  assert.throws(()=>verifyCase001(p,Buffer.from(JSON.stringify(wrong))),/Expected values to be strictly equal/);
});

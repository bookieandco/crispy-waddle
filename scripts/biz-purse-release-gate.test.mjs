import test from 'node:test';
import assert from 'node:assert/strict';
import {MILESTONES,assessBizPurseMilestones} from './biz-purse-release-gate.mjs';
const at='2026-10-14T23:00:00Z';
const receipt=(m,kind,i=0)=>({id:m+':'+kind+':'+i,milestone:m,kind,status:'PASS',origin:'VERIFIED_EXTERNAL_OR_RUNTIME',observedAt:'2026-10-14T22:00:00Z'});
test('all missing evidence blocks 01 through 12',()=>{const r=assessBizPurseMilestones([],at);assert.equal(r.milestones.length,12);assert(r.milestones.every(x=>x.state==='BLOCKED'));assert.equal(r.productionCertified,false)});
test('cannot mark downstream milestones eligible when 01 lacks evidence',()=>{const all=MILESTONES.slice(1).flatMap(m=>m.proofs.map(k=>receipt(m.id,k)));const r=assessBizPurseMilestones(all,at);assert(r.milestones.every(m=>m.state==='BLOCKED'))});
test('completed-looking receipt inventory never grants production authority',()=>{const all=MILESTONES.flatMap(m=>m.proofs.map(k=>receipt(m.id,k)));const r=assessBizPurseMilestones(all,at);assert.equal(r.allEvidencePresent,true);assert.equal(r.milestones[11].state,'EVIDENCE_RECORDED_EXTERNAL_CERTIFICATION_REQUIRED');assert.equal(r.moneyMovementAuthorized,false);assert.equal(r.liveTradingAuthorized,false)});
test('synthetic evidence, duplicates, malformed and future receipts fail closed',()=>{const r=assessBizPurseMilestones([ {...receipt('BIZ-PURSE.01','SCHEMA_REPLAY'),synthetic:true} ],at);assert(r.milestones[0].missing.includes('SCHEMA_REPLAY'));const x=receipt('BIZ-PURSE.01','SCHEMA_REPLAY');assert.throws(()=>assessBizPurseMilestones([x,x],at),/DUPLICATE/);assert.throws(()=>assessBizPurseMilestones([{...x,observedAt:'nonsense'}],at),/MALFORMED/);assert.throws(()=>assessBizPurseMilestones([{...x,observedAt:'2030-01-01T00:00:00Z'}],at),/FUTURE/) });

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportCase001Events} from './export-study-events.mjs';

const p=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json',import.meta.url));
const a=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.availability-001.json',import.meta.url));
const l=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/live.observation-001.json',import.meta.url),'utf8'));

test('emits three deterministic case events with no database writes or training',()=>{
 const one=exportCase001Events(p,a,l);
 const two=exportCase001Events(p,a,l);
 assert.deepEqual(one,two);
 assert.deepEqual(one.rows.map(x=>x.event_type),['PREGAME_FORECAST','PREGAME_OBSERVATION','LIVE_OBSERVATION']);
 assert.equal(new Set(one.rows.map(x=>x.record_id)).size,3);
 assert.equal(one.database_write_performed,false);
 assert.equal(one.training_run_executed,false);
 assert.equal(one.canExecute,false);
});
test('source cutoffs remain on correct sides of kickoff',()=>{
 const result=exportCase001Events(p,a,l);
 const kickoff=Date.parse(result.rows[0].scheduled_kickoff);
 assert.ok(Date.parse(result.rows[0].information_cutoff)<kickoff);
 assert.ok(Date.parse(result.rows[1].information_cutoff)<kickoff);
 assert.ok(Date.parse(result.rows[2].information_cutoff)>=kickoff);
});
test('incorrect live result identity and mutated original forecast cannot enter replay',()=>{
 assert.throws(()=>exportCase001Events(p,a,{...l,event_id:'unrelated'}),/LIVE_EVENT_MISMATCH/);
 assert.throws(()=>exportCase001Events(Buffer.from(p.toString('utf8')+' '),a,l),/PREGAME_BLOB_CHANGED/);
});

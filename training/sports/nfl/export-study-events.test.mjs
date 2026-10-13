import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportCase001Events} from './export-study-events.mjs';

const p=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json',import.meta.url));
const a=readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.availability-001.json',import.meta.url));
const l=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/live.observation-001.json',import.meta.url),'utf8'));
const l2=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/live.observation-002.json',import.meta.url),'utf8'));

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

test('replays a second timestamped observation without rewriting the first',()=>{
 const forward=exportCase001Events(p,a,[l,l2]);
 const reverse=exportCase001Events(p,a,[l2,l]);
 assert.deepEqual(forward,reverse);
 assert.equal(forward.row_count,4);
 assert.deepEqual(forward.rows.map(x=>x.event_type),[
  'PREGAME_FORECAST','PREGAME_OBSERVATION','LIVE_OBSERVATION','LIVE_OBSERVATION']);
 assert.equal(forward.rows[2].payload_json.observation_id,l.observation_id);
 assert.equal(forward.rows[3].payload_json.observation_id,l2.observation_id);
 assert.equal(new Set(forward.rows.map(x=>x.record_id)).size,4);
 assert.equal(forward.database_write_performed,false);
});
test('replayed observations reject repeats, provider drift and decreasing scores',()=>{
 assert.throws(()=>exportCase001Events(p,a,[l,l]),/STUDY_DUPLICATE_LIVE_OBSERVATION/);
 assert.throws(()=>exportCase001Events(p,a,[l,{...l2,provider_game_id:'wrong-game'}]),/STUDY_GAME_ID_DRIFT/);
 assert.throws(()=>exportCase001Events(p,a,[l,{...l2,provider_reported_score:{BUF:0,LAR:0}}]),/STUDY_SCORE_REGRESSION_REQUIRES_CORRECTION_EVENT/);
 assert.throws(()=>exportCase001Events(p,a,[]),/STUDY_NO_LIVE_OBSERVATIONS/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditNflPropCoverage as audit} from './audit-prop-coverage.mjs';
const root=new URL('./2026/2026-10-12-buf-at-lar/',import.meta.url);
const read=n=>JSON.parse(readFileSync(new URL(n,root),'utf8'));
const b=read('props.archived-dk-splits-001.json');
const a=read('props.context-and-alternative-lines-001.json');
const t=read('props.touchdown-odds-001.json');
const s=read('props.public-over-under-splits-001.json');
test('captures 104 numeric, 32 TD, 32 public splits and alternative published lines',()=>{
 const r=audit(b,a,t,s);
 assert.equal(r.numeric_ou_line_observations,104);
 assert.equal(r.tracked_players,18);
 assert.equal(r.numeric_stat_categories,14);
 assert.equal(r.numeric_periods.length,3);
 assert.equal(r.alternative_line_observations,16);
 assert.equal(r.touchdown_binary_market_observations,32);
 assert.equal(r.selected_public_over_under_split_observations,32);
 assert.equal(r.entire_sportsbook_market_coverage,false);
 assert.equal(r.canExecute,false);
});
test('lists different reported lines instead of selecting a convenient threshold',()=>{
 const r=audit(b,a,t,s);
 const puka=r.line_variations.find(x=>x.dimension==='LAR|Puka Nacua|receiving_yards|FULL');
 assert.deepEqual(puka.thresholds,[92.5,95.5]);
 assert.ok(r.same_player_metric_different_reported_line_count>=6);
});
test('rejects fabricated wager prices, unmatched splits and mismatched totals',()=>{
 const markets=[{...b.markets[0],price_over_american:-110},...b.markets.slice(1)];
 assert.throws(()=>audit({...b,markets},a,t,s),/FABRICATED_LOCKED_MARKET/);
 const splits=[{...s.splits[0],linked_numeric_market_id:'not-a-market'},...s.splits.slice(1)];
 assert.throws(()=>audit(b,a,t,{...s,splits}),/PUBLIC_SPLIT_UNMATCHED/);
 assert.throws(()=>audit(b,a,{...t,market_count:4},s),/COUNTS_INCONSISTENT/);
});
test('public betting splits are not implied outcome probabilities',()=>{
 const bad={...s,observation_semantics:{...s.observation_semantics,not_model_probabilities:false}};
 assert.throws(()=>audit(b,a,t,bad),/PUBLIC_SPLIT_MEANING_INVALID/);
});

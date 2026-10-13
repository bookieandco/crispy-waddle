import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPublication} from './publish-check.mjs';
const report={schema_version:'jhadina.sports.week001_run.v2',placed_bets:0,virtual_bankroll_usd:3100,training_updates:0};
const base={schema_version:'sports.publication.v1',files:[{path:'training/sports/paper-ledger/week001/runs/123-1.json',content:JSON.stringify(report)}]};
test('accept no-trade run receipt',()=>assert.equal(checkPublication(base).run_receipts,1));
test('reject path traversal',()=>assert.throws(()=>checkPublication({...base,files:[{...base.files[0],path:'../hack'}]}),/PUBLICATION_FILE_INVALID/));
test('reject duplicate receipts',()=>assert.throws(()=>checkPublication({...base,files:[base.files[0],base.files[0]]}),/PUBLICATION_FILE_INVALID/));
test('reject altered virtual stake',()=>assert.throws(()=>checkPublication({...base,files:[{...base.files[0],content:JSON.stringify({...report,placed_bets:1})}]}),/RUN_REPORT_INVALID/));
test('requires report',()=>assert.throws(()=>checkPublication({...base,files:[]}),/PUBLICATION_SCHEMA/));

test('accept source-labeled Markdown scoreboard alongside immutable JSON run receipt',()=>{
 const markdown="## Jhadina Sports Lab — Week 001\n- Real bets: **0**\nNo verified betting market prices or official settlement.\n";
 const summary={path:'training/sports/paper-ledger/week001/summaries/123-1.md',content:markdown};
 const result=checkPublication({...base,files:[...base.files,summary]});
 assert.equal(result.markdown_summaries,1);
 assert.equal(result.run_receipts,1);
});
test('reject scoreboard that implies real wagers',()=>{
 const summary={path:'training/sports/paper-ledger/week001/summaries/123-1.md',content:'## Jhadina Sports Lab\n- Real bets: **8**\nNo verified betting market prices'};
 assert.throws(()=>checkPublication({...base,files:[...base.files,summary]}),/SUMMARY_UNSAFE_OR_INVALID/);
});

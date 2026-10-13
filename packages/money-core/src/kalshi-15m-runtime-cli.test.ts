import assert from 'node:assert/strict';
import test from 'node:test';
import {launchKalshi15mPaperHost,kalshiHostSocketFactory} from './kalshi-15m-runtime-cli.js';

test('paper host refuses live authority and never starts by importing module',async()=>{
  await assert.rejects(()=>launchKalshi15mPaperHost({KALSHI_ENV:'demo'}),
    /PAPER_ONLY_REQUIRED/);
  await assert.rejects(()=>launchKalshi15mPaperHost({
    KALSHI_ENV:'demo',KALSHI_PAPER_ONLY:'true',KALSHI_LIVE_EXECUTION:'true',
  }),/LIVE_EXECUTION_FORBIDDEN/);
  await assert.rejects(()=>launchKalshi15mPaperHost({
    KALSHI_PAPER_ONLY:'true',KALSHI_ENV:'invalid',
  }),/ENV_INVALID/);
});

test('CLI does not download a WebSocket module or tolerate relative module directory',()=>{
  assert.throws(()=>kalshiHostSocketFactory('./node_modules'),/ABSOLUTE_REQUIRED/);
});

test('host refuses nonabsolute evidence journal before requiring credentials',async()=>{
  await assert.rejects(()=>launchKalshi15mPaperHost({
    KALSHI_PAPER_ONLY:'true',KALSHI_ENV:'demo',KALSHI_API_KEY_ID:'test',
    KALSHI_JOURNAL_PATH:'./tmp/records',
  }),/JOURNAL_ABSOLUTE_REQUIRED/);
});

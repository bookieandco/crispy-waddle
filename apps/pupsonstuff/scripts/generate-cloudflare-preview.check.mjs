import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewConfig, validatePreviewConfig } from './generate-cloudflare-preview.mjs';

const initial = {
  name:'pupsonstuff-preview-free',main:'.open-next/worker.js',
  compatibility_date:'2026-10-15',compatibility_flags:['nodejs_compat'],
  assets:{directory:'.open-next/assets',binding:'ASSETS'},workers_dev:true,
  vars:{PUPSON_CLOUDFLARE_PREVIEW_ONLY:'true',PUPSON_FULFILLMENT_MODE:'dry_run',
    PUPSON_LIVE_COMMERCE_APPROVED:'false',PUPSON_PAYMENT_OPERATIONS_READY:'false',
    VERCEL_ENV:'preview'}
};
const sha = '0123456789abcdef0123456789abcdef01234567';

test('restricts preview to a single Worker, no external resources, no commerce',()=>{
  const config=createPreviewConfig(initial,sha);
  assert.deepEqual(validatePreviewConfig(config),[]);
  assert.equal(config.vars.PUPSON_DEPLOY_COMMIT,sha);
});
test('requires exact source provenance',()=>{
  assert.throws(()=>createPreviewConfig(initial,'not-a-sha'),/Git SHA/);
  assert.throws(()=>createPreviewConfig(initial,'A'.repeat(40)),/Git SHA/);
});
test('fails closed if a cron, domain, billing-affecting binding or flag appears',()=>{
  for(const change of [
    {triggers:{crons:['*/5 * * * *']}},
    {routes:['example.com/*']},
    {r2_buckets:[{binding:'ASSETS'}]},
    {vars:{...initial.vars,PUPSON_FULFILLMENT_MODE:'live'}},
    {vars:{...initial.vars,STRIPE_SECRET_KEY:'x'}},
  ]){
    assert.ok(validatePreviewConfig({...initial,...change}).length>0);
  }
});

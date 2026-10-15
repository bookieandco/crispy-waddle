import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess } from './host-feasibility.mjs';

test('commercial Vercel Hobby cannot pass host-fit', () => {
  const x = assess({platform:'vercel',plan:'hobby',cron:'*/5 * * * *'});
  assert.equal(x.verdict,'blocked');
  assert.equal(x.blockers.length,2);
});
test('Cloudflare remains unverified absent runtime proof', () => {
  const x = assess({platform:'cloudflare',plan:'free'});
  assert.equal(x.verdict,'candidate_not_certified');
  assert.ok(x.unknowns.length>=2);
});
test('Cloudflare free bundle cannot exceed current size limit', () => {
  const x = assess({platform:'cloudflare',plan:'free',bundleBytes:65*1024*1024});
  assert.equal(x.verdict,'blocked');
});
test('unreviewed hosts fail closed', () => {
  assert.equal(assess({platform:'other',plan:'free'}).verdict,'blocked');
});

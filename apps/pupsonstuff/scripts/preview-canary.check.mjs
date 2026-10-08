import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreviewUrl, verifyPupsonPreview } from './preview-canary.mjs';

const url = 'https://pupsonstuff-git-staging-bookieandco.vercel.app/';
const health = {
  service: 'pupsonstuff', status: 'ok', database: 'reachable',
  environment: 'preview', fulfillmentMode: 'dry_run',
  commit: '0123456789ab',
};

function mockFetch(h = health, overrides = {}) {
  const calls = [];
  const fn = async (uri, args) => {
    calls.push({ uri, args });
    if (uri.endsWith('/api/health')) return {
      ok: true, status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      text: async () => JSON.stringify(h),
    };
    if (uri.endsWith('/')) return {
      ok: true, status: 200,
      headers: { get: () => 'text/html; charset=utf-8' },
    };
    throw Error('Unexpected path');
  };
  return { fn, calls };
}

test('accepts only clean Vercel HTTPS preview origins', () => {
  assert.equal(parsePreviewUrl(url), 'https://pupsonstuff-git-staging-bookieandco.vercel.app');
  for (const bad of [
    'http://pupsonstuff-git-staging.vercel.app/',
    'https://www.pupsonstuff.com/',
    'https://vercel.app/',
    'https://preview.vercel.app.evil.test/',
    'https://preview.vercel.app:8443/',
    'https://user:pw@preview.vercel.app/',
    'https://preview.vercel.app/api/charge',
    'https://preview.vercel.app/?token=abc',
  ]) assert.throws(() => parsePreviewUrl(bad));
});

test('read-only canary probes only storefront HTML and /api/health', async () => {
  const mock = mockFetch();
  const result = await verifyPupsonPreview({
    url, expectedCommit: '0123456789abcdef0123456789abcdef01234567',
    fetchImpl: mock.fn,
  });
  assert.equal(result.schema, 'pupson.preview-canary.v1');
  assert.equal(result.checks.fulfillmentMode, 'dry_run');
  assert.deepEqual(mock.calls.map(x => new URL(x.uri).pathname), ['/api/health', '/']);
  assert(mock.calls.every(x => x.args.method === 'GET'));
  assert(mock.calls.every(x => x.args.credentials === 'omit' && x.args.redirect === 'error'));
});

test('fails closed for wrong app, missing DB, or real fulfillment', async () => {
  for (const modified of [
    { service: 'jhadina' },
    { database: 'unreachable' },
    { status: 'degraded' },
    { fulfillmentMode: 'live' },
    { environment: 'production' },
  ]) {
    const { fn } = mockFetch({ ...health, ...modified });
    await assert.rejects(verifyPupsonPreview({ url, fetchImpl: fn }));
  }
});

test('fails closed for stale commit and invalid expected commit', async () => {
  const mock = mockFetch();
  await assert.rejects(verifyPupsonPreview({ url, fetchImpl: mock.fn, expectedCommit: 'abcdef0' }),
    /commit/);
  await assert.rejects(verifyPupsonPreview({ url, fetchImpl: mock.fn, expectedCommit: 'not-hex' }),
    /commit/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  MULTIHOPPER_DEVNET_BASE_URL, MULTIHOPPER_READ_ONLY_AUTHORITY,
  MultiHopperDevnetReadOnlyClient, verifyMultiHopperWebhookRawBody,
} from './multihopper-devnet-readonly.js';

const mint = 'So11111111111111111111111111111111111111112';
const testKey = 'mh_test_example';
const estimate = {
  tier: 'standard', percentFeeBps: 5, percentFeeRaw: '500000',
  flatFeeLamportsPerHop: 6000, totalFlatFeeLamports: 42000,
  integratorPercentShare: '250000', integratorFlatShare: 21000,
  usdEquivalent: 150.25, isTestMode: true,
};
function mock(payload: unknown, status = 200, seen: Array<{url:string;init:RequestInit}> = []) {
  return async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  };
}
test('read-only capability contract has no payment or signing capability', () => {
  assert.equal(MULTIHOPPER_READ_ONLY_AUTHORITY.canCreateTransfer, false);
  assert.equal(MULTIHOPPER_READ_ONLY_AUTHORITY.canSign, false);
  assert.equal(MULTIHOPPER_READ_ONLY_AUTHORITY.canBroadcast, false);
  assert.equal(MULTIHOPPER_READ_ONLY_AUTHORITY.canMoveFunds, false);
  const client = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock(estimate) });
  assert.equal('createTransfer' in client, false);
  assert.equal('prepareTransfer' in client, false);
  assert.equal('confirmBroadcast' in client, false);
});
test('rejects production API keys before any network call', () => {
  assert.throws(() => new MultiHopperDevnetReadOnlyClient({ apiKey: 'mh_live_example' }), /TEST_KEY_REQUIRED/);
});
test('quotes via fixed devnet endpoint and carries non-executable evidence', async () => {
  const calls: Array<{url:string;init:RequestInit}> = [];
  const client = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock(estimate, 200, calls) });
  const result = await client.estimate({ tokenMint: mint, amountRaw: '1000000000', tokenDecimals: 9, hops: 7 });
  assert.equal(result.totalFlatFeeLamports, 42000);
  assert.equal(result.canMoveFunds, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, MULTIHOPPER_DEVNET_BASE_URL + '/transfers/estimate');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string,string>)['x-api-key'], testKey);
});
test('rejects bad inputs without calling provider', async () => {
  const calls: Array<{url:string;init:RequestInit}> = [];
  const client = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock(estimate, 200, calls) });
  await assert.rejects(client.estimate({ tokenMint: mint, amountRaw: '0', tokenDecimals: 9, hops: 7 }), /AMOUNT_INVALID/);
  await assert.rejects(client.estimate({ tokenMint: mint, amountRaw: '100', tokenDecimals: 9, hops: 11 }), /HOPS_INVALID/);
  await assert.rejects(client.estimate({ tokenMint: 'not-a-wallet', amountRaw: '100', tokenDecimals: 9, hops: 7 }), /MINT_INVALID/);
  await assert.rejects(client.getTransfer('42/prepare'), /TRANSFER_ID_INVALID/);
  await assert.rejects(client.getTransferByExternalId('../prepare'), /EXTERNAL_ID_INVALID/);
  assert.equal(calls.length, 0);
});
test('rejects quote marked live even when contacted through devnet', async () => {
  const client = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock({ ...estimate, isTestMode: false }) });
  await assert.rejects(client.estimate({ tokenMint: mint, amountRaw: '100', tokenDecimals: 9, hops: 7 }), /TEST_MODE_NOT_CONFIRMED/);
});
test('rejects production transfer and observes test transfer by ID', async () => {
  const live = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock({ id: 42, status: 'processing', isTest: false }) });
  await assert.rejects(live.getTransfer('42'), /NONTEST_TRANSFER_REFUSED/);
  const calls: Array<{url:string;init:RequestInit}> = [];
  const testClient = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock({ id: 42, status: 'completed', isTest: true }, 200, calls) });
  const result = await testClient.getTransferByExternalId('invoice_1');
  assert.equal(result.id, '42');
  assert.equal(result.canMoveFunds, false);
  assert.equal(calls[0].url, MULTIHOPPER_DEVNET_BASE_URL + '/transfers/by-external/invoice_1');
  assert.equal(calls[0].init.method, 'GET');
});
test('redacts provider response bodies and credentials from failures', async () => {
  const client = new MultiHopperDevnetReadOnlyClient({ apiKey: testKey, fetchFn: mock({ internal: 'SECRET_KEY' }, 429) });
  await assert.rejects(client.getTransfer('42'), (err: unknown) => {
    assert.equal((err as Error).message, 'MULTIHOPPER_DEVNET_HTTP_429');
    assert.equal((err as Error).message.includes(testKey), false);
    return true;
  });
});
test('webhook HMAC validates original bytes and rejects malformed signatures safely', () => {
  const body = Buffer.from('{"event":"transfer.completed","transferId":42}');
  const secret = 'whsec_test_value';
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyMultiHopperWebhookRawBody(body, signature, secret), true);
  assert.equal(verifyMultiHopperWebhookRawBody(Buffer.from('{}'), signature, secret), false);
  assert.equal(verifyMultiHopperWebhookRawBody(body, 'a', secret), false);
  assert.equal(verifyMultiHopperWebhookRawBody(body, 'invalid', secret), false);
  assert.equal(verifyMultiHopperWebhookRawBody(body, undefined, secret), false);
});

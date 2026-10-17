import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canaryConfig, runCanary } from './jtv-postmerge-rls-canary.mjs';

const fake = {
  JTV_CANARY_URL: 'https://kqbkaozfjubkjevdfvic.supabase.co/',
  JTV_CANARY_PUBLISHABLE_KEY: 'not-a-real-key',
  JTV_CANARY_OWNER_JWT: 'not.a.valid-token',
  JTV_CANARY_SECOND_JWT: 'not.another.valid-token',
  JTV_CANARY_EXPECTED_OWNER_ID: '00000000-0000-0000-0000-000000000001',
  JTV_CANARY_ALLOW_WRITES: 'YES',
  JTV_CANARY_TEST_USERS_ONLY: 'YES',
};
describe('JTV postmerge live RLS commissioning canary', () => {
  it('fails closed on absent keys, permissions, or wrong project', () => {
    assert.equal(canaryConfig({}).ready, false);
    assert.equal(canaryConfig({ ...fake, JTV_CANARY_ALLOW_WRITES: '' }).ready, false);
    assert.equal(canaryConfig({ ...fake, JTV_CANARY_URL: 'https://evil.example/' }).ready, false);
    assert.equal(canaryConfig({ ...fake, JTV_CANARY_URL: 'http://kqbkaozfjubkjevdfvic.supabase.co/' }).ready, false);
    assert.equal(canaryConfig({ ...fake, JTV_CANARY_SECOND_JWT: fake.JTV_CANARY_OWNER_JWT }).ready, false);
  });
  it('requires real signed-in user identities before any network request', async () => {
    let calls = 0;
    await assert.rejects(runCanary(fake, async () => { calls++; throw Error('network not allowed'); }),
      /NOT_COMMISSIONED/);
    assert.equal(calls, 0);
  });
});

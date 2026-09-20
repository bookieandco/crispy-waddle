import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function source(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  );
}

function includesAll(
  text: string,
  fragments: readonly string[],
  label: string,
): void {
  for (const fragment of fragments) {
    assert.ok(
      text.includes(fragment),
      label + ' contract drift: missing ' + fragment,
    );
  }
}

test('Plaid source remains pinned to the registered version/header/endpoint', () => {
  const text = source('../../money-core/src/plaid-read-only-adapter.ts');
  includesAll(
    text,
    [
      "PLAID_API_VERSION = '2020-09-14'",
      "'Plaid-Version': PLAID_API_VERSION",
      "'/accounts/get'",
      "'PLAID-CLIENT-ID'",
      "'PLAID-SECRET'",
    ],
    'Plaid',
  );
});

test('Stripe source remains pinned to the registered API version and payment endpoints', () => {
  const text = source(
    '../../../apps/jhadina-web/src/lib/commerce/stripe-sandbox-provider.ts',
  );
  includesAll(
    text,
    [
      'STRIPE_API_VERSION = "2026-08-26.dahlia"',
      '"Stripe-Version": STRIPE_API_VERSION',
      '"/v1/payment_intents"',
      '"/v1/refunds"',
      '"/capture"',
      '"Idempotency-Key"',
    ],
    'Stripe',
  );
});

test('Anthropic source remains pinned to Messages API version', () => {
  const text = source(
    '../../jhadina-intelligence-core/src/anthropic-model-provider.ts',
  );
  includesAll(
    text,
    [
      "ANTHROPIC_VERSION = '2023-06-01'",
      "'https://api.anthropic.com'",
      '/v1/messages',
      "'anthropic-version': ANTHROPIC_VERSION",
    ],
    'Anthropic',
  );
});

test('Shodan and InternetDB source endpoints stay inside the registered read-only contract', () => {
  const text = source(
    '../../jhadina-intelligence-core/src/shodan-http-transport.ts',
  );
  includesAll(
    text,
    [
      "'https://api.shodan.io'",
      "'https://internetdb.shodan.io'",
      '/shodan/host/',
      '/dns/resolve',
      '/shodan/host/search',
      'history=true',
    ],
    'Shodan',
  );
});

test('SHARK provider paths conform to DexScreener, CoinGecko and Helius contract snapshots', () => {
  const dex = source(
    '../../shark-intelligence-core/src/meme-trader/pool-discovery.ts',
  );
  includesAll(
    dex,
    [
      "'https://api.dexscreener.com'",
      '/token-pairs/v1/',
    ],
    'DexScreener',
  );

  const gecko = source(
    '../../shark-intelligence-core/src/meme-trader/coingecko-historical-source.ts',
  );
  includesAll(
    gecko,
    [
      "'https://pro-api.coingecko.com/api/v3'",
      '/onchain/networks/',
      '/ohlcv/',
      '/holders_chart',
      "'x-cg-pro-api-key'",
    ],
    'CoinGecko',
  );

  const helius = source(
    '../../shark-intelligence-core/src/meme-trader/helius-historical-source.ts',
  );
  includesAll(
    helius,
    [
      "'https://mainnet.helius-rpc.com'",
      "jsonrpc: '2.0'",
      "'getTransfersByAddress'",
    ],
    'Helius',
  );
});

test('SAM.gov source remains on Opportunities public API v2', () => {
  const text = source(
    '../../../apps/jhadina-web/src/lib/money-opportunities/sam-config.ts',
  );
  includesAll(
    text,
    [
      "'https://api.sam.gov/opportunities/v2/search'",
    ],
    'SAM.gov',
  );
});

test('ComfyUI source remains on the registered HTTP surface', () => {
  const text = source('../../director-core/src/comfyui-http.ts');
  includesAll(
    text,
    [
      "'/prompt'",
      '/history/',
      "'/history'",
      "'/interrupt'",
      'prompt_id',
    ],
    'ComfyUI',
  );
});

test('Reticulum source preserves the bridge send contract', () => {
  const text = source(
    '../../jhadina-intelligence-core/src/reticulum-adapter.ts',
  );
  includesAll(
    text,
    [
      'bridge.send',
      'destination:',
      'contentRef:',
      'correlationId:',
      'receiptRef',
    ],
    'Reticulum',
  );
});

test('Supabase source and lock remain on the registered client/RPC contract', () => {
  const serviceRole = source(
    '../../../apps/jhadina-web/src/lib/supabase/service-role.ts',
  );
  includesAll(
    serviceRole,
    [
      '@supabase/supabase-js',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'createClient',
    ],
    'Supabase service role',
  );

  const ledger = source(
    '../../jhadina-action-core/src/supabase-audit-ledger.ts',
  );
  includesAll(
    ledger,
    [
      "'append_jhadina_audit_event'",
      "'list_jhadina_audit_events'",
      'p_actor_id',
      'p_domain',
    ],
    'Supabase audit ledger',
  );

  const lock = source('../../../pnpm-lock.yaml');
  includesAll(
    lock,
    [
      "'@supabase/supabase-js':",
      'version: 2.116.0',
    ],
    'Supabase lockfile',
  );
});

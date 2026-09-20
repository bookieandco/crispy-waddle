#!/usr/bin/env -S node --import tsx

import Stripe from 'stripe';
import { listShops } from '../lib/printify';
import {
  evaluateCatalog,
  evaluateLaunchEnvironment,
  evaluateStorageBuckets,
  GateCheck,
  StorageBucketSummary,
  CatalogVariantSummary,
  summarizeGate,
} from '../lib/launch-readiness';

const requiredTables = [
  'pupson_media_assets',
  'pupson_pet_identities',
  'pupson_pet_identity_assets',
  'pupson_creative_jobs',
  'pupson_creative_job_attempts',
  'pupson_creative_outputs',
  'pupson_catalog_variants',
  'pupson_orders',
  'pupson_order_items',
  'pupson_fulfillment_orders',
  'pupson_fulfillment_events',
  'pupson_usage_events',
] as const;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function supabaseFetch<T>(path: string): Promise<T> {
  const value = config();
  if (!value) throw new Error('Supabase server credentials are not configured.');
  const response = await fetch(`${value.url}${path}`, {
    headers: { apikey: value.key, Authorization: `Bearer ${value.key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return (await response.json()) as T;
}

async function probeSupabase(): Promise<GateCheck[]> {
  if (!config()) return [];
  const checks: GateCheck[] = [];
  try {
    const buckets = await supabaseFetch<StorageBucketSummary[]>('/storage/v1/bucket');
    checks.push(...evaluateStorageBuckets(buckets));
  } catch (error) {
    checks.push({
      id: 'supabase.storage',
      status: 'block',
      message: `Storage probe failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  for (const table of requiredTables) {
    try {
      await supabaseFetch<unknown[]>(`/rest/v1/${table}?select=*&limit=0`);
      checks.push({ id: `supabase.${table}`, status: 'pass', message: `${table} is reachable.` });
    } catch (error) {
      checks.push({
        id: `supabase.${table}`,
        status: 'block',
        message: `${table} probe failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  try {
    const rows = await supabaseFetch<CatalogVariantSummary[]>(
      '/rest/v1/pupson_catalog_variants?select=product_id,variant_id,active,provider,certification_status&limit=1000'
    );
    checks.push(...evaluateCatalog(rows));
  } catch {
    // The table probe above already reports the actionable error.
  }
  return checks;
}

async function probePrintify(): Promise<GateCheck[]> {
  if (!process.env.PRINTIFY_API_KEY || !process.env.PRINTIFY_SHOP_ID) return [];
  try {
    const shops = await listShops();
    const expected = process.env.PRINTIFY_SHOP_ID;
    const selected = shops.find((shop) => String(shop.id) === expected);
    return [
      selected
        ? {
            id: 'printify.shop',
            status: 'pass',
            message: `Configured Printify shop exists (${selected.title}).`,
          }
        : {
            id: 'printify.shop',
            status: 'block',
            message: 'PRINTIFY_SHOP_ID is not present in the authenticated Printify account.',
          },
    ];
  } catch (error) {
    return [
      {
        id: 'printify.api',
        status: 'block',
        message: `Printify read-only probe failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

async function probeStripe(): Promise<GateCheck[]> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return [];
  try {
    const balance = await new Stripe(key).balance.retrieve();
    return [
      {
        id: 'stripe.api',
        status: balance.livemode ? 'block' : 'pass',
        message: balance.livemode
          ? 'Stripe credentials are live; certification must use test mode.'
          : 'Stripe test-mode API credentials are valid.',
      },
    ];
  } catch (error) {
    return [
      {
        id: 'stripe.api',
        status: 'block',
        message: `Stripe read-only probe failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

async function main() {
  const checks = [
    ...evaluateLaunchEnvironment(),
    ...(await probeSupabase()),
    ...(await probePrintify()),
    ...(await probeStripe()),
  ];
  const summary = summarizeGate(checks);
  const report = { generatedAt: new Date().toISOString(), fulfillmentMode: process.env.PUPSON_FULFILLMENT_MODE ?? null, summary, checks };
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(5)} ${check.id}: ${check.message}`);
    console.log(`\nLaunch preflight: ${summary.pass} passed, ${summary.warn} warnings, ${summary.block} blockers.`);
  }
  if (summary.block > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

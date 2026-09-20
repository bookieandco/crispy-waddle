import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminSession, isAdminSession } from '../lib/admin-auth';
import { validateCart } from '../lib/catalog';
import { catalogHasNoPlaceholders } from '../lib/checkout-readiness';
import { newOwnerToken, ownerTokenHash } from '../lib/platform';
import { hotspots } from '../data/hotspots';

afterEach(() => vi.unstubAllEnvs());

describe('PupsonStuff closeout contracts', () => {
  it('creates opaque owner tokens and stores only deterministic hashes', () => {
    const token = newOwnerToken();
    expect(token.length).toBeGreaterThan(32);
    expect(ownerTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(ownerTokenHash(token)).not.toContain(token);
  });

  it('signs expiring admin sessions and rejects tampering', () => {
    vi.stubEnv('PUPSON_ADMIN_SESSION_SECRET', 'test-secret-that-is-long-and-random');
    const session = createAdminSession();
    expect(isAdminSession(session)).toBe(true);
    expect(isAdminSession(`${session}tampered`)).toBe(false);
  });

  it('refuses legacy cart lines without a durable creative output', () => {
    const product = hotspots.find((item) => item.fulfillment)!;
    const variant = product.fulfillment!.variants[0];
    expect(
      validateCart([
        {
          id: 'line-1',
          productId: product.id,
          variantId: variant.variantId,
          productName: product.name,
          artStyle: 'watercolor',
          quantity: 1,
        },
      ])
    ).toBeNull();
  });

  it('accepts a structurally complete approved-output candidate for server certification', () => {
    const product = hotspots.find((item) => item.fulfillment)!;
    const variant = product.fulfillment!.variants[0];
    const result = validateCart([
      {
        id: 'line-1',
        productId: product.id,
        variantId: variant.variantId,
        productName: product.name,
        artStyle: 'watercolor',
        quantity: 1,
        creativeOutputId: '00000000-0000-4000-8000-000000000001',
      },
    ]);
    expect(result?.[0].priceCents).toBe(variant.priceCents);
  });

  it('keeps launch blocked while source catalog placeholders remain', () => {
    expect(catalogHasNoPlaceholders()).toBe(false);
  });

  it('ships a private, RLS-enabled production schema', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260919135817_pupsonstuff_closeout_core.sql'
      ),
      'utf8'
    );
    for (const table of [
      'pupson_media_assets',
      'pupson_pet_identities',
      'pupson_creative_jobs',
      'pupson_creative_outputs',
      'pupson_catalog_variants',
      'pupson_fulfillment_orders',
      'pupson_fulfillment_events',
    ])
      expect(migration).toContain(table);
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table');
    expect(migration).toContain("'pupson-print-ready'");
    expect(migration).toContain('PS-CLOSE cannot replace populated legacy table');
    expect(migration).toContain("column_name = 'owner_token_hash'");
  });

  it('runs PupsonStuff CI on main pushes', () => {
    const workflow = readFileSync(
      resolve(process.cwd(), '../../.github/workflows/pupsonstuff-ci.yml'),
      'utf8'
    );
    expect(workflow).toMatch(/branches:\s*\n\s*- main/);
  });

  it('hardens legacy trigger functions and covers closeout foreign keys', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../../supabase/migrations/20260920141955_pupsonstuff_post_apply_hardening.sql'
      ),
      'utf8'
    );
    expect(migration).toContain(
      'revoke all on function public.create_pupson_pod_job_for_creation() from public, anon, authenticated'
    );
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('pupson_order_items_creative_output_idx');
    expect(migration).toContain('pupson_pet_identity_media_asset_idx');
  });
});

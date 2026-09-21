import { describe, expect, it } from 'vitest';
import {
  evaluateCatalog,
  evaluateLaunchEnvironment,
  evaluateStorageBuckets,
  summarizeGate,
} from '../lib/launch-readiness';

const validEnv = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
  STRIPE_SECRET_KEY: 'sk_test_example',
  STRIPE_WEBHOOK_SECRET: 'whsec_example',
  PRINTIFY_API_KEY: 'printify-key',
  PRINTIFY_SHOP_ID: '1234',
  OPENAI_API_KEY: 'openai-key',
  MUAPI_API_KEY: 'muapi-key',
  PUPSON_ADMIN_USERNAME: 'operator',
  PUPSON_ADMIN_PASSWORD: 'a-very-long-admin-password',
  PUPSON_ADMIN_SESSION_SECRET: 'a'.repeat(32),
  PUPSON_PRINTIFY_WEBHOOK_SECRET: 'b'.repeat(32),
  CRON_SECRET: 'c'.repeat(32),
  PUPSON_BACKGROUND_REMOVER_PROVIDER: 'backgroundremover',
  PUPSON_BACKGROUND_REMOVER_URL: 'https://background.example',
  PUPSON_UPSCALER_URL: 'https://upscale.example',
  PUPSON_FULFILLMENT_MODE: 'dry_run',
  PUPSON_PUBLIC_ORIGIN: 'https://pupsonstuff.example',
} as NodeJS.ProcessEnv;

describe('PupsonStuff launch readiness', () => {
  it('passes a complete dry-run certification environment', () => {
    expect(summarizeGate(evaluateLaunchEnvironment(validEnv)).block).toBe(0);
  });

  it('blocks launch when creative preprocessing is not configured', () => {
    const checks = evaluateLaunchEnvironment({
      ...validEnv,
      PUPSON_BACKGROUND_REMOVER_URL: '',
      PUPSON_UPSCALER_URL: '',
      KNOCKOUT_TOKEN: '',
    });
    expect(checks.find((check) => check.id === 'env.BACKGROUND_REMOVER')?.status).toBe('block');
    expect(checks.find((check) => check.id === 'env.IMAGE_UPSCALER')?.status).toBe('block');
  });

  it('blocks live fulfillment before physical certification', () => {
    const checks = evaluateLaunchEnvironment({ ...validEnv, PUPSON_FULFILLMENT_MODE: 'live' });
    expect(checks.find((check) => check.id === 'env.PUPSON_FULFILLMENT_MODE')?.status).toBe(
      'block'
    );
  });

  it('blocks secrets exposed through NEXT_PUBLIC aliases', () => {
    const checks = evaluateLaunchEnvironment({
      ...validEnv,
      NEXT_PUBLIC_STRIPE_SECRET_KEY: 'leaked',
    });
    expect(checks.find((check) => check.id === 'env.public.STRIPE_SECRET_KEY')?.status).toBe(
      'block'
    );
  });

  it('requires all storage buckets to exist and remain private', () => {
    const checks = evaluateStorageBuckets([
      { id: 'pupson-originals', public: false },
      { id: 'pupson-creative', public: true },
    ]);
    expect(summarizeGate(checks)).toEqual({ pass: 1, warn: 0, block: 2 });
  });

  it('keeps the sample gate closed after sandbox certification', () => {
    const checks = evaluateCatalog([
      {
        product_id: 'mugWhite',
        variant_id: 'mug-11oz',
        active: true,
        provider: 'printify',
        certification_status: 'sandbox_verified',
      },
    ]);
    expect(checks.find((check) => check.id === 'catalog.sandbox')?.status).toBe('pass');
    expect(checks.find((check) => check.id === 'catalog.samples')?.status).toBe('block');
  });
});

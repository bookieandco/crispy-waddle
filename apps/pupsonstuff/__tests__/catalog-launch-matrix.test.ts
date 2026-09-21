import { describe, expect, it } from 'vitest';
import { evaluateCatalog, REQUIRED_LAUNCH_VARIANTS } from '../lib/launch-readiness';

describe('prototype catalog launch matrix', () => {
  const rows = REQUIRED_LAUNCH_VARIANTS.map(({ productId, variantId }) => ({
    product_id: productId,
    variant_id: variantId,
    active: true,
    provider: 'printify',
    certification_status: 'sandbox_verified',
  }));

  it('passes sandbox only when all required prototype variants are certified', () => {
    expect(evaluateCatalog(rows).find((x) => x.id === 'catalog.sandbox')?.status).toBe('pass');
  });

  it('passes physical samples only when every required prototype variant passed', () => {
    const sampled = rows.map((row) => ({ ...row, certification_status: 'sample_verified' }));
    expect(evaluateCatalog(sampled).find((x) => x.id === 'catalog.samples')?.status).toBe('pass');
  });
});

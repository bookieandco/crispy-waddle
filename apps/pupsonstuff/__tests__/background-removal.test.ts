import { describe, expect, it } from 'vitest';
import { removeBackground } from '../lib/background-removal';

describe('background-removal boundary', () => {
  it('keeps the original bytes when the shopper explicitly chooses keep', async () => {
    const bytes = Buffer.from('image-bytes');
    const result = await removeBackground(bytes, 'image/png', 'keep', {});
    expect(result.provider).toBe('none');
    expect(result.bytes).toEqual(bytes);
  });

  it('fails closed when removal is requested without a configured provider', async () => {
    await expect(
      removeBackground(Buffer.from('image-bytes'), 'image/png', 'auto', {})
    ).rejects.toThrow('no background-removal provider is configured');
  });
});

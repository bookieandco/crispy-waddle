import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePrintifyShopId } from '../lib/printify';

const fetchMock = vi.fn();

function response(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as Response;
}

beforeEach(() => {
  vi.stubEnv('PRINTIFY_API_KEY', 'printify-test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Printify shop resolution', () => {
  it('uses an explicit shop id without an account lookup', async () => {
    await expect(resolvePrintifyShopId('1234')).resolves.toBe('1234');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('auto-resolves the sole authenticated shop', async () => {
    fetchMock.mockResolvedValue(
      response([{ id: 19810464, title: 'My new store', sales_channel: 'disconnected' }])
    );

    await expect(resolvePrintifyShopId('')).resolves.toBe('19810464');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the authenticated account has multiple shops', async () => {
    fetchMock.mockResolvedValue(
      response([
        { id: 1, title: 'One', sales_channel: 'disconnected' },
        { id: 2, title: 'Two', sales_channel: 'disconnected' },
      ])
    );

    await expect(resolvePrintifyShopId('')).rejects.toThrow(
      'PRINTIFY_SHOP_ID is required when the authenticated Printify account has multiple shops.'
    );
  });

  it('fails closed when the authenticated account has no shop', async () => {
    fetchMock.mockResolvedValue(response([]));

    await expect(resolvePrintifyShopId('')).rejects.toThrow(
      'No Printify shop is available for the authenticated account.'
    );
  });
});

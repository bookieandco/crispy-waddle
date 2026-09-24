import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PrintifyApiError,
  listBlueprints,
  listPrintProvidersForBlueprint,
  listVariants,
} from '../lib/printify';

const originalKey = process.env.PRINTIFY_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.PRINTIFY_API_KEY;
  else process.env.PRINTIFY_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe('Printify certification client fails closed', () => {
  it('rejects a missing API key instead of returning mock catalog data', async () => {
    delete process.env.PRINTIFY_API_KEY;

    await expect(listBlueprints()).rejects.toMatchObject({
      name: 'PrintifyApiError',
      status: 0,
      message: 'PRINTIFY_API_KEY is not configured.',
    });
  });

  it('rejects provider errors instead of falling back to mock blueprints', async () => {
    process.env.PRINTIFY_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ message: 'Unauthorized', code: 401 }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    await expect(listBlueprints()).rejects.toBeInstanceOf(PrintifyApiError);
    await expect(listBlueprints()).rejects.toMatchObject({ status: 401 });
  });

  it('uses the live catalog endpoints required by the read-only MCP subset', async () => {
    process.env.PRINTIFY_API_KEY = 'test-key';
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/v1/catalog/blueprints.json')) {
        return new Response('[]', { status: 200 });
      }
      if (url.endsWith('/v1/catalog/blueprints/123/print_providers.json')) {
        return new Response('[]', { status: 200 });
      }
      if (
        url.includes('/v1/catalog/blueprints/123/print_providers/456/variants.json')
      ) {
        return new Response(
          JSON.stringify({ id: 123, title: 'Example', variants: [] }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ message: 'unexpected request' }), {
        status: 500,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await listBlueprints();
    await listPrintProvidersForBlueprint(123);
    await listVariants(123, 456);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      const options = call[1] as RequestInit | undefined;
      expect(options?.headers).toMatchObject({
        Authorization: 'Bearer test-key',
      });
    }
  });
});

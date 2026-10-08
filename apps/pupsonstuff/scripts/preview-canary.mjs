#!/usr/bin/env node
/**
 * Secretless, read-only smoke canary for a dedicated PupsonStuff Vercel preview.
 * Never calls Stripe, Printify or a worker mutation endpoint.
 */
import { fileURLToPath } from 'node:url';

export function parsePreviewUrl(value) {
  if (typeof value !== 'string' || value.length > 512) throw Error('Preview URL is required.');
  let url;
  try { url = new URL(value); } catch { throw Error('Invalid preview URL.'); }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.vercel.app') ||
    url.hostname === 'vercel.app' ||
    url.username || url.password || url.port ||
    url.pathname !== '/' || url.search || url.hash
  ) throw Error('Only a clean HTTPS *.vercel.app preview origin is accepted.');
  return url.origin;
}

async function guardedFetch(origin, path, fetchImpl, accept) {
  const response = await fetchImpl(origin + path, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'error',
    credentials: 'omit',
    headers: { Accept: accept },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Error(`Preview ${path} returned HTTP ${response.status}.`);
  return response;
}

export async function verifyPupsonPreview({
  url,
  expectedCommit = '',
  fetchImpl = fetch,
}) {
  const origin = parsePreviewUrl(url);
  if (expectedCommit && !/^[a-f0-9]{7,40}$/i.test(expectedCommit))
    throw Error('Expected commit must be 7–40 hex characters.');
  const probe = await guardedFetch(origin, '/api/health', fetchImpl, 'application/json');
  if (!String(probe.headers?.get('content-type') ?? '').includes('application/json'))
    throw Error('Preview health check did not return JSON.');
  const healthText = await probe.text();
  if (healthText.length > 8192) throw Error('Health response exceeded the safe limit.');
  let health;
  try { health = JSON.parse(healthText); }
  catch { throw Error('Preview health JSON was invalid.'); }
  if (
    health?.service !== 'pupsonstuff' ||
    health?.status !== 'ok' ||
    health?.database !== 'reachable' ||
    health?.environment !== 'preview' ||
    health?.fulfillmentMode !== 'dry_run'
  ) throw Error('Preview health is not PupsonStuff preview with reachable database and dry-run fulfillment.');
  if (expectedCommit && (
    typeof health.commit !== 'string' ||
    !health.commit.toLowerCase().startsWith(expectedCommit.slice(0, 12).toLowerCase())
  )) throw Error('Preview commit did not match the requested source commit.');
  const page = await guardedFetch(origin, '/', fetchImpl, 'text/html');
  if (!String(page.headers?.get('content-type') ?? '').includes('text/html'))
    throw Error('Preview root is not served as HTML.');
  // Root HTML is not logged; its content may include temporary signed links.
  return {
    schema: 'pupson.preview-canary.v1',
    origin,
    checks: {
      health: 'pass',
      dedicatedApp: 'pass',
      database: 'reachable',
      fulfillmentMode: 'dry_run',
      staticStorefront: 'pass',
      commit: health.commit ?? null,
    },
    doesNotCertify: [
      'real photo-to-print execution',
      'Stripe test payment and webhook',
      'live domain or production payments',
      'Printify order submission or physical samples',
      'iPhone 3D/drag UX',
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyPupsonPreview({
    url: process.env.PUPSON_PREVIEW_URL,
    expectedCommit: process.env.PUPSON_PREVIEW_COMMIT || '',
  }).then(x => console.log(JSON.stringify(x, null, 2))).catch(error => {
    console.error(error instanceof Error ? error.message : 'Unknown preview verification failure.');
    process.exitCode = 1;
  });
}

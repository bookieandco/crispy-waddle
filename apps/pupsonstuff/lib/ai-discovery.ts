import { createHash } from 'node:crypto';
import {
  renderOwnedWebAgenticSitemap,
  renderOwnedWebEntityMarkdown,
  renderOwnedWebJsonl,
  renderOwnedWebLlmsTxt,
} from '@jhadina/growth-core';
import {
  buildPupsonDiscoveryManifest,
  getPublicCatalogProduct,
  pupsonPublicBaseUrl,
} from '@/lib/public-discovery';

export { pupsonPublicBaseUrl };

export async function renderPupsonLlmsTxt(baseUrl = pupsonPublicBaseUrl()): Promise<string> {
  return renderOwnedWebLlmsTxt(await buildPupsonDiscoveryManifest(baseUrl));
}

export async function renderPupsonLlmsJsonl(baseUrl = pupsonPublicBaseUrl()): Promise<string> {
  return renderOwnedWebJsonl(await buildPupsonDiscoveryManifest(baseUrl));
}

export async function renderPupsonAgenticSitemap(baseUrl = pupsonPublicBaseUrl()): Promise<string> {
  const manifest = await buildPupsonDiscoveryManifest(baseUrl);
  return renderOwnedWebAgenticSitemap(manifest, [
    `${baseUrl}/llms.txt`,
    `${baseUrl}/llms.jsonl`,
    `${baseUrl}/agents.md`,
    `${baseUrl}/sitemap_agentic_discovery.xml`,
  ]);
}

export async function renderPupsonProductMarkdown(
  id: string,
  baseUrl = pupsonPublicBaseUrl(),
): Promise<string | null> {
  const manifest = await buildPupsonDiscoveryManifest(baseUrl);
  const entity = manifest.entities.find((candidate) => candidate.id === `product:${id}`);
  return entity ? renderOwnedWebEntityMarkdown(entity) : null;
}

export async function renderPupsonAgentsMd(baseUrl = pupsonPublicBaseUrl()): Promise<string> {
  const products = await getPublicCatalogProductListForAgents(baseUrl);
  return [
    '# PupsonStuff — Agent Guidance',
    '',
    '## Canonical public sources',
    `- Storefront: ${baseUrl}`,
    `- Discovery index: ${baseUrl}/llms.txt`,
    `- Structured catalog: ${baseUrl}/llms.jsonl`,
    `- Agent discovery sitemap: ${baseUrl}/sitemap_agentic_discovery.xml`,
    '',
    '## Grounding rules',
    '- Use current public product pages as the authority for names, descriptions, prices, customization options, and checkout-facing facts.',
    '- The current catalog certification ledger proves fulfillment mapping readiness; it does not prove live inventory. Do not turn certification into an in-stock claim.',
    '- Do not infer delivery promises, discounts, inventory, or product options from cached or remembered information.',
    '- Do not represent a product as purchased or reserved unless the user explicitly completes the storefront checkout flow.',
    '- Prefer canonical product evidence over promotional copy for factual product questions.',
    '',
    '## Public product pages',
    ...products.map((product) => `- ${product.name}: ${product.url} (Markdown: ${product.markdownUrl})`),
    '',
    '## Scope',
    '- These files improve machine-readable discovery. They do not guarantee citation, recommendation, ranking, or ingestion by an AI/search system.',
    '',
  ].join('\n');
}

export function buildDiscoveryResponse(
  request: Request,
  body: string,
  contentType: string,
): Response {
  const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    });
  }
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      ETag: etag,
    },
  });
}

async function getPublicCatalogProductListForAgents(baseUrl: string): Promise<Array<{
  name: string;
  url: string;
  markdownUrl: string;
}>> {
  const manifest = await buildPupsonDiscoveryManifest(baseUrl);
  return manifest.entities.map((entity) => ({
    name: entity.name,
    url: entity.canonicalUrl,
    markdownUrl: entity.markdownUrl ?? entity.canonicalUrl,
  }));
}

import { describe, expect, it } from 'vitest';
import {
  createOwnedWebDiscoveryManifest,
  renderOwnedWebAgenticSitemap,
  renderOwnedWebEntityMarkdown,
  renderOwnedWebJsonl,
  renderOwnedWebLlmsTxt,
} from './owned-web-discovery.js';

const manifest = createOwnedWebDiscoveryManifest({
  id: 'discovery:pupson',
  brandId: 'brand:pupsonstuff',
  title: 'PupsonStuff',
  summary: 'Personalized pet products generated from pet photos.',
  canonicalUrl: 'https://pupsonstuff.example',
  generatedAt: '2026-09-30T08:00:00Z',
  keyPages: [{ label: 'Agent guidance', url: 'https://pupsonstuff.example/agents.md' }],
  evidenceRefs: ['catalog:pupson'],
  entities: [{
    id: 'product:frame1',
    brandId: 'brand:pupsonstuff',
    kind: 'product',
    name: 'Astronaut Portrait Canvas',
    summary: 'A personalized pet portrait canvas.',
    canonicalUrl: 'https://pupsonstuff.example/products/frame1',
    markdownUrl: 'https://pupsonstuff.example/products/frame1/page.md',
    availability: 'in_stock',
    price: { currency: 'USD', min: 69, max: 129 },
    attributes: { sizes: ['12×16 in', '16×20 in'] },
    evidenceRefs: ['catalog:frame1'],
    observedAt: '2026-09-30T08:00:00Z',
  }],
});

describe('owned-web AI discovery', () => {
  it('renders compact llms.txt with markdown-first entity links and no ranking guarantee', () => {
    const output = renderOwnedWebLlmsTxt(manifest);
    expect(output).toContain('[Astronaut Portrait Canvas](https://pupsonstuff.example/products/frame1/page.md)');
    expect(output).toContain('$69.00–$129.00');
    expect(output).toContain('does not guarantee ranking');
  });

  it('renders a factual markdown mirror', () => {
    const output = renderOwnedWebEntityMarkdown(manifest.entities[0]!);
    expect(output).toContain('Canonical URL: https://pupsonstuff.example/products/frame1');
    expect(output).toContain('Availability: in_stock');
    expect(output).toContain('Price: $69.00–$129.00');
  });

  it('renders one JSON object per entity and preserves evidence refs', () => {
    const rows = renderOwnedWebJsonl(manifest).trim().split('\n').map((row) => JSON.parse(row));
    expect(rows).toHaveLength(1);
    expect(rows[0].md_url).toBe('https://pupsonstuff.example/products/frame1/page.md');
    expect(rows[0].evidence_refs).toEqual(['catalog:frame1']);
  });

  it('renders canonical and markdown surfaces into the agentic sitemap', () => {
    const output = renderOwnedWebAgenticSitemap(manifest, ['https://pupsonstuff.example/llms.txt']);
    expect(output).toContain('<loc>https://pupsonstuff.example/products/frame1</loc>');
    expect(output).toContain('<loc>https://pupsonstuff.example/products/frame1/page.md</loc>');
    expect(output).toContain('<loc>https://pupsonstuff.example/llms.txt</loc>');
  });

  it('rejects duplicate canonical URLs', () => {
    expect(() => createOwnedWebDiscoveryManifest({
      ...manifest,
      entities: [manifest.entities[0]!, { ...manifest.entities[0]!, id: 'product:frame2' }],
    })).toThrow('GROWTH_OWNED_WEB_CANONICAL_DUPLICATE');
  });
});

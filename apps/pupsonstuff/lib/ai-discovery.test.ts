import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/platform', () => ({
  getPlatformConfig: () => null,
  rest: async () => [],
}));

import {
  buildDiscoveryResponse,
  renderPupsonAgenticSitemap,
  renderPupsonAgentsMd,
  renderPupsonLlmsJsonl,
  renderPupsonLlmsTxt,
  renderPupsonProductMarkdown,
} from './ai-discovery';

describe('PupsonStuff AI discovery surfaces', () => {
  const base = 'https://pupsonstuff.example';

  it('publishes a catalog-backed compact llms.txt without ranking promises', async () => {
    const output = await renderPupsonLlmsTxt(base);
    expect(output).toContain('# PupsonStuff');
    expect(output).toContain(`${base}/agents.md`);
    expect(output).toContain(`${base}/products/frame1/page.md`);
    expect(output).toContain('does not guarantee ranking');
  });

  it('tells agents to ground commerce facts in canonical product pages', async () => {
    const output = await renderPupsonAgentsMd(base);
    expect(output).toContain('Use current public product pages as the authority');
    expect(output).toContain('does not prove live inventory');
    expect(output).toContain(`${base}/products/frame1`);
  });

  it('emits structured product records without provider IDs', async () => {
    const output = await renderPupsonLlmsJsonl(base);
    const rows = output.trim().split('\n').map((row) => JSON.parse(row));
    const frame = rows.find((row) => row.id === 'product:frame1');
    expect(frame.url).toBe(`${base}/products/frame1`);
    expect(frame.md_url).toBe(`${base}/products/frame1/page.md`);
    expect(JSON.stringify(frame)).not.toContain('provider_product');
  });

  it('renders product markdown from the same manifest', async () => {
    const output = await renderPupsonProductMarkdown('frame1', base);
    expect(output).toContain('# Astronaut Portrait Canvas');
    expect(output).toContain(`Canonical URL: ${base}/products/frame1`);
    expect(output).toContain('Sellability: unknown');
  });

  it('lists only public discovery surfaces in the agentic sitemap', async () => {
    const output = await renderPupsonAgenticSitemap(base);
    expect(output).toContain(`<loc>${base}</loc>`);
    expect(output).toContain(`<loc>${base}/llms.txt</loc>`);
    expect(output).toContain(`<loc>${base}/products/frame1/page.md</loc>`);
    expect(output).not.toContain('/admin');
  });

  it('supports conditional ETag requests', () => {
    const first = buildDiscoveryResponse(
      new Request(`${base}/llms.txt`),
      '# Example\n',
      'text/plain; charset=utf-8',
    );
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = buildDiscoveryResponse(
      new Request(`${base}/llms.txt`, { headers: { 'if-none-match': etag! } }),
      '# Example\n',
      'text/plain; charset=utf-8',
    );
    expect(second.status).toBe(304);
  });
});

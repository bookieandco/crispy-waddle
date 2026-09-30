import { describe, expect, it } from 'vitest';
import {
  renderPupsonAgenticSitemap,
  renderPupsonAgentsMd,
  renderPupsonLlmsTxt,
} from './ai-discovery';

describe('PupsonStuff AI discovery surfaces', () => {
  const base = 'https://pupsonstuff.example';

  it('publishes a compact llms.txt without claiming guaranteed ranking', () => {
    const output = renderPupsonLlmsTxt(base);
    expect(output).toContain('# PupsonStuff');
    expect(output).toContain(`${base}/agents.md`);
    expect(output).toContain('does not guarantee ranking');
  });

  it('tells agents to ground commerce facts in the live storefront', () => {
    const output = renderPupsonAgentsMd(base);
    expect(output).toContain('Use the current public storefront as the authority');
    expect(output).toContain('Do not infer current inventory');
  });

  it('lists only public discovery surfaces in the agentic sitemap', () => {
    const output = renderPupsonAgenticSitemap(base);
    expect(output).toContain(`<loc>${base}</loc>`);
    expect(output).toContain(`<loc>${base}/llms.txt</loc>`);
    expect(output).not.toContain('/admin');
  });
});

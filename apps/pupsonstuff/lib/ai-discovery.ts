const DEFAULT_PUBLIC_URL = 'https://pupsonstuff.com';

export function pupsonPublicBaseUrl(): string {
  const value =
    process.env.PUPSON_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    DEFAULT_PUBLIC_URL;
  return value.replace(/\/+$/, '');
}

export function renderPupsonLlmsTxt(baseUrl = pupsonPublicBaseUrl()): string {
  return [
    '# PupsonStuff',
    '',
    '> PupsonStuff helps pet owners turn pet photos into personalized products and gifts.',
    '',
    '## Primary experience',
    `- [PupsonStuff](${baseUrl}): Create and shop personalized pet products from pet photos.`,
    '',
    '## AI and agent discovery',
    `- [Agent guidance](${baseUrl}/agents.md): Grounding rules and machine-readable discovery surfaces.`,
    `- [Agent discovery sitemap](${baseUrl}/sitemap_agentic_discovery.xml): Public AI-discovery URLs.`,
    '',
    '## Accuracy',
    '- Product availability, pricing, shipping, and current product options must be grounded in the live public storefront.',
    '- This file improves machine-readable discovery but does not guarantee ranking, citation, recommendation, or inclusion by any search or answer engine.',
    '',
  ].join('\n');
}

export function renderPupsonAgentsMd(baseUrl = pupsonPublicBaseUrl()): string {
  return [
    '# PupsonStuff — Agent Guidance',
    '',
    '## Canonical public source',
    `- Storefront: ${baseUrl}`,
    `- Discovery index: ${baseUrl}/llms.txt`,
    '',
    '## Grounding rules',
    '- Use the current public storefront as the authority for product names, prices, availability, shipping, returns, and checkout information.',
    '- Do not infer current inventory, delivery time, discounts, or product options from cached or remembered information.',
    '- Do not represent a product as purchased or reserved unless the user explicitly completes the storefront checkout flow.',
    '- Prefer direct public product evidence over promotional language when answering factual product questions.',
    '',
    '## Discovery surfaces',
    `- ${baseUrl}/llms.txt`,
    `- ${baseUrl}/sitemap_agentic_discovery.xml`,
    '',
  ].join('\n');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderPupsonAgenticSitemap(baseUrl = pupsonPublicBaseUrl()): string {
  const urls = [
    baseUrl,
    `${baseUrl}/llms.txt`,
    `${baseUrl}/agents.md`,
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

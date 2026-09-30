import type { GrowthId, ISODateTime } from '../domain/types.js';

export type OwnedWebEntityKind =
  | 'product'
  | 'music'
  | 'film'
  | 'software'
  | 'service'
  | 'article'
  | 'collection'
  | 'other';

export type OwnedWebAvailability = 'in_stock' | 'out_of_stock' | 'unknown';

export interface OwnedWebPrice {
  currency: string;
  min: number;
  max: number;
}

export interface OwnedWebEntity {
  id: GrowthId;
  brandId: GrowthId;
  kind: OwnedWebEntityKind;
  name: string;
  summary: string;
  canonicalUrl: string;
  markdownUrl?: string;
  imageUrl?: string;
  availability?: OwnedWebAvailability;
  price?: OwnedWebPrice;
  attributes?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  evidenceRefs: readonly string[];
  observedAt?: ISODateTime;
}

export interface OwnedWebKeyPage {
  label: string;
  url: string;
  description?: string;
}

export interface OwnedWebDiscoveryManifest {
  id: GrowthId;
  brandId: GrowthId;
  title: string;
  summary: string;
  canonicalUrl: string;
  generatedAt: ISODateTime;
  entities: readonly OwnedWebEntity[];
  keyPages: readonly OwnedWebKeyPage[];
  evidenceRefs: readonly string[];
  authority: 'DISCOVERY_ONLY';
}

export function createOwnedWebDiscoveryManifest(input: Omit<OwnedWebDiscoveryManifest, 'authority'>): OwnedWebDiscoveryManifest {
  if (!input.id.trim() || !input.brandId.trim()) throw new Error('GROWTH_OWNED_WEB_ID_REQUIRED');
  if (!clean(input.title) || !clean(input.summary)) throw new Error('GROWTH_OWNED_WEB_SUMMARY_REQUIRED');
  assertHttpUrl(input.canonicalUrl, 'GROWTH_OWNED_WEB_CANONICAL_URL_INVALID');
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new Error('GROWTH_OWNED_WEB_GENERATED_AT_INVALID');
  if (!input.evidenceRefs.length) throw new Error('GROWTH_OWNED_WEB_EVIDENCE_REQUIRED');

  const ids = new Set<string>();
  const canonicalUrls = new Set<string>();
  for (const entity of input.entities) {
    assertEntity(entity, input.brandId);
    if (ids.has(entity.id)) throw new Error('GROWTH_OWNED_WEB_ENTITY_DUPLICATE');
    if (canonicalUrls.has(entity.canonicalUrl)) throw new Error('GROWTH_OWNED_WEB_CANONICAL_DUPLICATE');
    ids.add(entity.id);
    canonicalUrls.add(entity.canonicalUrl);
  }
  for (const page of input.keyPages) {
    if (!clean(page.label)) throw new Error('GROWTH_OWNED_WEB_KEY_PAGE_LABEL_REQUIRED');
    assertHttpUrl(page.url, 'GROWTH_OWNED_WEB_KEY_PAGE_URL_INVALID');
  }

  return Object.freeze({
    ...input,
    entities: Object.freeze(input.entities.map((entity) => freezeEntity(entity))),
    keyPages: Object.freeze(input.keyPages.map((page) => Object.freeze({ ...page }))),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    authority: 'DISCOVERY_ONLY',
  });
}

export function renderOwnedWebLlmsTxt(manifest: OwnedWebDiscoveryManifest): string {
  const sections: string[] = [
    `# ${manifest.title}`,
    '',
    `> ${clean(manifest.summary)}`,
    '',
    '## Canonical site',
    `- [${manifest.title}](${manifest.canonicalUrl}): Canonical public source.`,
  ];

  if (manifest.keyPages.length) {
    sections.push('', '## Key pages');
    for (const page of manifest.keyPages) {
      sections.push(`- [${clean(page.label)}](${page.url})${page.description ? `: ${clean(page.description)}` : ''}`);
    }
  }

  const byKind = groupByKind(manifest.entities);
  for (const [kind, entities] of byKind) {
    sections.push('', `## ${sectionTitle(kind)}`);
    for (const entity of entities) {
      const target = entity.markdownUrl ?? entity.canonicalUrl;
      sections.push(`- [${clean(entity.name)}](${target}): ${clean(entity.summary)}${renderInlineCommerce(entity)}`);
    }
  }

  sections.push(
    '',
    '## Accuracy',
    '- Machine-readable discovery is a convenience layer; canonical public pages remain authoritative.',
    '- Availability, price, dates, and other changing facts should be verified against their current canonical source.',
    '- Inclusion here does not guarantee ranking, citation, recommendation, or ingestion by any search or answer engine.',
    '',
  );
  return sections.join('\n');
}

export function renderOwnedWebEntityMarkdown(entity: OwnedWebEntity): string {
  assertEntity(entity, entity.brandId);
  const lines: string[] = [
    `# ${clean(entity.name)}`,
    '',
    clean(entity.summary),
    '',
    `Canonical URL: ${entity.canonicalUrl}`,
  ];
  if (entity.availability) lines.push(`Availability: ${entity.availability}`);
  if (entity.price) lines.push(`Price: ${renderPrice(entity.price)}`);
  if (entity.imageUrl) lines.push(`Image: ${entity.imageUrl}`);
  if (entity.attributes && Object.keys(entity.attributes).length) {
    lines.push('', '## Details');
    for (const [key, value] of Object.entries(entity.attributes)) {
      lines.push(`- ${humanize(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }
  }
  lines.push('', '## Source guidance', '- Use the canonical URL for current facts and transaction state.', '');
  return lines.join('\n');
}

export function renderOwnedWebJsonl(manifest: OwnedWebDiscoveryManifest): string {
  return manifest.entities.map((entity) => JSON.stringify({
    id: entity.id,
    brand_id: entity.brandId,
    kind: entity.kind,
    name: entity.name,
    summary: entity.summary,
    url: entity.canonicalUrl,
    md_url: entity.markdownUrl ?? null,
    image_url: entity.imageUrl ?? null,
    availability: entity.availability ?? null,
    price: entity.price ?? null,
    attributes: entity.attributes ?? {},
    observed_at: entity.observedAt ?? manifest.generatedAt,
    evidence_refs: entity.evidenceRefs,
  })).join('\n') + (manifest.entities.length ? '\n' : '');
}

export function renderOwnedWebAgenticSitemap(manifest: OwnedWebDiscoveryManifest, extraUrls: readonly string[] = []): string {
  const urls = new Set<string>([
    manifest.canonicalUrl,
    ...manifest.keyPages.map((page) => page.url),
    ...manifest.entities.flatMap((entity) => [entity.canonicalUrl, ...(entity.markdownUrl ? [entity.markdownUrl] : [])]),
    ...extraUrls,
  ]);
  for (const url of urls) assertHttpUrl(url, 'GROWTH_OWNED_WEB_SITEMAP_URL_INVALID');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...urls].sort().map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

function assertEntity(entity: OwnedWebEntity, brandId: GrowthId): void {
  if (!entity.id.trim() || !clean(entity.name) || !clean(entity.summary)) {
    throw new Error('GROWTH_OWNED_WEB_ENTITY_FIELDS_REQUIRED');
  }
  if (entity.brandId !== brandId) throw new Error('GROWTH_OWNED_WEB_ENTITY_BRAND_MISMATCH');
  assertHttpUrl(entity.canonicalUrl, 'GROWTH_OWNED_WEB_ENTITY_URL_INVALID');
  if (entity.markdownUrl) assertHttpUrl(entity.markdownUrl, 'GROWTH_OWNED_WEB_ENTITY_MARKDOWN_URL_INVALID');
  if (entity.imageUrl) assertHttpUrl(entity.imageUrl, 'GROWTH_OWNED_WEB_ENTITY_IMAGE_URL_INVALID');
  if (!entity.evidenceRefs.length) throw new Error('GROWTH_OWNED_WEB_ENTITY_EVIDENCE_REQUIRED');
  if (entity.observedAt && !Number.isFinite(Date.parse(entity.observedAt))) {
    throw new Error('GROWTH_OWNED_WEB_ENTITY_OBSERVED_AT_INVALID');
  }
  if (entity.price) {
    if (!/^[A-Z]{3}$/.test(entity.price.currency)) throw new Error('GROWTH_OWNED_WEB_PRICE_CURRENCY_INVALID');
    if (!Number.isFinite(entity.price.min) || !Number.isFinite(entity.price.max) || entity.price.min < 0 || entity.price.max < entity.price.min) {
      throw new Error('GROWTH_OWNED_WEB_PRICE_INVALID');
    }
  }
}

function freezeEntity(entity: OwnedWebEntity): OwnedWebEntity {
  return Object.freeze({
    ...entity,
    price: entity.price ? Object.freeze({ ...entity.price }) : undefined,
    attributes: entity.attributes ? Object.freeze({ ...entity.attributes }) : undefined,
    evidenceRefs: Object.freeze([...entity.evidenceRefs]),
  });
}

function assertHttpUrl(value: string, code: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(code);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(code);
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function groupByKind(entities: readonly OwnedWebEntity[]): Map<OwnedWebEntityKind, OwnedWebEntity[]> {
  const groups = new Map<OwnedWebEntityKind, OwnedWebEntity[]>();
  for (const entity of entities) {
    const group = groups.get(entity.kind) ?? [];
    group.push(entity);
    groups.set(entity.kind, group);
  }
  return groups;
}

function sectionTitle(kind: OwnedWebEntityKind): string {
  const names: Record<OwnedWebEntityKind, string> = {
    product: 'Products',
    music: 'Music',
    film: 'Films',
    software: 'Software',
    service: 'Services',
    article: 'Articles',
    collection: 'Collections',
    other: 'Other',
  };
  return names[kind];
}

function renderInlineCommerce(entity: OwnedWebEntity): string {
  const facts: string[] = [];
  if (entity.availability) facts.push(entity.availability.replace(/_/g, ' '));
  if (entity.price) facts.push(renderPrice(entity.price));
  return facts.length ? ` (${facts.join('; ')})` : '';
}

function renderPrice(price: OwnedWebPrice): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency });
  return price.min === price.max
    ? formatter.format(price.min)
    : `${formatter.format(price.min)}–${formatter.format(price.max)}`;
}

function humanize(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

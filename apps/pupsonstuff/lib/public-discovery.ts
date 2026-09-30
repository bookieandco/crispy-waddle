import {
  createOwnedWebDiscoveryManifest,
  type OwnedWebDiscoveryManifest,
  type OwnedWebEntity,
} from '@jhadina/growth-core';
import { hotspots } from '@/data/hotspots';
import { getPlatformConfig, rest } from '@/lib/platform';

export interface PublicCatalogVariant {
  variantId: string;
  label: string;
  priceCents: number;
  sellability: 'certified' | 'uncertified' | 'unknown';
}

export interface PublicCatalogProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  variants: readonly PublicCatalogVariant[];
  estimatedDeliveryDays?: readonly [number, number];
  customization?: {
    sizes?: readonly string[];
    colors?: readonly string[];
  };
  sellability: 'certified' | 'partially_certified' | 'uncertified' | 'unknown';
  canonicalUrl: string;
  markdownUrl: string;
  evidenceRefs: readonly string[];
}

interface CatalogCertificationRow {
  product_id: string;
  variant_id: string;
  active: boolean;
  certification_status: string;
}

interface CertificationSnapshot {
  configured: boolean;
  loaded: boolean;
  rows: readonly CatalogCertificationRow[];
}

export function pupsonPublicBaseUrl(): string {
  const value =
    process.env.PUPSON_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://pupsonstuff.com';
  return value.replace(/\/+$/, '');
}

export async function loadPublicCatalogProducts(
  baseUrl = pupsonPublicBaseUrl(),
): Promise<PublicCatalogProduct[]> {
  const certification = await loadCertificationSnapshot();
  const rowsByKey = new Map(
    certification.rows.map((row) => [`${row.product_id}:${row.variant_id}`, row] as const),
  );

  return hotspots
    .filter((hotspot) => Boolean(hotspot.fulfillment))
    .map((hotspot) => {
      const variants = (hotspot.fulfillment?.variants ?? []).map<PublicCatalogVariant>((variant) => {
        const row = rowsByKey.get(`${hotspot.id}:${variant.variantId}`);
        return {
          variantId: variant.variantId,
          label: variant.label,
          priceCents: variant.priceCents,
          sellability: variantSellability(certification, row),
        };
      });

      const certified = variants.filter((variant) => variant.sellability === 'certified').length;
      const unknown = variants.filter((variant) => variant.sellability === 'unknown').length;
      const sellability: PublicCatalogProduct['sellability'] =
        unknown === variants.length ? 'unknown'
        : certified === variants.length && variants.length > 0 ? 'certified'
        : certified > 0 ? 'partially_certified'
        : 'uncertified';

      const evidenceRefs = [
        `storefront-catalog:${hotspot.id}`,
        ...(certification.loaded
          ? variants.map((variant) => `catalog-certification:${hotspot.id}:${variant.variantId}`)
          : []),
      ];

      return Object.freeze({
        id: hotspot.id,
        name: hotspot.name,
        category: hotspot.product,
        description: hotspot.description ?? `Personalized ${hotspot.name} for pet artwork.`,
        variants: Object.freeze(variants),
        estimatedDeliveryDays: hotspot.estimatedDeliveryDays
          ? Object.freeze([...hotspot.estimatedDeliveryDays] as [number, number])
          : undefined,
        customization: hotspot.customization
          ? Object.freeze({
              sizes: hotspot.customization.sizes ? Object.freeze([...hotspot.customization.sizes]) : undefined,
              colors: hotspot.customization.colors ? Object.freeze([...hotspot.customization.colors]) : undefined,
            })
          : undefined,
        sellability,
        canonicalUrl: `${baseUrl}/products/${encodeURIComponent(hotspot.id)}`,
        markdownUrl: `${baseUrl}/products/${encodeURIComponent(hotspot.id)}/page.md`,
        evidenceRefs: Object.freeze(evidenceRefs),
      });
    });
}

export async function getPublicCatalogProduct(
  id: string,
  baseUrl = pupsonPublicBaseUrl(),
): Promise<PublicCatalogProduct | undefined> {
  const products = await loadPublicCatalogProducts(baseUrl);
  return products.find((product) => product.id === id);
}

export async function buildPupsonDiscoveryManifest(
  baseUrl = pupsonPublicBaseUrl(),
  generatedAt = new Date().toISOString(),
): Promise<OwnedWebDiscoveryManifest> {
  const products = await loadPublicCatalogProducts(baseUrl);
  const entities = products.map<OwnedWebEntity>((product) => {
    const prices = product.variants.map((variant) => variant.priceCents / 100);
    const attributes: Record<string, string | number | boolean | readonly string[]> = {
      category: product.category,
      sellability: product.sellability,
      variant_count: product.variants.length,
      variant_labels: product.variants.map((variant) => variant.label),
    };
    if (product.customization?.sizes?.length) attributes.sizes = product.customization.sizes;
    if (product.customization?.colors?.length) attributes.colors = product.customization.colors;
    if (product.estimatedDeliveryDays) {
      attributes.estimated_delivery_days = `${product.estimatedDeliveryDays[0]}–${product.estimatedDeliveryDays[1]}`;
    }

    return {
      id: `product:${product.id}`,
      brandId: 'brand:pupsonstuff',
      kind: 'product',
      name: product.name,
      summary: product.description,
      canonicalUrl: product.canonicalUrl,
      markdownUrl: product.markdownUrl,
      // The current catalog ledger certifies fulfillment mappings, not live inventory.
      // Never translate mapping certification into an in-stock claim.
      availability: 'unknown',
      price: prices.length
        ? { currency: 'USD', min: Math.min(...prices), max: Math.max(...prices) }
        : undefined,
      attributes,
      evidenceRefs: product.evidenceRefs,
      observedAt: generatedAt,
    };
  });

  return createOwnedWebDiscoveryManifest({
    id: 'owned-web:pupsonstuff',
    brandId: 'brand:pupsonstuff',
    title: 'PupsonStuff',
    summary: 'PupsonStuff turns pet photos into personalized portrait artwork and customizable products.',
    canonicalUrl: baseUrl,
    generatedAt,
    entities,
    keyPages: [
      {
        label: 'Agent guidance',
        url: `${baseUrl}/agents.md`,
        description: 'Grounding rules and canonical machine-readable surfaces.',
      },
      {
        label: 'Structured catalog',
        url: `${baseUrl}/llms.jsonl`,
        description: 'One JSON record per public product listing.',
      },
    ],
    evidenceRefs: [
      'repo:apps/pupsonstuff/data/hotspots.ts',
      'runtime:pupson_catalog_variants',
    ],
  });
}

async function loadCertificationSnapshot(): Promise<CertificationSnapshot> {
  if (!getPlatformConfig()) return { configured: false, loaded: false, rows: [] };
  try {
    const rows = await rest<CatalogCertificationRow[]>(
      'pupson_catalog_variants?select=product_id,variant_id,active,certification_status',
    );
    return { configured: true, loaded: true, rows };
  } catch {
    // Discovery must fail closed on changing commerce facts. A public page can
    // still describe the product, but it must not invent current sellability.
    return { configured: true, loaded: false, rows: [] };
  }
}

function variantSellability(
  snapshot: CertificationSnapshot,
  row: CatalogCertificationRow | undefined,
): PublicCatalogVariant['sellability'] {
  if (!snapshot.configured || !snapshot.loaded) return 'unknown';
  if (!row || !row.active) return 'uncertified';
  return ['sandbox_verified', 'sample_verified'].includes(row.certification_status)
    ? 'certified'
    : 'uncertified';
}

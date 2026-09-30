import type { MetadataRoute } from 'next';
import {
  loadPublicCatalogProducts,
  pupsonPublicBaseUrl,
} from '@/lib/public-discovery';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = pupsonPublicBaseUrl();
  const products = await loadPublicCatalogProducts(baseUrl);
  return [
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...products.map((product) => ({
      url: product.canonicalUrl,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}

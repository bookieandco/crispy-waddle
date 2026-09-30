import type { MetadataRoute } from 'next';
import { pupsonPublicBaseUrl } from '@/lib/public-discovery';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = pupsonPublicBaseUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/staff-login',
        '/api/',
        '/checkout/',
      ],
    },
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_agentic_discovery.xml`,
    ],
    host: baseUrl,
  };
}

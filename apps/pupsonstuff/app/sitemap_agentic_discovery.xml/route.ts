import { buildDiscoveryResponse, renderPupsonAgenticSitemap } from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return buildDiscoveryResponse(
    request,
    await renderPupsonAgenticSitemap(),
    'application/xml; charset=utf-8',
  );
}

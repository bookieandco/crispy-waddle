import { buildDiscoveryResponse, renderPupsonLlmsTxt } from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return buildDiscoveryResponse(
    request,
    await renderPupsonLlmsTxt(),
    'text/plain; charset=utf-8',
  );
}

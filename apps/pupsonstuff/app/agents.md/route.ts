import { buildDiscoveryResponse, renderPupsonAgentsMd } from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return buildDiscoveryResponse(
    request,
    await renderPupsonAgentsMd(),
    'text/markdown; charset=utf-8',
  );
}

import { buildDiscoveryResponse, renderPupsonLlmsJsonl } from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return buildDiscoveryResponse(
    request,
    await renderPupsonLlmsJsonl(),
    'application/x-ndjson; charset=utf-8',
  );
}

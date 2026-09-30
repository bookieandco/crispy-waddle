import { renderPupsonAgentsMd } from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(renderPupsonAgentsMd(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

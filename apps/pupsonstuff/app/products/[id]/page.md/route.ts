import {
  buildDiscoveryResponse,
  renderPupsonProductMarkdown,
} from '@/lib/ai-discovery';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const markdown = await renderPupsonProductMarkdown(id);
  if (!markdown) return new Response('Not found\n', { status: 404 });

  return buildDiscoveryResponse(
    request,
    markdown,
    'text/markdown; charset=utf-8',
  );
}

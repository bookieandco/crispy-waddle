import { NextRequest, NextResponse } from 'next/server';
import { approveCreativeOutput } from '@/lib/creative-jobs';
import { OWNER_COOKIE } from '@/lib/platform';
import { normalizeArtworkTransform } from '@/types/creative';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ outputId: string }> }
) {
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken) {
    return NextResponse.json(
      { success: false, error: 'Creative session not found.' },
      { status: 401 }
    );
  }
  try {
    const { outputId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { variantId?: unknown; transform?: unknown }
      | null;
    if (!body || typeof body.variantId !== 'string' || !body.variantId) {
      return NextResponse.json(
        { success: false, error: 'A product variant is required before approval.' },
        { status: 400 }
      );
    }
    const transform =
      body.transform && typeof body.transform === 'object'
        ? normalizeArtworkTransform(body.transform as Record<string, number>)
        : normalizeArtworkTransform(undefined);
    const result = await approveCreativeOutput(outputId, ownerToken, {
      variantId: body.variantId,
      transform,
    });
    return NextResponse.json({
      success: true,
      outputId,
      approvalStatus: 'approved',
      printAssetId: result.printAssetId,
      qualityScore: result.qualityScore,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not approve the output.',
      },
      { status: 400 }
    );
  }
}

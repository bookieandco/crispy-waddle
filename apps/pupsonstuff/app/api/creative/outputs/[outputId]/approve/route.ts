import { NextRequest, NextResponse } from 'next/server';
import { approveCreativeOutput } from '@/lib/creative-jobs';
import { OWNER_COOKIE } from '@/lib/platform';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ outputId: string }> }
) {
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken)
    return NextResponse.json(
      { success: false, error: 'Creative session not found.' },
      { status: 401 }
    );
  try {
    const { outputId } = await context.params;
    await approveCreativeOutput(outputId, ownerToken);
    return NextResponse.json({ success: true, outputId, approvalStatus: 'approved' });
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

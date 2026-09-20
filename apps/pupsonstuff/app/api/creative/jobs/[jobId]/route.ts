import { NextRequest, NextResponse } from 'next/server';
import { getCreativeJob } from '@/lib/creative-jobs';
import { OWNER_COOKIE } from '@/lib/platform';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken)
    return NextResponse.json(
      { success: false, error: 'Creative session not found.' },
      { status: 401 }
    );
  const { jobId } = await context.params;
  const job = await getCreativeJob(jobId, ownerToken);
  return job
    ? NextResponse.json({ success: true, job })
    : NextResponse.json({ success: false, error: 'Creative job not found.' }, { status: 404 });
}

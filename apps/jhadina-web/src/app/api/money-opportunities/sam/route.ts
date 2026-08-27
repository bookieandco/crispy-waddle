import { NextRequest, NextResponse } from 'next/server';
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await searchSamOpportunities({
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
      postedFrom: searchParams.get('postedFrom') ?? undefined,
      postedTo: searchParams.get('postedTo') ?? undefined,
      noticeType: searchParams.get('noticeType') ?? undefined,
      keyword: searchParams.get('keyword') ?? undefined,
      naics: searchParams.get('naics') ?? undefined,
      state: searchParams.get('state') ?? undefined,
    });

    return NextResponse.json({ ok: true, source: 'sam.gov', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

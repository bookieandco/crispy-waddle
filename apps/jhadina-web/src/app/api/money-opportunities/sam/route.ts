import { NextRequest, NextResponse } from 'next/server';
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams;
    const data = await searchSamOpportunities({
      limit: Number(search.get('limit') ?? 25),
      offset: Number(search.get('offset') ?? 0),
      postedFrom: search.get('postedFrom') ?? undefined,
      postedTo: search.get('postedTo') ?? undefined,
      keyword: search.get('keyword') ?? undefined,
      noticeType: search.get('noticeType') ?? undefined,
      typeOfSetAside: search.get('typeOfSetAside') ?? undefined,
    });

    return NextResponse.json({ ok: true, source: 'sam.gov', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

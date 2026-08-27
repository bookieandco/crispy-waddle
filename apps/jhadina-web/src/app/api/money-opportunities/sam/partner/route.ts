import { NextRequest, NextResponse } from 'next/server';
import { analyzeSamPartnerGap } from '@/lib/money-opportunities/sam-partner';
import type { SamOpportunity } from '@/lib/money-opportunities/sam-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      opportunity?: SamOpportunity;
      profile?: {
        capabilities?: string[];
        preferredNaics?: string[];
        maxDirectContractValue?: number;
      };
    };

    if (!body.opportunity?.noticeId || !body.opportunity.title) {
      return NextResponse.json(
        { ok: false, error: 'opportunity.noticeId and opportunity.title are required' },
        { status: 400 },
      );
    }

    const result = analyzeSamPartnerGap(body.opportunity, {
      capabilities: body.profile?.capabilities ?? [],
      preferredNaics: body.profile?.preferredNaics,
      maxDirectContractValue: body.profile?.maxDirectContractValue,
    });

    return NextResponse.json({ ok: true, source: 'sam.gov', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

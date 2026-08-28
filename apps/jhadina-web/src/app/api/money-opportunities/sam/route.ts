import { NextRequest, NextResponse } from 'next/server';
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client';
import { scoreSamOpportunities } from '@/lib/money-opportunities/sam-intelligence';
import { estimateOpportunityEconomics } from '@/lib/money-opportunities/economics';
import { buildMoneyActionQueue } from '@/lib/money-opportunities/action-queue';
import { planResearchCase } from '@/lib/money-opportunities/research-planner';
import { persistPlannedResearchCase } from '@/lib/money-opportunities/research-persistence';
import { SupabaseMoneyResearchPersistence } from '@/lib/money-opportunities/supabase-research-persistence';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const CAPABILITY_PROFILE = {
  capabilities: [
    'software development',
    'web application',
    'automation',
    'ai',
    'data analysis',
    'marketing',
    'content',
    'digital services',
    'research',
  ],
  maxSoloValue: 250000,
};

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

    const scored = scoreSamOpportunities(data.opportunities, CAPABILITY_PROFILE);
    const withEconomics = scored.map((opportunity) => ({
      opportunity,
      score: opportunity.intelligence,
      economics: estimateOpportunityEconomics(opportunity),
      capabilityGap: opportunity.intelligence.capability < 55,
    }));
    const moneyActions = buildMoneyActionQueue(withEconomics);

    const serviceClient = createServiceRoleClient();
    const persistedResearch: Array<{ opportunityId: string; caseId: string; action: string }> = [];
    if (serviceClient) {
      const persistence = new SupabaseMoneyResearchPersistence(serviceClient);
      const titles = new Map(data.opportunities.map((opportunity) => [opportunity.noticeId, opportunity.title]));
      for (const action of moneyActions) {
        const planned = planResearchCase({
          action,
          title: titles.get(action.opportunityId) ?? `SAM opportunity ${action.opportunityId}`,
        });
        if (!planned) continue;
        const persisted = await persistPlannedResearchCase(persistence, planned);
        persistedResearch.push({
          opportunityId: persisted.opportunityId,
          caseId: persisted.id,
          action: action.action,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      source: 'sam.gov',
      count: data.opportunities.length,
      totalRecords: data.totalRecords,
      opportunities: withEconomics,
      moneyActions,
      persistedResearch,
      persistence: serviceClient ? 'supabase' : 'not_configured',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

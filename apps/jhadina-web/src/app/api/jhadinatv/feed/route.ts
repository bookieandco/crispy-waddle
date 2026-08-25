import { NextRequest, NextResponse } from 'next/server';
import { recommendTitles, type MediaTitle, type ViewingSignal } from '@jhadina/jhadina-tv-core';
import { mediaRecommendationsToFeedItems } from '../../../../../../src/lib/personal-feed/media';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { catalog?: MediaTitle[]; signals?: ViewingSignal[]; query?: string; genres?: string[]; maxRuntimeMinutes?: number };
    const catalog = Array.isArray(body.catalog) ? body.catalog : [];
    const signals = Array.isArray(body.signals) ? body.signals : [];
    const results = recommendTitles(catalog, { query: body.query, genres: body.genres, maxRuntimeMinutes: body.maxRuntimeMinutes, signals });
    return NextResponse.json({ success: true, data: { items: mediaRecommendationsToFeedItems(results, signals), count: results.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid JhadinaTV feed request' }, { status: 400 });
  }
}

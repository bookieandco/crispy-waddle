import { NextRequest, NextResponse } from 'next/server'
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client'
import type { SamOpportunity, SamNoticeType } from '@/lib/money-opportunities/sam-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_LIMIT = 100

function normalizeNoticeType(value: unknown): SamNoticeType {
  const raw = String(value ?? '').trim().toUpperCase()
  if (raw === 'SOLICITATION') return 'SOLICITATION'
  if (raw === 'SOURCES_SOUGHT' || raw === 'SOURCES SOUGHT') return 'SOURCES_SOUGHT'
  if (raw === 'SPECIAL_NOTICE') return 'SPECIAL_NOTICE'
  if (raw === 'PRESOLICITATION') return 'PRESOLICITATION'
  if (raw === 'AWARD_NOTICE') return 'AWARD_NOTICE'
  return 'OTHER'
}

function normalizeOpportunity(raw: Record<string, unknown>): SamOpportunity {
  const place = raw.placeOfPerformance
  let placeOfPerformance: string | undefined
  if (typeof place === 'string') placeOfPerformance = place
  else if (place && typeof place === 'object') {
    const value = place as Record<string, unknown>
    const city = value.city && typeof value.city === 'object' ? (value.city as Record<string, unknown>).name : value.city
    const state = value.state && typeof value.state === 'object' ? (value.state as Record<string, unknown>).code : value.state
    const country = value.country && typeof value.country === 'object' ? (value.country as Record<string, unknown>).code : value.country
    placeOfPerformance = [city, state, country].filter(Boolean).join(', ') || undefined
  }

  return {
    noticeId: String(raw.noticeId ?? raw.noticeIdNumber ?? ''),
    title: String(raw.title ?? ''),
    noticeType: normalizeNoticeType(raw.type ?? raw.baseType),
    agency: String(raw.fullParentPathName ?? raw.department ?? '').trim() || undefined,
    office: String(raw.office ?? raw.subtier ?? '').trim() || undefined,
    postedDate: String(raw.postedDate ?? '').trim() || undefined,
    responseDeadline: String(raw.responseDeadLine ?? raw.responseDeadline ?? '').trim() || undefined,
    naics: String(raw.naicsCode ?? '').trim() || undefined,
    setAside: String(raw.typeOfSetAside ?? raw.setAside ?? '').trim() || undefined,
    placeOfPerformance,
    description: String(raw.description ?? '').trim() || undefined,
    sourceUrl: String(raw.uiLink ?? '').trim() || undefined,
  }
}

function intParam(value: string | null, fallback: number, max?: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, max === undefined ? parsed : Math.min(parsed, max))
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams
  const limit = intParam(search.get('limit'), 25, MAX_LIMIT)
  const offset = intParam(search.get('offset'), 0)

  try {
    const result = await searchSamOpportunities({
      limit,
      offset,
      postedFrom: search.get('postedFrom') ?? undefined,
      postedTo: search.get('postedTo') ?? undefined,
      noticeType: search.get('noticeType') ?? undefined,
      keyword: search.get('keyword') ?? undefined,
      naics: search.get('naics') ?? undefined,
      state: search.get('state') ?? undefined,
    })

    const opportunities = (result.opportunitiesData ?? [])
      .map((item) => normalizeOpportunity(item))
      .filter((item) => item.noticeId && item.title)

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        totalRecords: result.totalRecords ?? opportunities.length,
        limit,
        offset,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch SAM.gov opportunities.'
    const status = message.includes('not configured') ? 503 : 502
    return NextResponse.json(
      { success: false, error: { code: 'SAM_UPSTREAM_ERROR', message } },
      { status },
    )
  }
}

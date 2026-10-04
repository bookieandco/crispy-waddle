import { Buffer } from "node:buffer"
import { NextResponse } from "next/server"
import {
  CjPublisherCommissionAdapter,
  PartnerizePartnerReportingAdapter,
  type CjFetch,
  type PartnerizeFetch,
} from "@jhadina/commerce-adapters"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import { syncAffiliateNetworkObservations } from "@/lib/opportunities/affiliate-network-sync"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  provider?: "partnerize" | "cj-affiliate"
  accountRef?: string
  startAt?: string
  endAt?: string
  cursor?: string
  limit?: number
  maxPages?: number
}

function fail(requestId: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, requestId, error: message },
    { status, headers: { "cache-control": "no-store" } },
  )
}

function statusFor(message: string) {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/REQUIRES_COMMERCE_AFFILIATE|MISMATCH/.test(message)) return 409
  if (/credential|token|key|account.*configured/i.test(message)) return 503
  return 400
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const body = (await request.json().catch(() => ({}))) as Body
    if (body.provider !== "partnerize" && body.provider !== "cj-affiliate") {
      return fail(
        requestId,
        "Affiliate network provider must be partnerize or cj-affiliate",
      )
    }

    const { adapter, accountRef } =
      body.provider === "partnerize"
        ? createPartnerize(body.accountRef)
        : createCj(body.accountRef)

    const repository = createSupabaseOpportunityRepository()
    const result = await syncAffiliateNetworkObservations(
      {
        opportunityId: context.params.id,
        accountRef,
        startAt: body.startAt,
        endAt: body.endAt,
        cursor: body.cursor,
        limit: body.limit,
        maxPages: body.maxPages,
      },
      adapter,
      repository,
    )

    return NextResponse.json(
      { ok: true, requestId, result },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync affiliate network"
    return fail(requestId, message, statusFor(message))
  }
}

function createPartnerize(accountOverride?: string) {
  const applicationKey = process.env.PARTNERIZE_APPLICATION_KEY?.trim()
  const userApiKey = process.env.PARTNERIZE_USER_API_KEY?.trim()
  const accountRef =
    accountOverride?.trim() || process.env.PARTNERIZE_PUBLISHER_ID?.trim()

  if (!applicationKey || !userApiKey) {
    throw new Error("Partnerize credentials are not configured")
  }
  if (!accountRef) {
    throw new Error("Partnerize publisher account is not configured")
  }

  const fetchImpl: PartnerizeFetch = async (url, init) => {
    const response = await fetch(url, {
      method: "GET",
      headers: init?.headers,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  return {
    adapter: new PartnerizePartnerReportingAdapter(fetchImpl, {
      authorizationHeader: `Basic ${Buffer.from(
        `${applicationKey}:${userApiKey}`,
      ).toString("base64")}`,
    }),
    accountRef,
  }
}

function createCj(accountOverride?: string) {
  const token = process.env.CJ_PERSONAL_ACCESS_TOKEN?.trim()
  const accountRef =
    accountOverride?.trim() || process.env.CJ_PUBLISHER_ID?.trim()

  if (!token) throw new Error("CJ personal access token is not configured")
  if (!accountRef) throw new Error("CJ publisher account is not configured")

  const fetchImpl: CjFetch = async (url, init) => {
    const response = await fetch(url, {
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  return {
    adapter: new CjPublisherCommissionAdapter(fetchImpl, {
      personalAccessToken: token,
    }),
    accountRef,
  }
}

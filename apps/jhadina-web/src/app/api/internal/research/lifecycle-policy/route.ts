import { NextRequest, NextResponse } from "next/server"
import {
  researchClaimantLifecyclePolicy,
  type LifecyclePolicyResearchRequest,
} from "@/lib/research/lifecycle-policy-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const secret = process.env.JHADINA_INTERNAL_RESEARCH_SECRET || process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    if (body.ruleFamily !== "CLAIMANT") {
      return NextResponse.json(
        { ok: false, error: "unsupported_rule_family" },
        { status: 400 },
      )
    }

    const result = await researchClaimantLifecyclePolicy({
      taskKey: typeof body.taskKey === "string" ? body.taskKey : "",
      jurisdictionId: typeof body.jurisdictionId === "string" ? body.jurisdictionId : "",
      authorityRole: typeof body.authorityRole === "string" ? body.authorityRole : "",
      sourceKey: typeof body.sourceKey === "string" ? body.sourceKey : "",
      ruleFamily: "CLAIMANT",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : "",
      authorityName: typeof body.authorityName === "string" ? body.authorityName : undefined,
      officialSourceVerified: body.officialSourceVerified === true,
      researchGoal: typeof body.researchGoal === "string" ? body.researchGoal : undefined,
      requestedPolicyFields: Array.isArray(body.requestedPolicyFields)
        ? body.requestedPolicyFields.filter((value): value is string => typeof value === "string").slice(0, 20)
        : undefined,
    } satisfies LifecyclePolicyResearchRequest)

    return NextResponse.json({
      ok: true,
      ...result,
      invariants: {
        exactBoundSourceHostOnly: true,
        claimantIdentityValuesProhibited: true,
        skipTraceProhibited: true,
        candidateRequiresHumanReview: true,
        resultDoesNotVerifyClaimant: true,
        resultDoesNotVerifyEntitlement: true,
        noExternalActionAuthority: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "lifecycle_policy_research_failed"
    const status =
      message === "LIFECYCLE_POLICY_SOURCE_URL_INVALID" ||
      message === "LIFECYCLE_POLICY_TASK_IDENTITY_REQUIRED" ||
      message === "LIFECYCLE_POLICY_RULE_FAMILY_NOT_SUPPORTED" ||
      message === "LIFECYCLE_POLICY_OFFICIAL_SOURCE_BINDING_REQUIRED" ||
      message.startsWith("LIFECYCLE_POLICY_PROTECTED_INPUT_PROHIBITED")
        ? 400
        : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

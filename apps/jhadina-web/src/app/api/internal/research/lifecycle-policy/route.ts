import { NextRequest, NextResponse } from "next/server"
import {
  assertNoProtectedIdentityValues,
  researchLifecyclePolicy,
  type LifecyclePolicyRequest,
} from "@/lib/research/lifecycle-policy-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const secret = process.env.JHADINA_INTERNAL_RESEARCH_SECRET || process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    assertNoProtectedIdentityValues(body)

    const ruleFamily =
      body.ruleFamily === "CLAIMANT"
        ? "CLAIMANT"
        : body.ruleFamily === "ENTITLEMENT"
          ? "ENTITLEMENT"
          : body.ruleFamily === "DEADLINE"
            ? "DEADLINE"
            : null

    if (!ruleFamily) {
      return NextResponse.json(
        { ok: false, error: "invalid_lifecycle_policy_rule_family" },
        { status: 400 },
      )
    }

    const input: LifecyclePolicyRequest = {
      taskKey: text(body.taskKey),
      jurisdictionId: text(body.jurisdictionId),
      authorityRole: text(body.authorityRole),
      sourceKey: text(body.sourceKey),
      ruleFamily,
      sourceUrl: text(body.sourceUrl),
      authorityName: text(body.authorityName) || null,
      officialSourceVerified: body.officialSourceVerified === true,
      researchGoal: text(body.researchGoal) || null,
      requestedPolicyFields: Array.isArray(body.requestedPolicyFields)
        ? body.requestedPolicyFields.map(text).filter(Boolean).slice(0, 30)
        : [],
    }

    if (
      !input.taskKey ||
      !input.jurisdictionId ||
      !input.authorityRole ||
      !input.sourceKey ||
      !input.sourceUrl ||
      input.officialSourceVerified !== true
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_lifecycle_policy_request" },
        { status: 400 },
      )
    }

    const result = await researchLifecyclePolicy(input)

    return NextResponse.json({
      ok: true,
      schema: "jhadina.research.lifecycle-policy.v1",
      authority: "POLICY_RESEARCH_ONLY",
      taskKey: input.taskKey,
      jurisdictionId: input.jurisdictionId,
      authorityRole: input.authorityRole,
      sourceKey: input.sourceKey,
      ruleFamily: input.ruleFamily,
      officialSourceVerified: true,
      officialSourceRefs: result.officialSourceRefs,
      policyFacts: result.policyFacts,
      researchComplete: result.researchComplete,
      matchedPolicySignals: result.matchedPolicySignals,
      claimantPiiPresent: false,
      skipTraceUsed: false,
      noExternalActionAuthority: true,
      observedAt: result.observedAt,
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
    const message = error instanceof Error ? error.message : "lifecycle_policy_failed"
    const status =
      message.includes("PROTECTED_FIELD_PROHIBITED") ||
      message.includes("REQUEST_INVALID") ||
      message.includes("SOURCE_URL_INVALID")
        ? 400
        : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

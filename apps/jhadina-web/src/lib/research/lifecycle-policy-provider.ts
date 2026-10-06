export type LifecyclePolicyRuleFamily = "CLAIMANT" | "ENTITLEMENT" | "DEADLINE"

export type LifecyclePolicyRequest = {
  taskKey: string
  jurisdictionId: string
  authorityRole: string
  sourceKey: string
  ruleFamily: LifecyclePolicyRuleFamily
  sourceUrl: string
  authorityName?: string | null
  officialSourceVerified: boolean
  researchGoal?: string | null
  requestedPolicyFields?: string[]
}

export type ClaimantPolicyFacts = {
  claimant_requirements_verified: boolean
  requirements_complete: boolean
  identity_documents_required: string[]
  custody_reference_types: string[]
  dob_may_be_used_for_corroboration: boolean
  agent_or_representative_rules: string[]
  human_review_requirements: string[]
  human_verification_required: true
  skip_trace_auto_verifies_claimant: false
  protected_identity_values_stored_in_policy: false
}

export type EntitlementPolicyFacts = {
  entitlement_requirements_verified: boolean
  requirements_complete: boolean
  claim_form_required: boolean
  notarization_required: boolean
  signature_required: boolean
  claimant_categories: string[]
  support_document_categories: string[]
  representative_rules: string[]
  human_review_requirements: string[]
  human_entitlement_decision_required: true
  result_verifies_entitlement: false
  protected_identity_values_stored_in_policy: false
}

export type DeadlinePolicyFacts = {
  deadline_rule_verified: boolean
  requirements_complete: boolean
  no_deadline_published: boolean
  deadline_window_value: number | null
  deadline_window_unit: "DAYS" | "MONTHS" | "YEARS" | null
  deadline_trigger: "SALE_DATE" | "NOTICE_DATE" | "UNKNOWN" | null
  fixed_deadline_date: string | null
  human_review_requirements: string[]
  human_entitlement_decision_required: true
  result_verifies_entitlement: false
  protected_identity_values_stored_in_policy: false
}

export type LifecyclePolicyFacts =
  | ClaimantPolicyFacts
  | EntitlementPolicyFacts
  | DeadlinePolicyFacts

export type LifecyclePolicyResult = {
  officialSourceRefs: string[]
  policyFacts: LifecyclePolicyFacts
  researchComplete: boolean
  matchedPolicySignals: string[]
  observedAt: string
}

const BLOCKED_FIELDS = new Set([
  "claimant_name",
  "owner_name",
  "full_name",
  "dob",
  "date_of_birth",
  "birth_date",
  "ssn",
  "social_security_number",
  "booking_number",
  "pfn",
  "inmate_id",
  "address",
  "home_address",
  "phone",
  "phone_number",
  "email",
  "email_address",
  "criminal_history",
  "charges",
  "offenses",
])

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function hostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function assertNoProtectedIdentityValues(value: unknown, path = "request"): void {
  if (!value || typeof value !== "object") return
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.trim().toLowerCase()
    if (BLOCKED_FIELDS.has(normalized)) {
      throw new Error(`LIFECYCLE_POLICY_PROTECTED_FIELD_PROHIBITED:${path}.${key}`)
    }
    assertNoProtectedIdentityValues(nested, `${path}.${key}`)
  }
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function has(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text))
}

export function detectClaimantPolicyFacts(rawText: string): {
  policyFacts: ClaimantPolicyFacts
  matchedPolicySignals: string[]
  researchComplete: boolean
} {
  const text = clean(rawText).toLowerCase()
  const matched: string[] = []
  const ids: string[] = []
  const custody: string[] = []
  const representative: string[] = []

  if (has(text, [/government[- ]issued (photo )?id/, /government id/])) {
    ids.push("GOVERNMENT_ISSUED_ID")
    matched.push("GOVERNMENT_ISSUED_ID")
  }
  if (has(text, [/photo identification/, /photo id\b/])) {
    ids.push("PHOTO_ID")
    matched.push("PHOTO_ID")
  }
  if (has(text, [/driver'?s license/])) {
    ids.push("DRIVERS_LICENSE")
    matched.push("DRIVERS_LICENSE")
  }
  if (has(text, [/state[- ]issued id/, /state identification/])) {
    ids.push("STATE_ID")
    matched.push("STATE_ID")
  }

  if (has(text, [/booking (number|no\.?)/])) {
    custody.push("BOOKING_NUMBER")
    matched.push("BOOKING_NUMBER_REFERENCE")
  }
  if (has(text, [/\bpfn\b/, /person file number/])) {
    custody.push("PFN")
    matched.push("PFN_REFERENCE")
  }
  if (has(text, [/inmate (id|number|no\.?)/, /inmate identification number/])) {
    custody.push("INMATE_ID")
    matched.push("INMATE_ID_REFERENCE")
  }
  if (has(text, [/account (number|no\.?)/])) {
    custody.push("ACCOUNT_NUMBER")
    matched.push("ACCOUNT_NUMBER_REFERENCE")
  }
  if (has(text, [/property (number|id)/])) {
    custody.push("PROPERTY_ID")
    matched.push("PROPERTY_ID_REFERENCE")
  }

  const dob = has(text, [/date of birth/, /\bdob\b/])
  if (dob) matched.push("DOB_POLICY_REFERENCE")

  if (has(text, [/power of attorney/, /authorized representative/, /legal representative/])) {
    representative.push("AUTHORIZED_REPRESENTATIVE_RULE_PUBLISHED")
    matched.push("REPRESENTATIVE_RULE")
  } else {
    representative.push("NOT_PUBLISHED_ON_BOUND_SOURCE")
  }

  const hasSignal = ids.length > 0 || custody.length > 0 || dob ||
    representative.some(value => value !== "NOT_PUBLISHED_ON_BOUND_SOURCE")

  const policyFacts: ClaimantPolicyFacts = {
    claimant_requirements_verified: hasSignal,
    requirements_complete: hasSignal,
    identity_documents_required: [...new Set(ids)],
    custody_reference_types: [...new Set(custody)],
    dob_may_be_used_for_corroboration: dob,
    agent_or_representative_rules: [...new Set(representative)],
    human_review_requirements: ["HUMAN_IDENTITY_REQUIREMENTS_REVIEW"],
    human_verification_required: true,
    skip_trace_auto_verifies_claimant: false,
    protected_identity_values_stored_in_policy: false,
  }

  return {
    policyFacts,
    matchedPolicySignals: [...new Set(matched)],
    researchComplete: hasSignal,
  }
}

export async function researchLifecyclePolicy(
  request: LifecyclePolicyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<LifecyclePolicyResult> {
  assertNoProtectedIdentityValues(request)

  if (
    request.ruleFamily !== "CLAIMANT" ||
    request.officialSourceVerified !== true ||
    !clean(request.taskKey) ||
    !clean(request.jurisdictionId) ||
    !clean(request.authorityRole) ||
    !clean(request.sourceKey)
  ) {
    throw new Error("LIFECYCLE_POLICY_REQUEST_INVALID")
  }

  const sourceUrl = clean(request.sourceUrl)
  const expectedHost = hostname(sourceUrl)
  if (!expectedHost) throw new Error("LIFECYCLE_POLICY_SOURCE_URL_INVALID")

  const response = await fetchImpl(sourceUrl, {
    headers: {
      Accept: "text/html,text/plain;q=0.9",
      "User-Agent": "Jhadina/1.0 governed-policy-research",
    },
    redirect: "follow",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`LIFECYCLE_POLICY_SOURCE_HTTP_${response.status}`)
  }

  const finalUrl = response.url || sourceUrl
  if (hostname(finalUrl) !== expectedHost) {
    throw new Error("LIFECYCLE_POLICY_SOURCE_HOST_REDIRECT_REJECTED")
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("text/plain")
  ) {
    throw new Error("LIFECYCLE_POLICY_SOURCE_CONTENT_TYPE_UNSUPPORTED")
  }

  const body = await response.text()
  if (body.length > 2_000_000) {
    throw new Error("LIFECYCLE_POLICY_SOURCE_TOO_LARGE")
  }

  const text = contentType.includes("html") ? textFromHtml(body) : clean(body)
  const detection = detectClaimantPolicyFacts(text)

  return {
    officialSourceRefs: [sourceUrl],
    policyFacts: detection.policyFacts,
    researchComplete: detection.researchComplete,
    matchedPolicySignals: detection.matchedPolicySignals,
    observedAt: new Date().toISOString(),
  }
}

export type LifecyclePolicyRuleFamily = "CLAIMANT"

export type LifecyclePolicyResearchRequest = {
  taskKey: string
  jurisdictionId: string
  authorityRole: string
  sourceKey: string
  ruleFamily: LifecyclePolicyRuleFamily
  sourceUrl: string
  authorityName?: string
  officialSourceVerified: boolean
  researchGoal?: string
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

export type LifecyclePolicyResearchResult = {
  schema: "jhadina.research.inmate-funds-lifecycle-policy-result.v1"
  authority: "POLICY_RESEARCH_ONLY"
  taskKey: string
  jurisdictionId: string
  authorityRole: string
  sourceKey: string
  ruleFamily: "CLAIMANT"
  officialSourceVerified: true
  officialSourceRefs: string[]
  policyFacts: ClaimantPolicyFacts
  researchComplete: boolean
  matchedPolicySignals: string[]
  claimantPiiPresent: false
  skipTraceUsed: false
  noExternalActionAuthority: true
  observedAt: string
}

const PROTECTED_INPUT_KEYS = new Set([
  "claimantname",
  "ownername",
  "fullname",
  "dob",
  "dateofbirth",
  "birthdate",
  "ssn",
  "socialsecuritynumber",
  "bookingnumber",
  "pfn",
  "inmateid",
  "address",
  "homeaddress",
  "phone",
  "phonenumber",
  "email",
  "emailaddress",
  "charges",
  "offenses",
  "criminalhistory",
])

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function assertNoClaimantIdentityInput(value: unknown, path = "request"): void {
  if (!value || typeof value !== "object") return
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PROTECTED_INPUT_KEYS.has(normalizedKey(key))) {
      throw new Error(`LIFECYCLE_POLICY_PROTECTED_INPUT_PROHIBITED:${path}.${key}`)
    }
    assertNoClaimantIdentityInput(nested, `${path}.${key}`)
  }
}

function safeHttpUrl(raw: string): URL {
  try {
    const url = new URL(raw)
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("LIFECYCLE_POLICY_SOURCE_URL_INVALID")
    }
    return url
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "LIFECYCLE_POLICY_SOURCE_URL_INVALID"
    ) {
      throw error
    }
    throw new Error("LIFECYCLE_POLICY_SOURCE_URL_INVALID")
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

export function htmlToPolicyText(html: string): string {
  return decodeHtml(
    String(html || "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 750_000)
}

function contains(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

export function extractClaimantPolicyFacts(text: string): {
  policyFacts: ClaimantPolicyFacts
  matchedPolicySignals: string[]
} {
  const value = clean(text).toLowerCase()
  const identityDocuments = new Set<string>()
  const custodyRefs = new Set<string>()
  const representativeRules = new Set<string>()
  const signals = new Set<string>()

  if (contains(value, /government[- ]issued (?:photo )?(?:id|identification)/i)) {
    identityDocuments.add("GOVERNMENT_ISSUED_ID")
    signals.add("GOVERNMENT_ISSUED_ID")
  } else if (contains(value, /(?:valid )?photo (?:id|identification)/i)) {
    identityDocuments.add("PHOTO_ID")
    signals.add("PHOTO_ID")
  }
  if (contains(value, /driver(?:'s)? license/i)) {
    identityDocuments.add("DRIVERS_LICENSE")
    signals.add("DRIVERS_LICENSE")
  }
  if (contains(value, /state[- ]issued (?:id|identification)|state id\b/i)) {
    identityDocuments.add("STATE_ID")
    signals.add("STATE_ID")
  }

  if (contains(value, /\bpfn\b/i)) {
    custodyRefs.add("PFN")
    signals.add("PFN_REFERENCE")
  }
  if (contains(value, /booking (?:number|no\.?|#)/i)) {
    custodyRefs.add("BOOKING_NUMBER")
    signals.add("BOOKING_NUMBER_REFERENCE")
  }
  if (contains(value, /inmate (?:id|number|identifier)/i)) {
    custodyRefs.add("INMATE_ID")
    signals.add("INMATE_ID_REFERENCE")
  }
  if (contains(value, /account (?:number|no\.?|identifier)/i)) {
    custodyRefs.add("ACCOUNT_NUMBER")
    signals.add("ACCOUNT_NUMBER_REFERENCE")
  }
  if (contains(value, /property (?:id|identifier|number)/i)) {
    custodyRefs.add("PROPERTY_ID")
    signals.add("PROPERTY_ID_REFERENCE")
  }

  const dobAllowed = contains(value, /date of birth|\bdob\b/i)
  if (dobAllowed) signals.add("DOB_POLICY_MENTION")

  if (contains(value, /power of attorney/i)) {
    representativeRules.add("POWER_OF_ATTORNEY_MENTIONED")
    signals.add("POWER_OF_ATTORNEY_MENTIONED")
  }
  if (contains(value, /authorized representative|authorized agent/i)) {
    representativeRules.add("AUTHORIZED_REPRESENTATIVE_MENTIONED")
    signals.add("AUTHORIZED_REPRESENTATIVE_MENTIONED")
  }
  if (!representativeRules.size) representativeRules.add("NOT_PUBLISHED_ON_BOUND_SOURCE")

  const processSignal = contains(
    value,
    /\bclaim(?:s|ed|ing)?\b|refund|remaining funds|funds owed|collect(?:ion)?|pick up|pickup|account balance|unclaimed money/i,
  )
  if (processSignal) signals.add("CLAIM_OR_REFUND_PROCESS_MENTION")

  const representativeSignal = [...representativeRules].some(
    rule => rule !== "NOT_PUBLISHED_ON_BOUND_SOURCE",
  )
  const verificationSignal =
    identityDocuments.size > 0 ||
    custodyRefs.size > 0 ||
    dobAllowed ||
    representativeSignal

  const complete = processSignal && verificationSignal

  const policyFacts: ClaimantPolicyFacts = {
    claimant_requirements_verified: complete,
    requirements_complete: complete,
    identity_documents_required: [...identityDocuments],
    custody_reference_types: [...custodyRefs],
    dob_may_be_used_for_corroboration: dobAllowed,
    agent_or_representative_rules: [...representativeRules],
    human_review_requirements: ["HUMAN_IDENTITY_REQUIREMENTS_REVIEW"],
    human_verification_required: true,
    skip_trace_auto_verifies_claimant: false,
    protected_identity_values_stored_in_policy: false,
  }

  return { policyFacts, matchedPolicySignals: [...signals] }
}

async function fetchBoundPolicyPage(
  request: LifecyclePolicyResearchRequest,
  fetchImpl: typeof fetch,
): Promise<{ text: string; resolvedUrl: string }> {
  const requested = safeHttpUrl(request.sourceUrl)
  const response = await fetchImpl(requested.toString(), {
    headers: {
      accept: "text/html,text/plain;q=0.9",
      "user-agent": "Jhadina-Lifecycle-Policy-Research/1.0",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`LIFECYCLE_POLICY_HTTP_${response.status}`)
  }

  const resolved = safeHttpUrl(response.url || requested.toString())
  if (resolved.hostname.toLowerCase() !== requested.hostname.toLowerCase()) {
    throw new Error("LIFECYCLE_POLICY_CROSS_HOST_REDIRECT_PROHIBITED")
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase()
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    throw new Error("LIFECYCLE_POLICY_UNSUPPORTED_CONTENT_TYPE")
  }

  const raw = (await response.text()).slice(0, 2_000_000)
  const text = contentType.includes("text/html") ? htmlToPolicyText(raw) : clean(raw)
  if (!text) throw new Error("LIFECYCLE_POLICY_SOURCE_EMPTY")
  return { text, resolvedUrl: resolved.toString() }
}

export async function researchClaimantLifecyclePolicy(
  request: LifecyclePolicyResearchRequest,
  {
    fetchImpl = fetch,
    now = new Date().toISOString(),
  }: { fetchImpl?: typeof fetch; now?: string } = {},
): Promise<LifecyclePolicyResearchResult> {
  assertNoClaimantIdentityInput(request)

  if (
    !clean(request.taskKey) ||
    !clean(request.jurisdictionId) ||
    !clean(request.authorityRole) ||
    !clean(request.sourceKey)
  ) {
    throw new Error("LIFECYCLE_POLICY_TASK_IDENTITY_REQUIRED")
  }
  if (request.ruleFamily !== "CLAIMANT") {
    throw new Error("LIFECYCLE_POLICY_RULE_FAMILY_NOT_SUPPORTED")
  }
  if (request.officialSourceVerified !== true) {
    throw new Error("LIFECYCLE_POLICY_OFFICIAL_SOURCE_BINDING_REQUIRED")
  }

  const page = await fetchBoundPolicyPage(request, fetchImpl)
  const extracted = extractClaimantPolicyFacts(page.text)

  return {
    schema: "jhadina.research.inmate-funds-lifecycle-policy-result.v1",
    authority: "POLICY_RESEARCH_ONLY",
    taskKey: clean(request.taskKey),
    jurisdictionId: clean(request.jurisdictionId),
    authorityRole: clean(request.authorityRole),
    sourceKey: clean(request.sourceKey),
    ruleFamily: "CLAIMANT",
    officialSourceVerified: true,
    officialSourceRefs: [page.resolvedUrl],
    policyFacts: extracted.policyFacts,
    researchComplete: extracted.policyFacts.requirements_complete,
    matchedPolicySignals: extracted.matchedPolicySignals,
    claimantPiiPresent: false,
    skipTraceUsed: false,
    noExternalActionAuthority: true,
    observedAt: now,
  }
}

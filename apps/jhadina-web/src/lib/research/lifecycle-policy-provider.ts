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

const RULE_FAMILIES = new Set<LifecyclePolicyRuleFamily>([
  "CLAIMANT",
  "ENTITLEMENT",
  "DEADLINE",
])

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

function uniq(values: string[]): string[] {
  return [...new Set(values)]
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
    identity_documents_required: uniq(ids),
    custody_reference_types: uniq(custody),
    dob_may_be_used_for_corroboration: dob,
    agent_or_representative_rules: uniq(representative),
    human_review_requirements: ["HUMAN_IDENTITY_REQUIREMENTS_REVIEW"],
    human_verification_required: true,
    skip_trace_auto_verifies_claimant: false,
    protected_identity_values_stored_in_policy: false,
  }

  return {
    policyFacts,
    matchedPolicySignals: uniq(matched),
    researchComplete: hasSignal,
  }
}

export function detectEntitlementPolicyFacts(rawText: string): {
  policyFacts: EntitlementPolicyFacts
  matchedPolicySignals: string[]
  researchComplete: boolean
} {
  const text = clean(rawText).toLowerCase()
  const matched: string[] = []
  const claimantCategories: string[] = []
  const supportDocuments: string[] = []
  const representativeRules: string[] = []

  const claimForm = has(text, [
    /\bclaim form\b/,
    /\bclaim application\b/,
    /\bapplication form\b/,
    /\bfile (a|the) claim\b/,
  ])
  if (claimForm) {
    matched.push("CLAIM_FORM_REQUIRED")
    supportDocuments.push("CLAIM_FORM")
  }

  const notarization = has(text, [/notari[sz](ed|ation)/, /\bnotary\b/])
  if (notarization) matched.push("NOTARIZATION_REQUIRED")

  const signature = has(text, [/must be signed/, /signature required/, /signed claim/, /sign(ed|ature)/])
  if (signature) matched.push("SIGNATURE_REQUIRED")

  if (has(text, [/\bowner\b/, /former owner/, /record owner/])) {
    claimantCategories.push("OWNER")
    matched.push("OWNER_CLAIMANT_CATEGORY")
  }
  if (has(text, [/\bheir(s)?\b/, /beneficiar(y|ies)/, /estate of/])) {
    claimantCategories.push("HEIR_OR_ESTATE")
    matched.push("HEIR_OR_ESTATE_CATEGORY")
  }
  if (has(text, [/authorized representative/, /legal representative/, /power of attorney/])) {
    claimantCategories.push("REPRESENTATIVE")
    representativeRules.push("AUTHORIZED_REPRESENTATIVE_RULE_PUBLISHED")
    supportDocuments.push("REPRESENTATIVE_AUTHORITY")
    matched.push("REPRESENTATIVE_RULE")
  }
  if (has(text, [/corporation/, /business entity/, /limited liability company/, /\bllc\b/])) {
    claimantCategories.push("BUSINESS")
    supportDocuments.push("BUSINESS_AUTHORITY")
    matched.push("BUSINESS_CLAIMANT_CATEGORY")
  }
  if (has(text, [/\btrust\b/, /\btrustee\b/])) {
    claimantCategories.push("TRUST")
    supportDocuments.push("TRUST_AUTHORITY")
    matched.push("TRUST_CLAIMANT_CATEGORY")
  }

  if (has(text, [/proof of ownership/, /recorded deed/, /copy of (the )?deed/, /ownership document/])) {
    supportDocuments.push("PROOF_OF_OWNERSHIP")
    matched.push("PROOF_OF_OWNERSHIP")
  }
  if (has(text, [/death certificate/, /letters testamentary/, /letters of administration/, /probate (order|document)/])) {
    supportDocuments.push("PROBATE_DOCUMENT")
    matched.push("PROBATE_DOCUMENT")
  }
  if (has(text, [/government[- ]issued (photo )?id/, /photo identification/, /photo id\b/])) {
    supportDocuments.push("IDENTITY_DOCUMENT")
    matched.push("IDENTITY_DOCUMENT_CATEGORY")
  }
  if (has(text, [/w-9/, /taxpayer identification form/])) {
    supportDocuments.push("TAX_FORM")
    matched.push("TAX_FORM_CATEGORY")
  }

  if (!representativeRules.length) {
    representativeRules.push("NOT_PUBLISHED_ON_BOUND_SOURCE")
  }

  const hasSignal = claimForm || notarization || signature ||
    claimantCategories.length > 0 || supportDocuments.length > 0 ||
    representativeRules.some(value => value !== "NOT_PUBLISHED_ON_BOUND_SOURCE")

  const policyFacts: EntitlementPolicyFacts = {
    entitlement_requirements_verified: hasSignal,
    requirements_complete: hasSignal,
    claim_form_required: claimForm,
    notarization_required: notarization,
    signature_required: signature,
    claimant_categories: uniq(claimantCategories),
    support_document_categories: uniq(supportDocuments),
    representative_rules: uniq(representativeRules),
    human_review_requirements: ["HUMAN_PROGRAM_REQUIREMENTS_REVIEW"],
    human_entitlement_decision_required: true,
    result_verifies_entitlement: false,
    protected_identity_values_stored_in_policy: false,
  }

  return {
    policyFacts,
    matchedPolicySignals: uniq(matched),
    researchComplete: hasSignal,
  }
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function parseWindow(text: string): {
  value: number | null
  unit: "DAYS" | "MONTHS" | "YEARS" | null
} {
  const match = text.match(
    /(?:within|no later than|not later than|must be filed within|filed within)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|month|months|year|years)\b/,
  )
  if (!match) return { value: null, unit: null }
  const raw = match[1] || ""
  const value = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw] ?? null
  if (!value || value <= 0) return { value: null, unit: null }
  const rawUnit = match[2] || ""
  const unit = rawUnit.startsWith("day")
    ? "DAYS"
    : rawUnit.startsWith("month")
      ? "MONTHS"
      : "YEARS"
  return { value, unit }
}

function parseFixedIsoDate(text: string): string | null {
  const match = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (!match) return null
  const value = match[1] || ""
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) ? value : null
}

export function detectDeadlinePolicyFacts(rawText: string): {
  policyFacts: DeadlinePolicyFacts
  matchedPolicySignals: string[]
  researchComplete: boolean
} {
  const text = clean(rawText).toLowerCase()
  const matched: string[] = []

  const noDeadline = has(text, [
    /\bno deadline\b/,
    /\bno time limit\b/,
    /\bdoes not expire\b/,
    /\bno statutory deadline\b/,
  ])
  if (noDeadline) matched.push("NO_DEADLINE_PUBLISHED")

  const fixedDeadlineDate = parseFixedIsoDate(text)
  if (fixedDeadlineDate) matched.push("FIXED_DEADLINE_DATE")

  const window = parseWindow(text)
  if (window.value && window.unit) matched.push("DEADLINE_WINDOW")

  let trigger: DeadlinePolicyFacts["deadline_trigger"] = null
  if (window.value || fixedDeadlineDate) {
    if (has(text, [
      /date of (the )?(tax )?sale/,
      /tax sale date/,
      /after (the )?(tax )?sale/,
      /from (the )?(tax )?sale/,
    ])) {
      trigger = "SALE_DATE"
      matched.push("SALE_DATE_TRIGGER")
    } else if (has(text, [
      /date of notice/,
      /notice date/,
      /after notice/,
      /from notice/,
      /notice (is|was) (sent|mailed|published)/,
    ])) {
      trigger = "NOTICE_DATE"
      matched.push("NOTICE_DATE_TRIGGER")
    } else {
      trigger = "UNKNOWN"
      matched.push("DEADLINE_TRIGGER_UNRESOLVED")
    }
  }

  const verified = noDeadline || Boolean(fixedDeadlineDate) ||
    Boolean(window.value && window.unit)

  const policyFacts: DeadlinePolicyFacts = {
    deadline_rule_verified: verified,
    requirements_complete: verified,
    no_deadline_published: noDeadline,
    deadline_window_value: noDeadline ? null : window.value,
    deadline_window_unit: noDeadline ? null : window.unit,
    deadline_trigger: noDeadline ? null : trigger,
    fixed_deadline_date: noDeadline ? null : fixedDeadlineDate,
    human_review_requirements: ["HUMAN_DEADLINE_RULE_REVIEW"],
    human_entitlement_decision_required: true,
    result_verifies_entitlement: false,
    protected_identity_values_stored_in_policy: false,
  }

  return {
    policyFacts,
    matchedPolicySignals: uniq(matched),
    researchComplete: verified,
  }
}

function detectPolicyFacts(ruleFamily: LifecyclePolicyRuleFamily, text: string) {
  if (ruleFamily === "CLAIMANT") return detectClaimantPolicyFacts(text)
  if (ruleFamily === "ENTITLEMENT") return detectEntitlementPolicyFacts(text)
  return detectDeadlinePolicyFacts(text)
}

export async function researchLifecyclePolicy(
  request: LifecyclePolicyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<LifecyclePolicyResult> {
  assertNoProtectedIdentityValues(request)

  if (
    !RULE_FAMILIES.has(request.ruleFamily) ||
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
  const detection = detectPolicyFacts(request.ruleFamily, text)

  return {
    officialSourceRefs: [sourceUrl],
    policyFacts: detection.policyFacts,
    researchComplete: detection.researchComplete,
    matchedPolicySignals: detection.matchedPolicySignals,
    observedAt: new Date().toISOString(),
  }
}

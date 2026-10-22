import { SIDE_HUSTLE_SERVICE_TEMPLATES } from './side-hustle-service-template.js'

/**
 * OCE-AUTONOMY.04-.05: capability evidence and internal-only service pilots.
 * A provider listing, label, template or AI output never grants external authority.
 */
export type AutonomyCapability = 'research' | 'qualified_leads' | 'seo_audit' | 'job_application' | 'external_delivery'
export type AutonomyCapabilityEvidence = {
  capability: AutonomyCapability
  executor: 'tested' | 'unverified' | 'unavailable'
  providerPermission: 'allowed' | 'unknown' | 'forbidden'
  evidenceRefs: string[]
  testReceipt?: string
  standingScopeReceipt?: string
}
export type AutonomyCapabilityDecision = {
  classification: 'internal_draft_ready' | 'manual_review' | 'blocked'
  canPrepareInternalDraft: boolean
  canPerformExternalAction: false
  blockers: string[]
  authority: 'EVIDENCE_ONLY'
}

export function assessAutonomyCapability(input: AutonomyCapabilityEvidence): AutonomyCapabilityDecision {
  const blockers: string[] = []
  if (input.providerPermission === 'forbidden') blockers.push('Source/provider prohibits this use.')
  if (input.providerPermission === 'unknown') blockers.push('Provider use conditions are not verified.')
  if (input.executor !== 'tested' || !input.testReceipt?.trim()) blockers.push('No tested executor receipt.')
  if (!input.evidenceRefs.length || input.evidenceRefs.some(ref => !ref.trim())) blockers.push('Source evidence is missing.')
  if (['job_application', 'external_delivery'].includes(input.capability)) blockers.push('External commitments require the owning Action Core and separate authorization.')
  const blocked = input.providerPermission === 'forbidden' || input.executor === 'unavailable'
  const safeDraft = !blocked && blockers.length === 0 && ['research', 'qualified_leads', 'seo_audit'].includes(input.capability)
  return {
    classification: blocked ? 'blocked' : safeDraft ? 'internal_draft_ready' : 'manual_review',
    canPrepareInternalDraft: safeDraft,
    canPerformExternalAction: false,
    blockers,
    authority: 'EVIDENCE_ONLY',
  }
}

export type ServicePilotKind = 'research_report' | 'qualified_leads' | 'seo_audit'
export type ServicePilotEvidence = {
  sourceUrl: string
  observedAt: string
  finding: string
  subject?: string
}
export type ServicePilotInput = {
  kind: ServicePilotKind
  subject: string
  evidence: ServicePilotEvidence[]
  createdAt: string
}
const PILOT_FAMILY = {
  research_report: 'research_services',
  qualified_leads: 'lead_generation_growth',
  seo_audit: 'ai_discovery_seo',
} as const

export function prepareInternalServicePilot(input: ServicePilotInput) {
  const family = PILOT_FAMILY[input.kind]
  if (!family) throw new Error('Unsupported service pilot')
  const timestamp = Date.parse(input.createdAt)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid pilot timestamp')
  const subject = input.subject.trim()
  if (!subject || subject.length > 160) throw new Error('Pilot subject must contain 1-160 characters')
  if (!Array.isArray(input.evidence) || input.evidence.length > 50) throw new Error('Evidence count must be 0-50')
  const unique = new Set<string>()
  const evidence = input.evidence.map(item => {
    const url = new URL(item.sourceUrl)
    if (url.protocol !== 'https:' || !url.hostname.includes('.') ||
        /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) throw new Error('Source URLs must be public HTTPS pages')
    if (!item.finding?.trim() || item.finding.length > 1000) throw new Error('Finding must contain 1-1000 characters')
    const observed = Date.parse(item.observedAt)
    if (!Number.isFinite(observed) || observed > timestamp) throw new Error('Observation timestamp is invalid or in the future')
    const key = `${url.origin}${url.pathname}:${item.finding.trim().toLowerCase()}`
    if (unique.has(key)) throw new Error('Duplicate source finding')
    unique.add(key)
    return { sourceUrl: url.toString(), observedAt: new Date(observed).toISOString(), finding: item.finding.trim(), subject: item.subject?.trim() ?? '' }
  })
  const template = SIDE_HUSTLE_SERVICE_TEMPLATES[family]
  const checks = [
    { name: 'Minimum two independently located findings', passed: new Set(evidence.map(e => new URL(e.sourceUrl).hostname)).size >= 2 },
    { name: 'At least two attributable observations', passed: evidence.length >= 2 },
    { name: 'Internal draft only; no fabricated client acceptance', passed: true },
  ]
  if (input.kind === 'qualified_leads') {
    checks.push({ name: 'Two identified lead subjects', passed: new Set(evidence.filter(e => e.subject).map(e => e.subject.toLowerCase())).size >= 2 })
  }
  if (input.kind === 'seo_audit') {
    checks.push({ name: 'At least one audited page under subject site', passed: evidence.some(e => e.sourceUrl.startsWith(subject)) })
  }
  const ready = checks.every(check => check.passed)
  const document = [
    `# ${template.label}: ${subject}`,
    `Created: ${new Date(timestamp).toISOString()}`,
    'State: INTERNAL DRAFT — no client, payment, outreach, publication or completed delivery is implied.',
    `Outcome to evaluate: ${template.outcomePromise}`,
    '## Documented observations',
    ...(evidence.length ? evidence.map((e,i) => `${i + 1}. ${e.subject ? `[${e.subject}] ` : ''}${e.finding} (Source: ${e.sourceUrl}; observed: ${e.observedAt})`) : ['No evidence supplied']),
    '## Proposed scope (not performed)',
    ...template.scopeItems.map(item => `- ${item.title}: ${item.description}`),
    '## Acceptance requirements (not verified)',
    ...template.acceptanceCriteria.map(item => `- ${item.description}`),
    '## Internal QA',
    ...checks.map(check => `- ${check.passed ? 'PASS' : 'BLOCKED'}: ${check.name}`),
  ].join('\n\n')
  return {
    kind: input.kind,
    family,
    templateId: template.templateId,
    subject,
    state: ready ? 'ready_for_owner_review' as const : 'needs_evidence' as const,
    checks,
    document,
    evidence,
    authority: 'INTERNAL_DRAFT_ONLY' as const,
    externalActionAuthorized: false as const,
    customerAcceptanceVerified: false as const,
    paidOutcomeVerified: false as const,
  }
}

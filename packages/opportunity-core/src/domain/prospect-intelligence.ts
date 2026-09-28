export type ProspectContactQuality =
  | 'generic_business'
  | 'public_professional'
  | 'verified_professional'
  | 'inferred_professional'
  | 'personal_or_unverified'

export type ProspectSuppressionState =
  | 'clear'
  | 'contacted'
  | 'declined'
  | 'do_not_contact'
  | 'suppressed'
  | 'customer'

export type IdealCustomerProfile = {
  id: string
  label: string
  industries: readonly string[]
  geographies: readonly string[]
  companySizeSignals: readonly string[]
  buyerRoles: readonly string[]
  painSignals: readonly string[]
  triggerSignals: readonly string[]
  disqualifiers: readonly string[]
  evidenceRefs: readonly string[]
  createdAt: string
  authority: 'ANALYSIS_ONLY'
}

export type ProspectEvidence = {
  id: string
  sourceRef: string
  observedAt: string
  claim: string
  confidence: number
}

export type ProspectRecord = {
  id: string
  icpId: string
  companyName: string
  companyDomain?: string
  industry?: string
  geography?: string
  contactName?: string
  contactRole?: string
  professionalProfileUrl?: string
  businessContact?: string
  contactQuality: ProspectContactQuality
  fitSignals: readonly string[]
  painSignals: readonly string[]
  triggerSignals: readonly string[]
  notableContext: readonly string[]
  evidence: readonly ProspectEvidence[]
  suppressionState: ProspectSuppressionState
  lastVerifiedAt: string
  authority: 'RESEARCH_ONLY'
  outreachAuthorized: false
}

export type PersonalizationEvidence = {
  text: string
  evidenceRefs: readonly string[]
}

export type ProspectPersonalization = {
  prospectId: string
  whyThem: PersonalizationEvidence
  whyNow?: PersonalizationEvidence
  whyUs: PersonalizationEvidence
  createdAt: string
  authority: 'DRAFT_CONTEXT_ONLY'
}

export type ProspectOutreachDraft = {
  id: string
  prospectId: string
  channel: string
  message: string
  personalization: ProspectPersonalization
  evidenceRefs: readonly string[]
  draftOnly: true
  sendAuthorized: false
  createdAt: string
}

export function createIdealCustomerProfile(
  input: Omit<IdealCustomerProfile, 'authority'>,
): IdealCustomerProfile {
  requireText(input.id, 'ICP_ID_REQUIRED')
  requireText(input.label, 'ICP_LABEL_REQUIRED')
  requireEvidence(input.evidenceRefs, 'ICP')
  requireDate(input.createdAt, 'ICP_DATE_INVALID')
  if (!input.industries.length && !input.buyerRoles.length && !input.painSignals.length) {
    throw new Error('ICP_TARGETING_SIGNAL_REQUIRED')
  }
  return Object.freeze({
    ...input,
    id: input.id.trim(),
    label: input.label.trim(),
    industries: Object.freeze(unique(input.industries)),
    geographies: Object.freeze(unique(input.geographies)),
    companySizeSignals: Object.freeze(unique(input.companySizeSignals)),
    buyerRoles: Object.freeze(unique(input.buyerRoles)),
    painSignals: Object.freeze(unique(input.painSignals)),
    triggerSignals: Object.freeze(unique(input.triggerSignals)),
    disqualifiers: Object.freeze(unique(input.disqualifiers)),
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    authority: 'ANALYSIS_ONLY',
  })
}

export function createProspectRecord(
  input: Omit<ProspectRecord, 'authority' | 'outreachAuthorized'>,
): ProspectRecord {
  requireText(input.id, 'PROSPECT_ID_REQUIRED')
  requireText(input.icpId, 'PROSPECT_ICP_REQUIRED')
  requireText(input.companyName, 'PROSPECT_COMPANY_REQUIRED')
  requireDate(input.lastVerifiedAt, 'PROSPECT_VERIFIED_AT_INVALID')
  if (!['generic_business', 'public_professional', 'verified_professional', 'inferred_professional', 'personal_or_unverified'].includes(input.contactQuality)) {
    throw new Error('PROSPECT_CONTACT_QUALITY_INVALID')
  }
  if (!['clear', 'contacted', 'declined', 'do_not_contact', 'suppressed', 'customer'].includes(input.suppressionState)) {
    throw new Error('PROSPECT_SUPPRESSION_STATE_INVALID')
  }
  if (!input.evidence.length) throw new Error('PROSPECT_EVIDENCE_REQUIRED')
  for (const evidence of input.evidence) {
    requireText(evidence.id, 'PROSPECT_EVIDENCE_ID_REQUIRED')
    requireText(evidence.sourceRef, 'PROSPECT_EVIDENCE_SOURCE_REQUIRED')
    requireText(evidence.claim, 'PROSPECT_EVIDENCE_CLAIM_REQUIRED')
    requireDate(evidence.observedAt, 'PROSPECT_EVIDENCE_DATE_INVALID')
    if (!Number.isFinite(evidence.confidence) || evidence.confidence < 0 || evidence.confidence > 1) {
      throw new Error('PROSPECT_EVIDENCE_CONFIDENCE_INVALID')
    }
  }

  return Object.freeze({
    ...input,
    id: input.id.trim(),
    icpId: input.icpId.trim(),
    companyName: input.companyName.trim(),
    companyDomain: input.companyDomain?.trim() || undefined,
    contactName: input.contactName?.trim() || undefined,
    contactRole: input.contactRole?.trim() || undefined,
    professionalProfileUrl: input.professionalProfileUrl?.trim() || undefined,
    businessContact: input.businessContact?.trim() || undefined,
    fitSignals: Object.freeze(unique(input.fitSignals)),
    painSignals: Object.freeze(unique(input.painSignals)),
    triggerSignals: Object.freeze(unique(input.triggerSignals)),
    notableContext: Object.freeze(unique(input.notableContext)),
    evidence: Object.freeze(input.evidence.map((value) => Object.freeze({ ...value }))),
    authority: 'RESEARCH_ONLY',
    outreachAuthorized: false,
  })
}

export function buildProspectPersonalization(input: {
  prospect: ProspectRecord
  whyThem: PersonalizationEvidence
  whyNow?: PersonalizationEvidence
  whyUs: PersonalizationEvidence
  createdAt: string
}): ProspectPersonalization {
  requireDate(input.createdAt, 'PROSPECT_PERSONALIZATION_DATE_INVALID')
  validatePersonalizationEvidence(input.whyThem, 'WHY_THEM')
  validatePersonalizationEvidence(input.whyUs, 'WHY_US')
  if (input.whyNow) validatePersonalizationEvidence(input.whyNow, 'WHY_NOW')

  const knownEvidence = new Set(input.prospect.evidence.map((value) => value.id))
  for (const evidence of [input.whyThem, input.whyNow, input.whyUs].filter(Boolean) as PersonalizationEvidence[]) {
    for (const ref of evidence.evidenceRefs) {
      if (!knownEvidence.has(ref) && !ref.startsWith('offer:') && !ref.startsWith('proof:')) {
        throw new Error(`PROSPECT_PERSONALIZATION_UNKNOWN_EVIDENCE:${ref}`)
      }
    }
  }

  return Object.freeze({
    prospectId: input.prospect.id,
    whyThem: freezePersonalization(input.whyThem),
    whyNow: input.whyNow ? freezePersonalization(input.whyNow) : undefined,
    whyUs: freezePersonalization(input.whyUs),
    createdAt: input.createdAt,
    authority: 'DRAFT_CONTEXT_ONLY',
  })
}

export function prepareProspectOutreachDraft(input: {
  id: string
  prospect: ProspectRecord
  personalization: ProspectPersonalization
  channel: string
  message: string
  createdAt: string
  allowInferredProfessionalContact?: boolean
}): ProspectOutreachDraft {
  requireText(input.id, 'PROSPECT_OUTREACH_ID_REQUIRED')
  requireText(input.channel, 'PROSPECT_OUTREACH_CHANNEL_REQUIRED')
  requireText(input.message, 'PROSPECT_OUTREACH_MESSAGE_REQUIRED')
  requireDate(input.createdAt, 'PROSPECT_OUTREACH_DATE_INVALID')
  if (input.personalization.prospectId !== input.prospect.id) {
    throw new Error('PROSPECT_OUTREACH_PERSONALIZATION_MISMATCH')
  }
  if (['declined', 'do_not_contact', 'suppressed', 'customer'].includes(input.prospect.suppressionState)) {
    throw new Error(`PROSPECT_OUTREACH_SUPPRESSED:${input.prospect.suppressionState}`)
  }
  if (input.prospect.contactQuality === 'personal_or_unverified') {
    throw new Error('PROSPECT_OUTREACH_UNVERIFIED_CONTACT_FORBIDDEN')
  }
  if (input.prospect.contactQuality === 'inferred_professional' && !input.allowInferredProfessionalContact) {
    throw new Error('PROSPECT_OUTREACH_INFERRED_CONTACT_REQUIRES_EXPLICIT_ADMISSION')
  }

  return Object.freeze({
    id: input.id.trim(),
    prospectId: input.prospect.id,
    channel: input.channel.trim(),
    message: input.message.trim(),
    personalization: input.personalization,
    evidenceRefs: Object.freeze(unique([
      ...input.prospect.evidence.map((value) => value.id),
      ...input.personalization.whyThem.evidenceRefs,
      ...(input.personalization.whyNow?.evidenceRefs ?? []),
      ...input.personalization.whyUs.evidenceRefs,
    ])),
    draftOnly: true,
    sendAuthorized: false,
    createdAt: input.createdAt,
  })
}

function validatePersonalizationEvidence(value: PersonalizationEvidence, code: string): void {
  requireText(value.text, `PROSPECT_PERSONALIZATION_${code}_TEXT_REQUIRED`)
  requireEvidence(value.evidenceRefs, `PROSPECT_PERSONALIZATION_${code}`)
}

function freezePersonalization(value: PersonalizationEvidence): PersonalizationEvidence {
  return Object.freeze({
    text: value.text.trim(),
    evidenceRefs: Object.freeze(unique(value.evidenceRefs)),
  })
}

function requireEvidence(values: readonly string[], field: string): void {
  if (!values.length || values.some((value) => !value.trim())) {
    throw new Error(`${field}_EVIDENCE_REQUIRED`)
  }
}

function requireText(value: string, code: string): void {
  if (!value?.trim()) throw new Error(code)
}

function requireDate(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

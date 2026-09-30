import type { Opportunity } from './opportunity.js'

export const US_STATE_AND_DC_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
] as const

export type UsStateOrDcCode = typeof US_STATE_AND_DC_CODES[number]

export const CALIFORNIA_COUNTIES = [
  'Alameda','Alpine','Amador','Butte','Calaveras','Colusa','Contra Costa','Del Norte','El Dorado','Fresno','Glenn','Humboldt','Imperial','Inyo','Kern','Kings','Lake','Lassen','Los Angeles','Madera','Marin','Mariposa','Mendocino','Merced','Modoc','Mono','Monterey','Napa','Nevada','Orange','Placer','Plumas','Riverside','Sacramento','San Benito','San Bernardino','San Diego','San Francisco','San Joaquin','San Luis Obispo','San Mateo','Santa Barbara','Santa Clara','Santa Cruz','Shasta','Sierra','Siskiyou','Solano','Sonoma','Stanislaus','Sutter','Tehama','Trinity','Tulare','Tuolumne','Ventura','Yolo','Yuba',
] as const

export type PublicJurisdictionLevel =
  | 'state'
  | 'county'
  | 'city'
  | 'school_district'
  | 'special_district'
  | 'authority'
  | 'public_university'
  | 'public_hospital'

export type PublicProcurementSourceKind =
  | 'solicitation'
  | 'amendment'
  | 'award'
  | 'capital_plan'
  | 'board_agenda'
  | 'budget'
  | 'bond_authorization'
  | 'facility_study'
  | 'vendor_portal'
  | 'cooperative_contract'
  | 'public_works_project'
  | 'contractor_registry'
  | 'prime_supplier_portal'
  | 'prime_subcontract_notice'

export type PublicSourceAdapterKind =
  | 'api'
  | 'rss'
  | 'html'
  | 'pdf_index'
  | 'search_form'
  | 'portal'
  | 'manual_discovery'

export type PublicSourceStatus = 'active' | 'adapter_required' | 'discovery_required' | 'disabled'

export type PublicProcurementSource = {
  id: string
  name: string
  jurisdictionLevel: PublicJurisdictionLevel
  state: UsStateOrDcCode
  county?: string
  locality?: string
  officialUrl?: string
  sourceKinds: PublicProcurementSourceKind[]
  adapterKind: PublicSourceAdapterKind
  adapterKey?: string
  refreshPolicy: 'every_4_hours' | 'daily' | 'nightly' | 'weekly'
  status: PublicSourceStatus
  authority: 'official'
  evidenceRefs: string[]
}

export const CALIFORNIA_REFERENCE_SOURCES: readonly PublicProcurementSource[] = [
  {
    id: 'ca.state.caleprocure',
    name: 'California Cal eProcure',
    jurisdictionLevel: 'state',
    state: 'CA',
    officialUrl: 'https://caleprocure.ca.gov/',
    sourceKinds: ['solicitation','vendor_portal'],
    adapterKind: 'portal',
    adapterKey: 'ca.caleprocure',
    refreshPolicy: 'every_4_hours',
    status: 'adapter_required',
    authority: 'official',
    evidenceRefs: [],
  },
  {
    id: 'ca.state.dir-public-works',
    name: 'California DIR Public Works',
    jurisdictionLevel: 'state',
    state: 'CA',
    officialUrl: 'https://www.dir.ca.gov/Public-Works/',
    sourceKinds: ['public_works_project','contractor_registry'],
    adapterKind: 'search_form',
    adapterKey: 'ca.dir.public-works',
    refreshPolicy: 'daily',
    status: 'adapter_required',
    authority: 'official',
    evidenceRefs: [],
  },
  {
    id: 'ca.los-angeles-county.doing-business',
    name: 'Los Angeles County Doing Business',
    jurisdictionLevel: 'county',
    state: 'CA',
    county: 'Los Angeles',
    officialUrl: 'https://doingbusiness.lacounty.gov/',
    sourceKinds: ['solicitation','award','vendor_portal'],
    adapterKind: 'portal',
    adapterKey: 'ca.lacounty.doing-business',
    refreshPolicy: 'every_4_hours',
    status: 'adapter_required',
    authority: 'official',
    evidenceRefs: [],
  },
  {
    id: 'ca.los-angeles-county.board-agendas',
    name: 'Los Angeles County Board Meeting Agendas',
    jurisdictionLevel: 'county',
    state: 'CA',
    county: 'Los Angeles',
    officialUrl: 'https://bos.lacounty.gov/board-meeting-agendas/',
    sourceKinds: ['board_agenda','capital_plan','budget','bond_authorization'],
    adapterKind: 'html',
    adapterKey: 'ca.lacounty.board-agendas',
    refreshPolicy: 'nightly',
    status: 'adapter_required',
    authority: 'official',
    evidenceRefs: [],
  },
  {
    id: 'ca.los-angeles-city.ramp',
    name: 'City of Los Angeles RAMP',
    jurisdictionLevel: 'city',
    state: 'CA',
    county: 'Los Angeles',
    locality: 'Los Angeles',
    officialUrl: 'https://www.rampla.org/',
    sourceKinds: ['solicitation','vendor_portal','prime_subcontract_notice'],
    adapterKind: 'portal',
    adapterKey: 'ca.lacity.ramp',
    refreshPolicy: 'every_4_hours',
    status: 'adapter_required',
    authority: 'official',
    evidenceRefs: [],
  },
] as const

export type PublicJurisdictionCoverageTarget = {
  id: string
  level: 'state' | 'county'
  state: UsStateOrDcCode
  county?: string
  sourceDiscoveryRequired: boolean
  sourceCount: number
}

export type NationalPublicCoverageManifest = {
  stateAndDcCount: number
  countyCount: number
  targets: PublicJurisdictionCoverageTarget[]
  unresolvedCountyCatalogStates: UsStateOrDcCode[]
  automaticDiscoveryAuthorized: true
  automaticExternalContactAuthorized: false
}

const uniq = <T>(values: T[]): T[] => [...new Set(values)]

export function buildNationalPublicCoverageManifest(
  sources: PublicProcurementSource[] = [...CALIFORNIA_REFERENCE_SOURCES],
  countyCatalogs: Partial<Record<UsStateOrDcCode, readonly string[]>> = { CA: CALIFORNIA_COUNTIES },
): NationalPublicCoverageManifest {
  const targets: PublicJurisdictionCoverageTarget[] = []
  const unresolvedCountyCatalogStates: UsStateOrDcCode[] = []

  for (const state of US_STATE_AND_DC_CODES) {
    const stateSourceCount = sources.filter((source) => source.state === state && source.jurisdictionLevel === 'state').length
    targets.push({
      id: `us.${state.toLowerCase()}`,
      level: 'state',
      state,
      sourceDiscoveryRequired: stateSourceCount === 0,
      sourceCount: stateSourceCount,
    })

    const counties = countyCatalogs[state]
    if (!counties) {
      if (state !== 'DC') unresolvedCountyCatalogStates.push(state)
      continue
    }

    for (const county of uniq([...counties].map((value) => value.trim()).filter(Boolean))) {
      const sourceCount = sources.filter((source) => source.state === state && source.county === county).length
      targets.push({
        id: `us.${state.toLowerCase()}.county.${county.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        level: 'county',
        state,
        county,
        sourceDiscoveryRequired: sourceCount === 0,
        sourceCount,
      })
    }
  }

  return {
    stateAndDcCount: US_STATE_AND_DC_CODES.length,
    countyCount: targets.filter((target) => target.level === 'county').length,
    targets,
    unresolvedCountyCatalogStates,
    automaticDiscoveryAuthorized: true,
    automaticExternalContactAuthorized: false,
  }
}

export type PublicSourceDiscoveryJob = {
  id: string
  state: UsStateOrDcCode
  county?: string
  searchTargets: Array<'procurement'|'bids'|'awards'|'vendor_portal'|'capital_plan'|'board_agenda'|'public_works'|'cooperative_contracts'>
  status: 'SOURCE_DISCOVERY_REQUIRED'
  externalContactAuthorized: false
}

export function planMissingPublicSources(manifest: NationalPublicCoverageManifest): PublicSourceDiscoveryJob[] {
  return manifest.targets
    .filter((target) => target.sourceDiscoveryRequired)
    .map((target) => ({
      id: `discover:${target.id}`,
      state: target.state,
      county: target.county,
      searchTargets: ['procurement','bids','awards','vendor_portal','capital_plan','board_agenda','public_works','cooperative_contracts'],
      status: 'SOURCE_DISCOVERY_REQUIRED',
      externalContactAuthorized: false,
    }))
}

export type PublicDiscoveryJob = {
  sourceId: string
  cadence: PublicProcurementSource['refreshPolicy']
  sourceKinds: PublicProcurementSourceKind[]
  dedupeStrategy: 'source_external_id_then_url_digest'
  automaticDiscoveryAuthorized: true
  externalContactAuthorized: false
  bidSubmissionAuthorized: false
}

export function planAlwaysOnPublicDiscovery(sources: PublicProcurementSource[]): PublicDiscoveryJob[] {
  return sources
    .filter((source) => source.status !== 'disabled' && Boolean(source.officialUrl))
    .map((source) => ({
      sourceId: source.id,
      cadence: source.refreshPolicy,
      sourceKinds: [...source.sourceKinds],
      dedupeStrategy: 'source_external_id_then_url_digest',
      automaticDiscoveryAuthorized: true,
      externalContactAuthorized: false,
      bidSubmissionAuthorized: false,
    }))
}

export type PublicOpportunityStage =
  | 'early_need'
  | 'capital_authorized'
  | 'scoping'
  | 'open_solicitation'
  | 'amendment'
  | 'award'
  | 'execution'
  | 'closeout'

export type PublicOpportunitySignal = {
  id: string
  sourceId: string
  sourceUrl: string
  sourceName: string
  title: string
  description?: string
  stage: PublicOpportunityStage
  state: UsStateOrDcCode
  county?: string
  locality?: string
  externalId?: string
  amount?: { min?: number; max?: number; currency: string }
  deadline?: string
  buyer?: string
  awardedPrimeName?: string
  awardedPrimeRef?: string
  naicsCode?: string
  pscCode?: string
  procurementVehicle?: string
  capturedAt: string
  evidenceRef: string
}

function claim(
  signal: PublicOpportunitySignal,
  field: string,
  value: unknown,
  idSuffix: string,
) {
  return {
    id: `${signal.id}:claim:${idSuffix}`,
    field,
    value,
    sourceId: signal.sourceId,
    sourceType: 'official' as const,
    confidence: 0.95,
    verified: false,
  }
}

export function normalizePublicOpportunitySignal(signal: PublicOpportunitySignal): Opportunity {
  const claims = [
    claim(signal, 'title', signal.title, 'title'),
    claim(signal, 'public.stage', signal.stage, 'stage'),
    claim(signal, 'jurisdiction.region', signal.state, 'state'),
  ]
  if (signal.description) claims.push(claim(signal, 'description', signal.description, 'description'))
  if (signal.deadline) claims.push(claim(signal, 'deadline', signal.deadline, 'deadline'))
  if (signal.naicsCode) claims.push(claim(signal, 'eligibility.naicsCode', signal.naicsCode, 'naics'))
  if (signal.pscCode) claims.push(claim(signal, 'eligibility.pscCode', signal.pscCode, 'psc'))
  if (signal.amount?.max !== undefined) claims.push(claim(signal, 'amount.max', signal.amount.max, 'amount-max'))

  return {
    id: signal.id,
    title: signal.title,
    family: 'business',
    type: 'contract',
    description: signal.description,
    sourceUrl: signal.sourceUrl,
    sourceName: signal.sourceName,
    sourceId: signal.sourceId,
    amount: signal.amount,
    deadline: signal.deadline,
    jurisdiction: { country: 'US', region: signal.state, locality: signal.locality ?? signal.county },
    eligibility: {
      ...(signal.naicsCode ? { naicsCode: signal.naicsCode } : {}),
      ...(signal.pscCode ? { pscCode: signal.pscCode } : {}),
      ...(signal.county ? { placeOfPerformance: `${signal.county} County, ${signal.state}` } : {}),
    },
    claims,
    evidence: [{
      id: signal.evidenceRef,
      sourceId: signal.sourceId,
      sourceUrl: signal.sourceUrl,
      sourceName: signal.sourceName,
      sourceType: 'official',
      capturedAt: signal.capturedAt,
      confidence: 0.95,
    }],
    verificationStatus: 'partially_verified',
    sourceConfidence: 0.95,
    riskFlags: [],
    brokerability: 'unknown',
    metadata: {
      publicProcurement: true,
      publicStage: signal.stage,
      buyer: signal.buyer,
      awardedPrimeName: signal.awardedPrimeName,
      awardedPrimeRef: signal.awardedPrimeRef,
      externalId: signal.externalId,
      procurementVehicle: signal.procurementVehicle,
      county: signal.county,
    },
    status: 'discovered',
    createdAt: signal.capturedAt,
    updatedAt: signal.capturedAt,
  }
}

export type PublicPursuitRoute = 'PRIME' | 'SUB' | 'TEAM' | 'CAPTURE' | 'MONITOR' | 'PASS'

export type PublicPursuitAssessment = {
  opportunityId: string
  route: PublicPursuitRoute
  reasons: string[]
  blockers: string[]
  automaticDiscoveryAuthorized: true
  automaticExternalContactAuthorized: false
  providerOutreachAuthorized: false
  bidSubmissionAuthorized: false
  contractExecutionAuthorized: false
  paymentAuthorized: false
}

export function routePublicOpportunity(input: {
  opportunityId: string
  stage: PublicOpportunityStage
  hasAwardedPrime?: boolean
  subcontractPackageFit?: boolean
  primeEligibility: 'ready' | 'fixable_gaps' | 'blocked' | 'unknown'
  providerCoverage: 'ready' | 'partial' | 'none' | 'unknown'
  pricingCoverage: 'high' | 'medium' | 'low' | 'unknown'
  workingCapital: 'ready' | 'conditional' | 'blocked' | 'unknown'
  commerciallyViable?: boolean
  fatalBlockers?: string[]
}): PublicPursuitAssessment {
  const reasons: string[] = []
  const blockers = uniq((input.fatalBlockers ?? []).filter(Boolean))
  let route: PublicPursuitRoute = 'MONITOR'

  if (input.commerciallyViable === false) blockers.push('Current evidence does not support commercially viable execution.')

  if (blockers.length > 0) route = 'PASS'
  else if (input.hasAwardedPrime && input.subcontractPackageFit) {
    route = 'SUB'
    reasons.push('An awarded prime exists and a subcontractable work package fits the current capability/provider network.')
  } else if (['early_need','capital_authorized','scoping'].includes(input.stage)) {
    route = 'CAPTURE'
    reasons.push('Opportunity is upstream of formal solicitation and is suitable for evidence-backed capture monitoring/preparation.')
  } else if (
    input.primeEligibility === 'ready' &&
    input.providerCoverage === 'ready' &&
    ['high','medium'].includes(input.pricingCoverage) &&
    ['ready','conditional'].includes(input.workingCapital) &&
    input.commerciallyViable !== false
  ) {
    route = 'PRIME'
    reasons.push('Prime eligibility, provider coverage, pricing evidence, and execution capital are sufficient for human pursuit review.')
  } else if (
    input.primeEligibility === 'fixable_gaps' ||
    input.providerCoverage === 'partial'
  ) {
    route = 'TEAM'
    reasons.push('The opportunity has fixable prime/provider gaps that may be closed through teaming or capability repair.')
  } else if (input.primeEligibility === 'blocked' || input.workingCapital === 'blocked') {
    route = 'PASS'
    blockers.push(input.primeEligibility === 'blocked' ? 'Prime eligibility is blocked.' : 'Execution working capital is blocked.')
  } else {
    route = 'MONITOR'
    reasons.push('Evidence is incomplete for a prime, subcontract, or teaming route.')
  }

  return {
    opportunityId: input.opportunityId,
    route,
    reasons: uniq(reasons),
    blockers: uniq(blockers),
    automaticDiscoveryAuthorized: true,
    automaticExternalContactAuthorized: false,
    providerOutreachAuthorized: false,
    bidSubmissionAuthorized: false,
    contractExecutionAuthorized: false,
    paymentAuthorized: false,
  }
}

export type PublicGridAcceptance = {
  status: 'pass' | 'blocked'
  stateAndDcCoverage: number
  californiaCountyCoverage: number
  activeReferenceSources: number
  missingSourceDiscoveryJobs: number
  blockers: string[]
  automaticDiscoveryAuthorized: true
  automaticExternalExecutionAuthorized: false
}

export function assessPublicGridAcceptance(
  sources: PublicProcurementSource[] = [...CALIFORNIA_REFERENCE_SOURCES],
): PublicGridAcceptance {
  const manifest = buildNationalPublicCoverageManifest(sources)
  const jobs = planMissingPublicSources(manifest)
  const blockers: string[] = []
  if (manifest.stateAndDcCount !== 51) blockers.push('US state/DC manifest is incomplete.')
  if (manifest.countyCount !== 58) blockers.push('California reference county catalog is incomplete.')
  if (!sources.some((source) => source.id === 'ca.los-angeles-county.doing-business')) blockers.push('Los Angeles County solicitation/award reference source is missing.')
  if (!sources.some((source) => source.id === 'ca.state.dir-public-works')) blockers.push('California DIR public-works reference source is missing.')

  return {
    status: blockers.length ? 'blocked' : 'pass',
    stateAndDcCoverage: manifest.stateAndDcCount,
    californiaCountyCoverage: manifest.countyCount,
    activeReferenceSources: sources.length,
    missingSourceDiscoveryJobs: jobs.length,
    blockers,
    automaticDiscoveryAuthorized: true,
    automaticExternalExecutionAuthorized: false,
  }
}

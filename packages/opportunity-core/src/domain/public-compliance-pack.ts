import { US_STATE_AND_DC_CODES, type UsStateOrDcCode } from './public-opportunity-grid.js'

export type PublicComplianceEvidenceKind=
  |'contractor_license'
  |'public_works_registration'
  |'workers_comp_or_exemption'
  |'prevailing_wage_plan'
  |'apprenticeship_plan'
  |'certified_payroll_capability'
  |'debarment_clearance'
  |'wage_assessment_clearance'
  |'other'

export type PublicComplianceEvidence={
  id:string
  kind:PublicComplianceEvidenceKind
  status:'verified'|'unverified'|'missing'|'expired'|'failed'
  value?:unknown
  evidenceRef?:string
  sourceUrl?:string
  observedAt?:string
  expiresAt?:string
}

export type PublicComplianceContext={
  state:UsStateOrDcCode
  publicWorks:'yes'|'no'|'unknown'
  workType:'construction'|'alteration'|'demolition'|'installation'|'repair'|'maintenance'|'other'|'unknown'
  estimatedValue?:number
  tradeLicenseApplicable:'yes'|'no'|'unknown'
  hasEmployees:'yes'|'no'|'unknown'
  intendsToBid:boolean
  willPerformWork:boolean
}

export type PublicComplianceApplicability=
  |'public_works'
  |'trade_license_if_applicable'
  |'workers_comp_if_employees'
  |'public_works_30k_plus'
  |'public_works_bid_or_perform'

export type PublicComplianceGate={
  id:string
  topic:string
  applicability:PublicComplianceApplicability
  evidenceKind:PublicComplianceEvidenceKind
  severity:'hard_gate'|'execution_gate'
  officialSources:Array<{url:string;title:string;observedOn:string}>
  note:string
}

export type PublicStateCompliancePack={
  state:UsStateOrDcCode
  version:string
  status:'verified_reference'|'discovery_required'|'disabled'
  gates:PublicComplianceGate[]
  evidenceRefs:string[]
  sourceObservedOn?:string
  isLegalAdvice:false
}

export type PublicComplianceGateResult={
  gateId:string
  topic:string
  status:'pass'|'review_required'|'blocked'|'not_applicable'
  reasons:string[]
  evidenceRefs:string[]
}

export type PublicComplianceAssessment={
  state:UsStateOrDcCode
  packVersion:string
  status:'pass'|'review_required'|'blocked'
  gateResults:PublicComplianceGateResult[]
  blockers:string[]
  conditions:string[]
  evidenceRefs:string[]
  externalActionAuthorized:false
  isLegalAdvice:false
}

const CA_OBSERVED='2026-09-30'
const CA_SOURCES={
  dirRegistration:{
    url:'https://www.dir.ca.gov/Public-Works/Contractor-Registration.html',
    title:'California DIR — Contractor Registration',
    observedOn:CA_OBSERVED,
  },
  dirContractors:{
    url:'https://www.dir.ca.gov/public-works/contractors.html',
    title:'California DIR — Public Works Contractors',
    observedOn:CA_OBSERVED,
  },
  dirPublicWorks:{
    url:'https://www.dir.ca.gov/Public-Works/',
    title:'California DIR — Public Works',
    observedOn:CA_OBSERVED,
  },
  dirPrevailing:{
    url:'https://www.dir.ca.gov/public-works/prevailing-wage.html',
    title:'California DIR — Prevailing Wage Requirements',
    observedOn:CA_OBSERVED,
  },
  cslbLicense:{
    url:'https://www.cslb.ca.gov/Contractors/Applicants/Contractors_License/Exam_Application/Before_Applying_For_License.aspx',
    title:'California CSLB — Who Must Be Licensed',
    observedOn:CA_OBSERVED,
  },
} as const

export const CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK:PublicStateCompliancePack={
  state:'CA',
  version:'ca-public-works-2026-09-30.v1',
  status:'verified_reference',
  sourceObservedOn:CA_OBSERVED,
  isLegalAdvice:false,
  evidenceRefs:Object.values(CA_SOURCES).map(source=>source.url),
  gates:[
    {
      id:'CA-CSLB-LICENSE',
      topic:'Contractor license where the trade/project requires CSLB licensure',
      applicability:'trade_license_if_applicable',
      evidenceKind:'contractor_license',
      severity:'hard_gate',
      officialSources:[CA_SOURCES.cslbLicense,CA_SOURCES.dirRegistration],
      note:'CSLB states contractors and subcontractors must be licensed before bidding when licensing applies; applicability depends on the work and statutory exceptions.',
    },
    {
      id:'CA-DIR-PWCR',
      topic:'DIR Public Works Contractor Registration',
      applicability:'public_works_bid_or_perform',
      evidenceKind:'public_works_registration',
      severity:'hard_gate',
      officialSources:[CA_SOURCES.dirRegistration,CA_SOURCES.dirContractors],
      note:'DIR identifies contractor registration as a core public-works responsibility. Any claimed exception or threshold should be independently verified for the specific project.',
    },
    {
      id:'CA-WORKERS-COMP',
      topic:'Workers compensation coverage or valid project-specific exemption evidence',
      applicability:'workers_comp_if_employees',
      evidenceKind:'workers_comp_or_exemption',
      severity:'hard_gate',
      officialSources:[CA_SOURCES.dirRegistration],
      note:'DIR lists workers compensation coverage for employees among registration eligibility requirements. Entity/classification-specific exemption rules require separate verification.',
    },
    {
      id:'CA-PREVAILING-WAGE',
      topic:'Prevailing wage execution plan',
      applicability:'public_works',
      evidenceKind:'prevailing_wage_plan',
      severity:'execution_gate',
      officialSources:[CA_SOURCES.dirPrevailing,CA_SOURCES.dirPublicWorks],
      note:'DIR states workers on covered public works projects must receive applicable prevailing wages; project-specific coverage and rates must be verified.',
    },
    {
      id:'CA-APPRENTICESHIP',
      topic:'Apprenticeship requirement plan for qualifying projects',
      applicability:'public_works_30k_plus',
      evidenceKind:'apprenticeship_plan',
      severity:'execution_gate',
      officialSources:[CA_SOURCES.dirPublicWorks],
      note:'DIR states public works projects of $30,000 or more must meet apprenticeship requirements; project-specific applicability remains evidence-driven.',
    },
    {
      id:'CA-CERTIFIED-PAYROLL',
      topic:'Certified payroll capability',
      applicability:'public_works',
      evidenceKind:'certified_payroll_capability',
      severity:'execution_gate',
      officialSources:[CA_SOURCES.dirContractors],
      note:'DIR lists maintaining and submitting certified payroll records among core contractor responsibilities.',
    },
    {
      id:'CA-DEBARMENT',
      topic:'No active public-works debarment',
      applicability:'public_works_bid_or_perform',
      evidenceKind:'debarment_clearance',
      severity:'hard_gate',
      officialSources:[CA_SOURCES.dirRegistration],
      note:'DIR registration eligibility includes not being under federal or state debarment.',
    },
    {
      id:'CA-WAGE-ASSESSMENT',
      topic:'No disqualifying delinquent unpaid wage or penalty assessment',
      applicability:'public_works_bid_or_perform',
      evidenceKind:'wage_assessment_clearance',
      severity:'hard_gate',
      officialSources:[CA_SOURCES.dirRegistration],
      note:'DIR registration eligibility includes not having delinquent unpaid wage or penalty assessments owed to employees or enforcement agencies.',
    },
  ],
}

export function buildNationalStateComplianceManifest():PublicStateCompliancePack[]{
  return US_STATE_AND_DC_CODES.map(state=>state==='CA'
    ?CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK
    :{
      state,
      version:`${state.toLowerCase()}-discovery-required.v1`,
      status:'discovery_required' as const,
      gates:[],
      evidenceRefs:[],
      isLegalAdvice:false as const,
    })
}

function applicability(gate:PublicComplianceGate,context:PublicComplianceContext):'applies'|'not_applicable'|'unknown'{
  switch(gate.applicability){
    case'public_works':
      if(context.publicWorks==='yes')return'applies'
      if(context.publicWorks==='no')return'not_applicable'
      return'unknown'
    case'public_works_bid_or_perform':
      if(!context.intendsToBid&&!context.willPerformWork)return'not_applicable'
      if(context.publicWorks==='yes')return'applies'
      if(context.publicWorks==='no')return'not_applicable'
      return'unknown'
    case'trade_license_if_applicable':
      if(context.tradeLicenseApplicable==='yes')return'applies'
      if(context.tradeLicenseApplicable==='no')return'not_applicable'
      return'unknown'
    case'workers_comp_if_employees':
      if(context.hasEmployees==='yes')return'applies'
      if(context.hasEmployees==='no')return'not_applicable'
      return'unknown'
    case'public_works_30k_plus':
      if(context.publicWorks==='no')return'not_applicable'
      if(context.publicWorks==='unknown')return'unknown'
      if(context.estimatedValue===undefined)return'unknown'
      return context.estimatedValue>=30000?'applies':'not_applicable'
  }
}

function evaluateGate(
  gate:PublicComplianceGate,
  context:PublicComplianceContext,
  evidence:PublicComplianceEvidence[],
):PublicComplianceGateResult{
  const applies=applicability(gate,context)
  const sourceRefs=gate.officialSources.map(source=>source.url)
  if(applies==='not_applicable'){
    return {gateId:gate.id,topic:gate.topic,status:'not_applicable',reasons:['Gate is not applicable under the supplied context.'],evidenceRefs:sourceRefs}
  }
  if(applies==='unknown'){
    return {gateId:gate.id,topic:gate.topic,status:'review_required',reasons:['Applicability cannot be determined from the supplied project/provider facts.'],evidenceRefs:sourceRefs}
  }

  const matching=evidence.filter(item=>item.kind===gate.evidenceKind)
  const verified=matching.find(item=>item.status==='verified')
  if(verified){
    return {
      gateId:gate.id,
      topic:gate.topic,
      status:'pass',
      reasons:['Required evidence is verified for this assessment context.'],
      evidenceRefs:[...new Set([...sourceRefs,...matching.map(item=>item.evidenceRef??'').filter(Boolean)])],
    }
  }
  const failed=matching.find(item=>item.status==='failed'||item.status==='expired')
  if(failed&&gate.severity==='hard_gate'){
    return {
      gateId:gate.id,
      topic:gate.topic,
      status:'blocked',
      reasons:[failed.status==='expired'?'Required hard-gate evidence is expired.':'Required hard-gate evidence is explicitly failed.'],
      evidenceRefs:[...new Set([...sourceRefs,...matching.map(item=>item.evidenceRef??'').filter(Boolean)])],
    }
  }
  return {
    gateId:gate.id,
    topic:gate.topic,
    status:'review_required',
    reasons:[matching.length?'Evidence is present but not verified.':'Required evidence has not been supplied.'],
    evidenceRefs:[...new Set([...sourceRefs,...matching.map(item=>item.evidenceRef??'').filter(Boolean)])],
  }
}

export function assessPublicStateCompliance(input:{
  pack:PublicStateCompliancePack
  context:PublicComplianceContext
  evidence?:PublicComplianceEvidence[]
}):PublicComplianceAssessment{
  if(input.pack.state!==input.context.state){
    throw new Error(`Compliance pack state mismatch: ${input.pack.state} vs ${input.context.state}`)
  }
  if(input.pack.status!=='verified_reference'){
    return {
      state:input.context.state,
      packVersion:input.pack.version,
      status:'review_required',
      gateResults:[],
      blockers:[],
      conditions:['No verified state-specific compliance pack is commissioned for this jurisdiction.'],
      evidenceRefs:input.pack.evidenceRefs,
      externalActionAuthorized:false,
      isLegalAdvice:false,
    }
  }

  const gateResults=input.pack.gates.map(gate=>evaluateGate(gate,input.context,input.evidence??[]))
  const blockers=gateResults.filter(result=>result.status==='blocked').flatMap(result=>result.reasons.map(reason=>`${result.gateId}: ${reason}`))
  const conditions=gateResults.filter(result=>result.status==='review_required').flatMap(result=>result.reasons.map(reason=>`${result.gateId}: ${reason}`))
  return {
    state:input.context.state,
    packVersion:input.pack.version,
    status:blockers.length?'blocked':conditions.length?'review_required':'pass',
    gateResults,
    blockers,
    conditions,
    evidenceRefs:[...new Set(gateResults.flatMap(result=>result.evidenceRefs))],
    externalActionAuthorized:false,
    isLegalAdvice:false,
  }
}
